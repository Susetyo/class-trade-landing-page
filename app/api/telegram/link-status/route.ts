import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isValidOrderId } from "@/lib/order-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
    "Cache-Control": "no-store",
};

type ErrorResponse = {
    message: string;
};

type LinkStatusResponse = {
    data: { linked: boolean; linkedAt: string | null };
};

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const orderId = url.searchParams.get("orderId") ?? "";

        if (!orderId || !isValidOrderId(orderId)) {
            return NextResponse.json<ErrorResponse>(
                { message: "Order ID tidak valid" },
                { status: 400, headers: NO_STORE_HEADERS },
            );
        }

        // Same capability model as GET /api/orders/[orderId]: the Order
        // CUID is the access token, see lib/order-access.ts.
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                registration: {
                    select: {
                        telegramAccount: {
                            select: { linkedAt: true },
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

        const telegramAccount = order.registration.telegramAccount;

        return NextResponse.json<LinkStatusResponse>(
            {
                data: {
                    linked: Boolean(telegramAccount),
                    linkedAt: telegramAccount
                        ? telegramAccount.linkedAt.toISOString()
                        : null,
                },
            },
            { status: 200, headers: NO_STORE_HEADERS },
        );
    } catch (error) {
        console.error("Get Telegram link status error:", error);

        return NextResponse.json<ErrorResponse>(
            { message: "Gagal memuat status Telegram" },
            { status: 500, headers: NO_STORE_HEADERS },
        );
    }
}
