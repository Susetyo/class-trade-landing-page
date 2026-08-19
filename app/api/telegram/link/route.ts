import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { isValidOrderId } from "@/lib/order-access";
import {
    buildTelegramDeepLink,
    generateRawLinkToken,
    getTelegramLinkTokenExpiry,
    hashLinkToken,
} from "@/lib/telegram-linking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
    "Cache-Control": "no-store",
};

// Minimal anti-spam guard: this project has no shared rate-limiting
// infrastructure yet, so we simply refuse to mint a new token for the
// same Order faster than this interval.
const MIN_REGENERATION_INTERVAL_MS = 5_000;

const RequestSchema = z.object({
    orderId: z.string().min(1).max(64),
});

type ErrorResponse = {
    message: string;
};

type LinkTokenResponse = {
    data:
        | { linked: true; deepLink: null }
        | { linked: false; deepLink: string; expiresAt: string };
};

export async function POST(request: Request) {
    try {
        const json = await request.json().catch(() => null);
        const parsed = RequestSchema.safeParse(json);

        if (!parsed.success || !isValidOrderId(parsed.data.orderId)) {
            return NextResponse.json<ErrorResponse>(
                { message: "Order ID tidak valid" },
                { status: 400, headers: NO_STORE_HEADERS },
            );
        }

        const { orderId } = parsed.data;

        // The Order CUID itself is the access capability — see
        // lib/order-access.ts. Anyone holding this id (from their own
        // payment-status link) is treated as the rightful owner.
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                status: true,
                registration: {
                    select: {
                        id: true,
                        telegramAccount: {
                            select: { id: true },
                        },
                    },
                },
            },
        });

        if (!order || !order.registration) {
            return NextResponse.json<ErrorResponse>(
                { message: "Order tidak ditemukan" },
                { status: 404, headers: NO_STORE_HEADERS },
            );
        }

        if (order.status !== "PAID") {
            return NextResponse.json<ErrorResponse>(
                { message: "Order belum dibayar" },
                { status: 409, headers: NO_STORE_HEADERS },
            );
        }

        if (order.registration.telegramAccount) {
            return NextResponse.json<LinkTokenResponse>(
                { data: { linked: true, deepLink: null } },
                { status: 200, headers: NO_STORE_HEADERS },
            );
        }

        const lastToken = await prisma.telegramLinkToken.findFirst({
            where: { orderId: order.id },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true },
        });

        if (
            lastToken &&
            Date.now() - lastToken.createdAt.getTime() <
                MIN_REGENERATION_INTERVAL_MS
        ) {
            return NextResponse.json<ErrorResponse>(
                {
                    message:
                        "Terlalu banyak permintaan. Silakan coba lagi sebentar.",
                },
                { status: 429, headers: NO_STORE_HEADERS },
            );
        }

        const rawToken = generateRawLinkToken();
        const tokenHash = hashLinkToken(rawToken);
        const expiresAt = getTelegramLinkTokenExpiry();

        // Revoke any still-usable tokens for this Order, then mint a
        // fresh one, atomically — only the newest token stays valid.
        await prisma.$transaction([
            prisma.telegramLinkToken.updateMany({
                where: {
                    orderId: order.id,
                    usedAt: null,
                    revokedAt: null,
                },
                data: { revokedAt: new Date() },
            }),
            prisma.telegramLinkToken.create({
                data: {
                    orderId: order.id,
                    tokenHash,
                    expiresAt,
                },
            }),
        ]);

        const deepLink = buildTelegramDeepLink(rawToken);

        return NextResponse.json<LinkTokenResponse>(
            {
                data: {
                    linked: false,
                    deepLink,
                    expiresAt: expiresAt.toISOString(),
                },
            },
            { status: 201, headers: NO_STORE_HEADERS },
        );
    } catch (error) {
        console.error("Create Telegram link token error:", error);

        return NextResponse.json<ErrorResponse>(
            { message: "Gagal membuat tautan Telegram" },
            { status: 500, headers: NO_STORE_HEADERS },
        );
    }
}
