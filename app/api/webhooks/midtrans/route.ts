import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getMidtransTransactionStatus } from "@/lib/midtrans";
import { getMidtransServerKey } from "@/lib/env";
import { verifyMidtransSignature } from "@/lib/midtrans-signature";
import { reconcileTelegramAccessForOrder } from "@/lib/telegram-access-revocation";
import {
    ENTITLEMENT_SENSITIVE_STATUSES,
    resolvePaymentStatus,
    shouldPersistStatusChange,
} from "@/lib/payment-status";
import { MidtransNotificationSchema } from "@/lib/schemas";
import { checkRateLimit, RATE_LIMITS, rateLimitResponseInit } from "@/lib/rate-limit";
import { getClientIp, getRequestId } from "@/lib/request-context";
import { logger } from "@/lib/logger";
import { captureException } from "@/lib/error-monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MidtransNotification = {
    order_id: string;
    transaction_id: string;
    transaction_status: string;
    status_code: string;
    gross_amount: string;
    signature_key: string;
    fraud_status?: string;
    payment_type?: string;
    refund_amount?: string;
};

function isValidSignature(notification: MidtransNotification): boolean {
    return verifyMidtransSignature(notification, getMidtransServerKey());
}

export async function POST(request: Request) {
    const requestId = getRequestId(request);

    const rateLimit = await checkRateLimit({
        key: `midtrans.webhook:${getClientIp(request)}`,
        ...RATE_LIMITS.MIDTRANS_WEBHOOK,
    });

    if (!rateLimit.allowed) {
        return NextResponse.json(
            { message: "Terlalu banyak permintaan" },
            rateLimitResponseInit(rateLimit),
        );
    }

    try {
        const rawBody = await request.text();

        let parsedJson: unknown;
        try {
            parsedJson = JSON.parse(rawBody);
        } catch {
            return NextResponse.json(
                { message: "Payload webhook tidak valid" },
                { status: 400 },
            );
        }

        const validation = MidtransNotificationSchema.safeParse(parsedJson);

        if (!validation.success) {
            return NextResponse.json(
                { message: "Payload webhook tidak lengkap" },
                { status: 400 },
            );
        }

        const notification = validation.data as MidtransNotification;

        // 1. Verify the notification actually came from Midtrans
        // *before* touching anything derived from it.
        if (!isValidSignature(notification)) {
            logger.warn("Midtrans webhook: invalid signature", {
                event: "midtrans.webhook_invalid_signature",
                requestId,
            });

            return NextResponse.json({ message: "Signature tidak valid" }, { status: 401 });
        }

        // 2. Look up the internal order.
        const order = await prisma.order.findUnique({
            where: { orderNumber: notification.order_id },
        });

        if (!order) {
            return NextResponse.json({ message: "Order tidak ditemukan" }, { status: 404 });
        }

        // 3. Fetch the current status directly from Midtrans — never
        // trust the webhook payload's status fields for the actual
        // state transition, only for routing/signature.
        const currentTransaction = await getMidtransTransactionStatus(order.orderNumber);

        if (currentTransaction.order_id !== order.orderNumber) {
            return NextResponse.json({ message: "Order ID tidak sesuai" }, { status: 400 });
        }

        // 4. Amount must match.
        const paidAmount = Number(currentTransaction.gross_amount);

        if (paidAmount !== order.amount) {
            logger.error("Midtrans webhook: amount mismatch", {
                event: "midtrans.webhook_amount_mismatch",
                requestId,
                orderId: order.id,
            });

            return NextResponse.json(
                { message: "Nominal pembayaran tidak sesuai" },
                { status: 400 },
            );
        }

        // 4b. If a transaction ID is already recorded for this Order,
        // a new notification must reference the same one.
        if (
            order.midtransTransactionId &&
            order.midtransTransactionId !== currentTransaction.transaction_id
        ) {
            logger.error("Midtrans webhook: transaction id mismatch", {
                event: "midtrans.webhook_transaction_id_mismatch",
                requestId,
                orderId: order.id,
            });

            return NextResponse.json({ message: "Transaksi tidak sesuai" }, { status: 400 });
        }

        // 5. Map Midtrans status to the internal PaymentStatus.
        const paymentStatus = resolvePaymentStatus(currentTransaction);

        if (!paymentStatus) {
            logger.warn("Midtrans webhook: unsupported status", {
                event: "midtrans.webhook_unsupported_status",
                requestId,
                orderId: order.id,
            });

            return NextResponse.json({ message: "Status diabaikan" });
        }

        // 6. Deduplicate this exact notification.
        const eventKey = createHash("sha256")
            .update(
                [
                    notification.transaction_id,
                    notification.transaction_status,
                    notification.status_code,
                    notification.signature_key,
                ].join(":"),
            )
            .digest("hex");

        const refundedAmount = currentTransaction.refund_amount
            ? Number(currentTransaction.refund_amount)
            : order.refundedAmount;

        // A stale/out-of-order notification must never downgrade an
        // Order that has already reached PAID (or a refund/chargeback
        // state derived from it) — see shouldPersistStatusChange.
        const persistStatusChange = shouldPersistStatusChange(order.status, paymentStatus);

        const finalOrderStatus = persistStatusChange ? paymentStatus : order.status;

        // 7. Persist the webhook event and the order update atomically.
        await prisma.$transaction([
            prisma.paymentWebhookEvent.upsert({
                where: { eventKey },
                create: {
                    eventKey,
                    orderId: order.id,
                    transactionStatus: currentTransaction.transaction_status,
                    payload: parsedJson as object,
                },
                update: {
                    transactionStatus: currentTransaction.transaction_status,
                    payload: parsedJson as object,
                    processedAt: new Date(),
                },
            }),

            prisma.order.update({
                where: { id: order.id },
                data: persistStatusChange
                    ? {
                          status: paymentStatus,
                          midtransTransactionId: currentTransaction.transaction_id,
                          paymentType: currentTransaction.payment_type,
                          paidAt:
                              paymentStatus === "PAID"
                                  ? (order.paidAt ?? new Date())
                                  : order.paidAt,
                          refundedAmount,
                      }
                    : {
                          midtransTransactionId: currentTransaction.transaction_id,
                          refundedAmount,
                      },
            }),
        ]);

        logger.info("Midtrans webhook processed", {
            event: "midtrans.webhook_processed",
            requestId,
            orderId: order.id,
            status: finalOrderStatus,
        });

        // 8. Telegram entitlement reconciliation — best-effort, never
        // fails this webhook response.
        if (ENTITLEMENT_SENSITIVE_STATUSES.includes(finalOrderStatus)) {
            await reconcileTelegramAccessForOrder(order.id);
        }

        return NextResponse.json({ message: "Webhook berhasil diproses" });
    } catch (error) {
        captureException(error, {
            operation: "webhooks.midtrans",
            requestId,
            expected: false,
        });

        return NextResponse.json(
            { message: "Gagal memproses webhook Midtrans" },
            { status: 500 },
        );
    }
}
