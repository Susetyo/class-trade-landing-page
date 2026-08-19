"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import Link from "next/link";
import { useRouter } from "next/navigation";

type RegistrationFormValues = {
    name: string;
    email: string;
    phone: string;
};

type SubmitStatus = {
    type: "idle" | "info" | "success" | "error";
    message: string;
};

const GENERIC_ERROR_MESSAGE = "Terjadi kesalahan. Silakan coba lagi.";

async function postJson<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
        throw new Error(result?.message ?? GENERIC_ERROR_MESSAGE);
    }

    return result as T;
}

export function RegistrationForm() {
    const router = useRouter();
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<RegistrationFormValues>({
        defaultValues: { name: "", email: "", phone: "" },
    });
    const [status, setStatus] = useState<SubmitStatus>({
        type: "idle",
        message: "",
    });
    const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);

    async function onSubmit(values: RegistrationFormValues) {
        setStatus({ type: "info", message: "Menyimpan pendaftaran..." });
        setPaymentOrderId(null);

        try {
            const registrationResult = await postJson<{
                data: { id: string };
            }>("/api/registrations", values);

            setStatus({ type: "info", message: "Membuat pembayaran..." });

            const paymentResult = await postJson<{
                data: { orderId: string; snapToken?: string };
            }>("/api/payments", {
                registrationId: registrationResult.data.id,
            });

            const { orderId, snapToken } = paymentResult.data;

            if (!snapToken) {
                throw new Error("Snap token tidak ditemukan.");
            }

            if (!window.snap) {
                throw new Error("Midtrans Snap belum selesai dimuat.");
            }

            setStatus({ type: "info", message: "Membuka pembayaran..." });

            window.snap.pay(snapToken, {
                onSuccess() {
                    reset();
                    router.push(`/payment/${orderId}`);
                },
                onPending() {
                    router.push(`/payment/${orderId}`);
                },
                onError() {
                    setStatus({
                        type: "error",
                        message:
                            "Pembayaran gagal. Silakan coba lagi atau cek status pembayaran.",
                    });
                    setPaymentOrderId(orderId);
                },
                onClose() {
                    setStatus({
                        type: "info",
                        message:
                            "Kamu menutup halaman pembayaran. Pembayaran masih bisa diselesaikan.",
                    });
                    setPaymentOrderId(orderId);
                },
            });
        } catch (error) {
            setStatus({
                type: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : GENERIC_ERROR_MESSAGE,
            });
        }
    }

    return (
        <div className="mx-auto max-w-xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#365C2A]">
                Join The Academy
            </p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
                Daftar Batch
            </h1>
            <p className="mt-3 max-w-lg text-base leading-7 text-[#3C4636] md:text-lg">
                Isi data di bawah ini dan tim kami akan menghubungi kamu untuk
                info batch selanjutnya.
            </p>

            <form
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="mt-10 rounded-[32px] border border-[#E4DDCE] bg-[#FBF8F1] p-6 shadow-[0_18px_54px_rgba(28,37,19,0.08)] sm:p-8"
            >
                <div>
                    <label
                        htmlFor="name"
                        className="text-sm font-bold text-[#102016]"
                    >
                        Nama Lengkap
                    </label>
                    <input
                        id="name"
                        type="text"
                        placeholder="Nama kamu"
                        className="mt-3 w-full rounded-2xl border border-[#E4DDCE] bg-white px-4 py-3 text-sm font-semibold text-[#102016] outline-none focus:border-[#365C2A]"
                        {...register("name", { required: "Nama wajib diisi." })}
                    />
                    {errors.name ? (
                        <p className="mt-2 text-xs font-medium text-[#B14545]">
                            {errors.name.message}
                        </p>
                    ) : null}
                </div>

                <div className="mt-6">
                    <label
                        htmlFor="email"
                        className="text-sm font-bold text-[#102016]"
                    >
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        placeholder="nama@email.com"
                        className="mt-3 w-full rounded-2xl border border-[#E4DDCE] bg-white px-4 py-3 text-sm font-semibold text-[#102016] outline-none focus:border-[#365C2A]"
                        {...register("email", {
                            required: "Email wajib diisi.",
                            pattern: {
                                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                message: "Format email tidak valid.",
                            },
                        })}
                    />
                    {errors.email ? (
                        <p className="mt-2 text-xs font-medium text-[#B14545]">
                            {errors.email.message}
                        </p>
                    ) : null}
                </div>

                <div className="mt-6">
                    <label
                        htmlFor="phone"
                        className="text-sm font-bold text-[#102016]"
                    >
                        Nomor HP
                    </label>
                    <input
                        id="phone"
                        type="tel"
                        placeholder="08xxxxxxxxxx"
                        className="mt-3 w-full rounded-2xl border border-[#E4DDCE] bg-white px-4 py-3 text-sm font-semibold text-[#102016] outline-none focus:border-[#365C2A]"
                        {...register("phone", {
                            required: "Nomor HP wajib diisi.",
                            pattern: {
                                value: /^[0-9+\-\s]{8,15}$/,
                                message: "Format nomor HP tidak valid.",
                            },
                        })}
                    />
                    {errors.phone ? (
                        <p className="mt-2 text-xs font-medium text-[#B14545]">
                            {errors.phone.message}
                        </p>
                    ) : null}
                </div>

                {status.type === "success" ? (
                    <p className="mt-6 rounded-2xl border border-[#B7D2A4] bg-[#EEF5E6] px-4 py-3 text-sm font-medium leading-6 text-[#365C2A]">
                        {status.message}
                    </p>
                ) : null}

                {status.type === "error" ? (
                    <p className="mt-6 rounded-2xl border border-[#E9C9A6] bg-[#FBF1E4] px-4 py-3 text-sm font-medium leading-6 text-[#8A5A20]">
                        {status.message}
                    </p>
                ) : null}

                {status.type === "info" ? (
                    <p className="mt-6 rounded-2xl border border-[#D8D2C0] bg-[#F3EFE3] px-4 py-3 text-sm font-medium leading-6 text-[#5B5546]">
                        {status.message}
                    </p>
                ) : null}

                {paymentOrderId ? (
                    <Link
                        href={`/payment/${paymentOrderId}`}
                        className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-[#365C2A] px-5 py-3 text-sm font-bold text-[#365C2A] transition hover:bg-[#365C2A] hover:text-[#F8F4EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#365C2A] focus-visible:ring-offset-2"
                    >
                        Cek Status Pembayaran
                    </Link>
                ) : null}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="mt-8 w-full rounded-full bg-[#365C2A] px-5 py-3.5 text-sm font-bold text-[#F8F4EC] transition hover:scale-[1.02] hover:bg-[#2D4D24] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isSubmitting ? status.message : "Daftar Sekarang"}
                </button>
            </form>
        </div>
    );
}
