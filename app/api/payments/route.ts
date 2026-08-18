import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createSnapTransaction } from "@/lib/midtrans";

export const runtime = "nodejs";

export async function POST(request: Request) {
    let orderId: string | undefined;

    try {
        const body = await request.json();

        const registrationId =
            typeof body.registrationId === "string"
                ? body.registrationId
                : "";

        if (!registrationId) {
            return NextResponse.json(
                {
                    message: "Registration ID wajib diisi",
                },
                {
                    status: 400,
                },
            );
        }

        const registration =
            await prisma.registration.findUnique({
                where: {
                    id: registrationId,
                },
            });

        if (!registration) {
            return NextResponse.json(
                {
                    message: "Data pendaftaran tidak ditemukan",
                },
                {
                    status: 404,
                },
            );
        }

        const amount = Number(
            process.env.REGISTRATION_PRICE ?? "150000",
        );

        if (!Number.isInteger(amount) || amount <= 0) {
            throw new Error(
                "REGISTRATION_PRICE tidak valid",
            );
        }

        const orderNumber = [
            "REG",
            Date.now(),
            randomUUID().slice(0, 8),
        ].join("-");

        const order = await prisma.order.create({
            data: {
                orderNumber,
                registrationId: registration.id,
                amount,
            },
        });

        orderId = order.id;

        const snapTransaction =
            await createSnapTransaction({
                orderId: order.orderNumber,
                amount: order.amount,
                customer: {
                    name: registration.name,
                    email: registration.email,
                    phone: registration.phone,
                },
            });

        const updatedOrder = await prisma.order.update({
            where: {
                id: order.id,
            },
            data: {
                snapToken: snapTransaction.token,
                snapRedirectUrl:
                    snapTransaction.redirect_url,
            },
        });

        return NextResponse.json(
            {
                message: "Transaksi berhasil dibuat",
                data: {
                    orderId: updatedOrder.id,
                    orderNumber: updatedOrder.orderNumber,
                    amount: updatedOrder.amount,
                    snapToken: updatedOrder.snapToken,
                },
            },
            {
                status: 201,
            },
        );
    } catch (error) {
        console.error("Create payment error:", error);

        if (orderId) {
            await prisma.order
                .update({
                    where: {
                        id: orderId,
                    },
                    data: {
                        status: "FAILED",
                    },
                })
                .catch(console.error);
        }

        return NextResponse.json(
            {
                message: "Gagal membuat pembayaran",
            },
            {
                status: 500,
            },
        );
    }
}