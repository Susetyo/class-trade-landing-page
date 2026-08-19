import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import type { PaymentStatus } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrderStatusData = {
    orderId: string;
    orderNumber: string;
    status: PaymentStatus;
    amount: number;
    paidAt: string | null;
    createdAt: string;
    updatedAt: string;
};

type OrderStatusResponse = {
    data: OrderStatusData;
};

type ErrorResponse = {
    message: string;
};

const ORDER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

const NO_STORE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ orderId: string }> },
) {
    try {
        const { orderId } = await params;

        if (!orderId || !ORDER_ID_PATTERN.test(orderId)) {
            return NextResponse.json<ErrorResponse>(
                { message: "Order ID tidak valid" },
                { status: 400, headers: NO_STORE_HEADERS },
            );
        }

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                orderNumber: true,
                status: true,
                amount: true,
                paidAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!order) {
            return NextResponse.json<ErrorResponse>(
                { message: "Order tidak ditemukan" },
                { status: 404, headers: NO_STORE_HEADERS },
            );
        }

        return NextResponse.json<OrderStatusResponse>(
            {
                data: {
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    status: order.status,
                    amount: order.amount,
                    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
                    createdAt: order.createdAt.toISOString(),
                    updatedAt: order.updatedAt.toISOString(),
                },
            },
            { status: 200, headers: NO_STORE_HEADERS },
        );
    } catch (error) {
        console.error("Get order status error:", error);

        return NextResponse.json<ErrorResponse>(
            { message: "Terjadi kesalahan pada server" },
            { status: 500, headers: NO_STORE_HEADERS },
        );
    }
}
