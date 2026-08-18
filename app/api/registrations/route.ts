import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const phone = typeof body.phone === "string" ? body.phone.trim() : "";

        if (!name || !email || !phone) {
            return NextResponse.json({
                message: "Nama, email dan phone wajib diisi.",
            }, {
                status: 400
            })
        }


        const registration = await prisma.registration.create({
            data: {
                name,
                email,
                phone
            }
        });

        return NextResponse.json({
            message: "Pendaftaran berhasil",
            data: registration,
        }, {
            status: 201
        })
    } catch (error) {
        console.error("Registration error: ", error);

        return NextResponse.json({
            message: "Terjadi kesalahan pada server"
        }, {
            status: 500
        })
    }
}

export async function GET() {
    try {
        const registration = await prisma.registration.findMany({
            orderBy: {
                createdAt: "desc"
            }
        })

        return NextResponse.json({
            data: registration
        })
    } catch (error) {
        console.error("Get registration error:", error);
        return NextResponse.json({
            message: "Gagal mengabil data pendafataran"
        }, {
            status: 500
        })
    }
}