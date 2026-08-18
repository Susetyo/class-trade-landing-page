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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    if (
        transactionStatus === "chargeback" ||
        transactionStatus ===
        "partial_chargeback"
    ) {
        return "CHARGEBACK" as const;
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
                data: {
                    status: paymentStatus,
                    midtransTransactionId:
                        currentTransaction.transaction_id,
                    paymentType:
                        currentTransaction.payment_type,
                    paidAt:
                        paymentStatus === "PAID"
                            ? order.paidAt ?? new Date()
                            : order.paidAt,
                },
            }),
        ]);

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