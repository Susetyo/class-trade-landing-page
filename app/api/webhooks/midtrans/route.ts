import {
    createHash,
    timingSafeEqual,
} from "node:crypto";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
    getMidtransTransactionStatus,
    type MidtransTransactionStatus,
} from "@/lib/midtrans";
import { reconcileTelegramAccessForOrder } from "@/lib/telegram-access-revocation";
import type { PaymentStatus } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Milestone 14: once an Order has reached PAID (or a refund/chargeback
// state derived from it), a stale or out-of-order notification
// reporting one of these non-payment statuses must never downgrade
// it — see docs/telegram-setup.md.
const NEVER_DOWNGRADE_FROM: PaymentStatus[] = [
    "PAID",
    "REFUNDED",
    "PARTIALLY_REFUNDED",
    "CHARGEBACK",
    "PARTIAL_CHARGEBACK",
];
const NON_PAYMENT_STATUSES: PaymentStatus[] = [
    "PENDING",
    "EXPIRED",
    "CANCELLED",
    "FAILED",
];

// Statuses that can affect Telegram entitlement — only these are
// worth an extra query + potential Telegram calls after commit.
const ENTITLEMENT_SENSITIVE_STATUSES: PaymentStatus[] = [
    "REFUNDED",
    "PARTIALLY_REFUNDED",
    "CHARGEBACK",
    "PARTIAL_CHARGEBACK",
];

function shouldPersistStatusChange(
    current: PaymentStatus,
    next: PaymentStatus,
): boolean {
    if (current === next) return true;

    // Fully terminal — once a transaction has been reported fully
    // refunded or fully charged back, no later notification may move
    // it anywhere else.
    if (current === "REFUNDED" || current === "CHARGEBACK") return false;

    if (
        NEVER_DOWNGRADE_FROM.includes(current) &&
        NON_PAYMENT_STATUSES.includes(next)
    ) {
        return false;
    }

    return true;
}

type MidtransNotification =
    MidtransTransactionStatus & {
        signature_key: string;
    };

function isValidSignature(
    notification: MidtransNotification,
) {
    const serverKey = process.env.MIDTRANS_SERVER_KEY;

    if (!serverKey) {
        throw new Error(
            "MIDTRANS_SERVER_KEY belum dikonfigurasi",
        );
    }

    const expectedSignature = createHash("sha512")
        .update(
            notification.order_id +
            notification.status_code +
            notification.gross_amount +
            serverKey,
        )
        .digest("hex");

    const receivedSignature =
        notification.signature_key.toLowerCase();

    if (
        !/^[a-f0-9]{128}$/.test(receivedSignature)
    ) {
        return false;
    }

    return timingSafeEqual(
        Buffer.from(expectedSignature, "hex"),
        Buffer.from(receivedSignature, "hex"),
    );
}

function resolvePaymentStatus(
    transaction: MidtransTransactionStatus,
) {
    const transactionStatus =
        transaction.transaction_status.toLowerCase();

    const fraudStatus =
        transaction.fraud_status?.toLowerCase();

    if (
        transactionStatus === "settlement" &&
        transaction.status_code === "200"
    ) {
        return "PAID" as const;
    }

    if (
        transactionStatus === "capture" &&
        transaction.status_code === "200" &&
        fraudStatus === "accept"
    ) {
        return "PAID" as const;
    }

    if (
        transactionStatus === "pending" ||
        transactionStatus === "authorize"
    ) {
        return "PENDING" as const;
    }

    if (transactionStatus === "expire") {
        return "EXPIRED" as const;
    }

    if (transactionStatus === "cancel") {
        return "CANCELLED" as const;
    }

    if (
        transactionStatus === "deny" ||
        transactionStatus === "failure"
    ) {
        return "FAILED" as const;
    }

    if (transactionStatus === "refund") {
        return "REFUNDED" as const;
    }

    if (
        transactionStatus === "partial_refund"
    ) {
        return "PARTIALLY_REFUNDED" as const;
    }

    if (transactionStatus === "chargeback") {
        return "CHARGEBACK" as const;
    }

    if (transactionStatus === "partial_chargeback") {
        // Kept distinct from full CHARGEBACK — Milestone 14 policy
        // requires manual review rather than an automatic revocation.
        // See lib/telegram-entitlement.ts.
        return "PARTIAL_CHARGEBACK" as const;
    }

    return null;
}

export async function POST(request: Request) {
    try {
        const rawBody = await request.text();

        const notification = JSON.parse(
            rawBody,
        ) as MidtransNotification;

        if (
            !notification.order_id ||
            !notification.transaction_id ||
            !notification.transaction_status ||
            !notification.status_code ||
            !notification.gross_amount ||
            !notification.signature_key
        ) {
            return NextResponse.json(
                {
                    message:
                        "Payload webhook tidak lengkap",
                },
                {
                    status: 400,
                },
            );
        }

        // 1. Verifikasi bahwa webhook berasal
        // dari Midtrans
        if (!isValidSignature(notification)) {
            return NextResponse.json(
                {
                    message: "Signature tidak valid",
                },
                {
                    status: 401,
                },
            );
        }

        // 2. Cari order internal
        const order = await prisma.order.findUnique({
            where: {
                orderNumber: notification.order_id,
            },
        });

        if (!order) {
            return NextResponse.json(
                {
                    message: "Order tidak ditemukan",
                },
                {
                    status: 404,
                },
            );
        }

        // 3. Ambil status terbaru langsung
        // dari API Midtrans
        const currentTransaction =
            await getMidtransTransactionStatus(
                order.orderNumber,
            );

        if (
            currentTransaction.order_id !==
            order.orderNumber
        ) {
            return NextResponse.json(
                {
                    message: "Order ID tidak sesuai",
                },
                {
                    status: 400,
                },
            );
        }

        // 4. Pastikan nominalnya sama
        const paidAmount = Number(
            currentTransaction.gross_amount,
        );

        if (paidAmount !== order.amount) {
            console.error("Amount mismatch", {
                expected: order.amount,
                received: paidAmount,
            });

            return NextResponse.json(
                {
                    message:
                        "Nominal pembayaran tidak sesuai",
                },
                {
                    status: 400,
                },
            );
        }

        // 4b. Pastikan transaction ID cocok dengan transaksi yang
        // sudah tercatat untuk Order ini (jika sudah pernah tercatat)
        // — mencegah notification untuk transaksi lain diterapkan ke
        // Order yang salah.
        if (
            order.midtransTransactionId &&
            order.midtransTransactionId !==
            currentTransaction.transaction_id
        ) {
            console.error(
                "Transaction ID mismatch for order",
            );

            return NextResponse.json(
                {
                    message: "Transaksi tidak sesuai",
                },
                {
                    status: 400,
                },
            );
        }

        // 5. Petakan status Midtrans
        const paymentStatus =
            resolvePaymentStatus(currentTransaction);

        if (!paymentStatus) {
            console.warn(
                "Unsupported Midtrans status:",
                currentTransaction.transaction_status,
            );

            return NextResponse.json({
                message: "Status diabaikan",
            });
        }

        // 6. Buat ID webhook agar pemrosesan
        // bersifat idempotent
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

        const payload = JSON.parse(rawBody);

        // Cumulative refund amount, sourced only from Midtrans' own
        // status response — never from the browser. Used centrally by
        // lib/telegram-entitlement.ts to tell a full refund (by
        // value) apart from a partial one.
        const refundedAmount = currentTransaction.refund_amount
            ? Number(currentTransaction.refund_amount)
            : order.refundedAmount;

        // A stale/out-of-order notification must never downgrade an
        // Order that has already reached PAID (or a refund/chargeback
        // state derived from it) back to a non-payment status — see
        // shouldPersistStatusChange above.
        const persistStatusChange = shouldPersistStatusChange(
            order.status,
            paymentStatus,
        );

        const finalOrderStatus = persistStatusChange
            ? paymentStatus
            : order.status;

        // 7. Simpan webhook dan update order
        // dalam satu database transaction
        await prisma.$transaction([
            prisma.paymentWebhookEvent.upsert({
                where: {
                    eventKey,
                },
                create: {
                    eventKey,
                    orderId: order.id,
                    transactionStatus:
                        currentTransaction.transaction_status,
                    payload,
                },
                update: {
                    transactionStatus:
                        currentTransaction.transaction_status,
                    payload,
                    processedAt: new Date(),
                },
            }),

            prisma.order.update({
                where: {
                    id: order.id,
                },
                data: persistStatusChange
                    ? {
                        status: paymentStatus,
                        midtransTransactionId:
                            currentTransaction.transaction_id,
                        paymentType:
                            currentTransaction.payment_type,
                        paidAt:
                            paymentStatus === "PAID"
                                ? order.paidAt ?? new Date()
                                : order.paidAt,
                        refundedAmount,
                    }
                    : {
                        // Status change ignored (stale/out-of-order),
                        // but transaction identity/refund audit data
                        // can still be safely recorded.
                        midtransTransactionId:
                            currentTransaction.transaction_id,
                        refundedAmount,
                    },
            }),
        ]);

        // 8. Rekonsiliasi akses Telegram — di luar transaction di
        // atas (tidak pernah menahan koneksi DB sambil menunggu
        // Telegram API), best-effort, dan tidak pernah menggagalkan
        // response webhook ini.
        if (ENTITLEMENT_SENSITIVE_STATUSES.includes(finalOrderStatus)) {
            await reconcileTelegramAccessForOrder(order.id);
        }

        return NextResponse.json({
            message: "Webhook berhasil diproses",
        });
    } catch (error) {
        console.error("Midtrans webhook error:", error);

        return NextResponse.json(
            {
                message:
                    "Gagal memproses webhook Midtrans",
            },
            {
                status: 500,
            },
        );
    }
}