import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createSnapTransaction, MidtransApiError } from "@/lib/midtrans";
import { PaymentCreateInputSchema } from "@/lib/schemas";
import { getEnv } from "@/lib/env";
import { checkRateLimit, RATE_LIMITS, rateLimitResponseInit } from "@/lib/rate-limit";
import { getClientIp, getRequestId } from "@/lib/request-context";
import {
    fingerprintPayload,
    getIdempotencyKey,
    hasMalformedIdempotencyKey,
    idempotencyConflictResponse,
    idempotencyInProgressResponse,
    runIdempotent,
} from "@/lib/idempotency";
import { captureException } from "@/lib/error-monitoring";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

async function handleCreatePayment(
    body: unknown,
    requestId: string,
): Promise<{ status: number; body: unknown }> {
    const parsed = PaymentCreateInputSchema.safeParse(body);

    if (!parsed.success) {
        return { status: 400, body: { message: "Registration ID wajib diisi" } };
    }

    const { registrationId } = parsed.data;

    const registration = await prisma.registration.findUnique({
        where: { id: registrationId },
    });

    if (!registration) {
        return { status: 404, body: { message: "Data pendaftaran tidak ditemukan" } };
    }

    const amount = getEnv().REGISTRATION_PRICE;

    const orderNumber = ["REG", Date.now(), randomUUID().slice(0, 8)].join("-");

    const order = await prisma.order.create({
        data: { orderNumber, registrationId: registration.id, amount },
    });

    try {
        const snapTransaction = await createSnapTransaction({
            orderId: order.orderNumber,
            amount: order.amount,
            customer: {
                name: registration.name,
                email: registration.email,
                phone: registration.phone,
            },
        });

        const updatedOrder = await prisma.order.update({
            where: { id: order.id },
            data: {
                snapToken: snapTransaction.token,
                snapRedirectUrl: snapTransaction.redirect_url,
            },
        });

        logger.info("Payment order created", {
            event: "payment.order_created",
            requestId,
            orderId: order.id,
        });

        return {
            status: 201,
            body: {
                message: "Transaksi berhasil dibuat",
                data: {
                    orderId: updatedOrder.id,
                    orderNumber: updatedOrder.orderNumber,
                    amount: updatedOrder.amount,
                    snapToken: updatedOrder.snapToken,
                },
            },
        };
    } catch (error) {
        await prisma.order
            .update({ where: { id: order.id }, data: { status: "FAILED" } })
            .catch(() => {});

        const expected = error instanceof MidtransApiError && error.status < 500;

        captureException(error, {
            operation: "payments.create_snap_transaction",
            requestId,
            orderId: order.id,
            expected,
        });

        return { status: 502, body: { message: "Gagal membuat pembayaran" } };
    }
}

export async function POST(request: Request) {
    const requestId = getRequestId(request);
    const ip = getClientIp(request);

    const rateLimit = await checkRateLimit({
        key: `payment.create:${ip}`,
        ...RATE_LIMITS.PAYMENT_CREATE,
    });

    if (!rateLimit.allowed) {
        return NextResponse.json(
            { message: "Terlalu banyak permintaan. Silakan coba lagi nanti." },
            rateLimitResponseInit(rateLimit),
        );
    }

    if (hasMalformedIdempotencyKey(request)) {
        return NextResponse.json(
            { message: "Idempotency-Key tidak valid." },
            { status: 400 },
        );
    }

    try {
        const body = await request.json().catch(() => null);
        const idempotencyKey = getIdempotencyKey(request);

        if (!idempotencyKey) {
            // No idempotency key supplied: this is the client's choice
            // to opt out of replay protection. Duplicate order creation
            // is still bounded by the per-IP rate limit above.
            const result = await handleCreatePayment(body, requestId);
            return NextResponse.json(result.body, { status: result.status });
        }

        const outcome = await runIdempotent(
            {
                scope: "payment.create",
                key: idempotencyKey,
                fingerprint: fingerprintPayload(body),
                requestId,
            },
            () => handleCreatePayment(body, requestId),
        );

        if (outcome.kind === "conflict") return idempotencyConflictResponse();
        if (outcome.kind === "in_progress") return idempotencyInProgressResponse();

        return NextResponse.json(outcome.result.body, { status: outcome.result.status });
    } catch (error) {
        captureException(error, {
            operation: "payments.create",
            requestId,
            expected: false,
        });

        return NextResponse.json({ message: "Gagal membuat pembayaran" }, { status: 500 });
    }
}
