"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 4000;

type PaymentStatus =
    | "PENDING"
    | "PAID"
    | "EXPIRED"
    | "CANCELLED"
    | "FAILED"
    | "REFUNDED"
    | "PARTIALLY_REFUNDED"
    | "CHARGEBACK";

type OrderData = {
    orderId: string;
    orderNumber: string;
    status: PaymentStatus;
    amount: number;
    paidAt: string | null;
    createdAt: string;
    updatedAt: string;
};

type OrderApiResponse = {
    data: OrderData;
};

type FetchState =
    | { phase: "loading" }
    | { phase: "not-found" }
    | { phase: "error" }
    | { phase: "ready"; order: OrderData };

const FINAL_STATUSES: PaymentStatus[] = [
    "PAID",
    "EXPIRED",
    "CANCELLED",
    "FAILED",
    "REFUNDED",
    "PARTIALLY_REFUNDED",
    "CHARGEBACK",
];

const currencyFormatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
});

type StatusPresentation = {
    title: string;
    description: string;
    badgeClassName: string;
    icon: string;
};

const STATUS_PRESENTATION: Record<PaymentStatus, StatusPresentation> = {
    PENDING: {
        title: "Menunggu pembayaran",
        description: "Kami sedang menunggu konfirmasi pembayaran dari Midtrans.",
        badgeClassName: "border-[#D8D2C0] bg-[#F3EFE3] text-[#5B5546]",
        icon: "⏳",
    },
    PAID: {
        title: "Pembayaran berhasil",
        description: "Pembayaran sudah dikonfirmasi.",
        badgeClassName: "border-[#B7D2A4] bg-[#EEF5E6] text-[#365C2A]",
        icon: "✅",
    },
    EXPIRED: {
        title: "Pembayaran kedaluwarsa",
        description: "Waktu pembayaran sudah berakhir.",
        badgeClassName: "border-[#E9C9A6] bg-[#FBF1E4] text-[#8A5A20]",
        icon: "⌛",
    },
    CANCELLED: {
        title: "Pembayaran dibatalkan",
        description: "Transaksi ini sudah dibatalkan.",
        badgeClassName: "border-[#D8D2C0] bg-[#F3EFE3] text-[#5B5546]",
        icon: "✕",
    },
    FAILED: {
        title: "Pembayaran gagal",
        description: "Pembayaran tidak dapat diproses.",
        badgeClassName: "border-[#E3B4B4] bg-[#FBEAEA] text-[#B14545]",
        icon: "⚠️",
    },
    REFUNDED: {
        title: "Pembayaran dikembalikan",
        description: "Dana transaksi ini sudah dikembalikan.",
        badgeClassName: "border-[#C6D3E8] bg-[#EBF0FA] text-[#385480]",
        icon: "↩️",
    },
    PARTIALLY_REFUNDED: {
        title: "Sebagian pembayaran dikembalikan",
        description: "Sebagian dana transaksi sudah dikembalikan.",
        badgeClassName: "border-[#C6D3E8] bg-[#EBF0FA] text-[#385480]",
        icon: "↩️",
    },
    CHARGEBACK: {
        title: "Pembayaran mengalami chargeback",
        description: "Silakan hubungi customer support.",
        badgeClassName: "border-[#E3B4B4] bg-[#FBEAEA] text-[#B14545]",
        icon: "⚠️",
    },
};

const FALLBACK_PRESENTATION: StatusPresentation = {
    title: "Status tidak diketahui",
    description:
        "Kami tidak dapat mengenali status pembayaran ini. Silakan hubungi customer support.",
    badgeClassName: "border-[#D8D2C0] bg-[#F3EFE3] text-[#5B5546]",
    icon: "❓",
};

function isFinalStatus(status: PaymentStatus): boolean {
    return FINAL_STATUSES.includes(status);
}

type PaymentStatusClientProps = {
    orderId: string;
};

export function PaymentStatusClient({ orderId }: PaymentStatusClientProps) {
    const [state, setState] = useState<FetchState>({ phase: "loading" });
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(false);

    const clearScheduledPoll = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const fetchOrder = useCallback(
        async (options?: { silent?: boolean }) => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            if (!options?.silent) {
                setState({ phase: "loading" });
            }

            try {
                const response = await fetch(
                    `/api/orders/${encodeURIComponent(orderId)}`,
                    {
                        cache: "no-store",
                        signal: controller.signal,
                    },
                );

                if (response.status === 404) {
                    if (!mountedRef.current) return;
                    setState({ phase: "not-found" });
                    return;
                }

                if (!response.ok) {
                    throw new Error("Gagal memuat status pembayaran");
                }

                const result = (await response.json()) as OrderApiResponse;

                if (!mountedRef.current) return;

                setState({ phase: "ready", order: result.data });

                if (!isFinalStatus(result.data.status)) {
                    timeoutRef.current = setTimeout(() => {
                        fetchOrder({ silent: true });
                    }, POLL_INTERVAL_MS);
                }
            } catch (error) {
                if (controller.signal.aborted) return;
                if (!mountedRef.current) return;

                console.error("Gagal memuat status order");
                setState({ phase: "error" });
            }
        },
        [orderId],
    );

    useEffect(() => {
        mountedRef.current = true;
        fetchOrder();

        return () => {
            mountedRef.current = false;
            clearScheduledPoll();
            abortRef.current?.abort();
        };
    }, [fetchOrder, clearScheduledPoll]);

    const handleRetry = useCallback(() => {
        fetchOrder();
    }, [fetchOrder]);

    return (
        <div className="mx-auto max-w-xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#365C2A]">
                Status Pembayaran
            </p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
                Cek Status Pembayaranmu
            </h1>
            <p className="mt-3 max-w-lg text-base leading-7 text-[#3C4636] md:text-lg">
                Halaman ini akan memperbarui status pembayaran secara otomatis.
            </p>

            <div
                role="status"
                aria-live="polite"
                className="mt-10 min-h-[320px] rounded-[32px] border border-[#E4DDCE] bg-[#FBF8F1] p-6 shadow-[0_18px_54px_rgba(28,37,19,0.08)] sm:p-8"
            >
                {state.phase === "loading" ? <LoadingIndicator /> : null}
                {state.phase === "not-found" ? <NotFoundState /> : null}
                {state.phase === "error" ? <ErrorState onRetry={handleRetry} /> : null}
                {state.phase === "ready" ? <OrderDetails order={state.order} /> : null}
            </div>

            <div className="mt-8 text-center">
                <Link
                    href="/"
                    className="inline-flex rounded-full border border-[#365C2A] px-5 py-3 text-sm font-bold text-[#365C2A] transition hover:bg-[#365C2A] hover:text-[#F8F4EC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#365C2A] focus-visible:ring-offset-2"
                >
                    Kembali ke Beranda
                </Link>
            </div>
        </div>
    );
}

function LoadingIndicator() {
    return (
        <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
            <span
                aria-hidden="true"
                className="h-10 w-10 animate-spin rounded-full border-4 border-[#E4DDCE] border-t-[#365C2A]"
            />
            <p className="text-sm font-semibold text-[#3C4636]">
                Memuat status pembayaran…
            </p>
        </div>
    );
}

function NotFoundState() {
    return (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span aria-hidden="true" className="text-4xl">
                🔍
            </span>
            <h2 className="text-xl font-bold text-[#102016]">
                Pesanan tidak ditemukan
            </h2>
            <p className="max-w-sm text-sm leading-6 text-[#3C4636]">
                Kami tidak dapat menemukan data pembayaran untuk tautan ini.
                Pastikan tautan yang kamu buka sudah benar.
            </p>
        </div>
    );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span aria-hidden="true" className="text-4xl">
                ⚠️
            </span>
            <h2 className="text-xl font-bold text-[#102016]">
                Gagal memuat status pembayaran
            </h2>
            <p className="max-w-sm text-sm leading-6 text-[#3C4636]">
                Terjadi kesalahan saat mengambil data. Periksa koneksi
                internetmu lalu coba lagi.
            </p>
            <button
                type="button"
                onClick={onRetry}
                className="mt-2 rounded-full bg-[#365C2A] px-5 py-3 text-sm font-bold text-[#F8F4EC] transition hover:bg-[#2D4D24] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#365C2A] focus-visible:ring-offset-2"
            >
                Coba lagi
            </button>
        </div>
    );
}

function OrderDetails({ order }: { order: OrderData }) {
    const presentation =
        STATUS_PRESENTATION[order.status] ?? FALLBACK_PRESENTATION;
    const isPending = order.status === "PENDING";
    const isPaid = order.status === "PAID";

    return (
        <div className="space-y-6">
            <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8A8467]">
                    Nomor Pesanan
                </p>
                <p className="mt-1 text-lg font-extrabold text-[#102016]">
                    {order.orderNumber}
                </p>
            </div>

            <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8A8467]">
                    Nominal Pembayaran
                </p>
                <p className="mt-1 text-2xl font-extrabold text-[#102016]">
                    {currencyFormatter.format(order.amount)}
                </p>
            </div>

            <div
                className={`flex items-start gap-3 rounded-2xl border px-4 py-4 ${presentation.badgeClassName}`}
            >
                <span aria-hidden="true" className="text-2xl leading-none">
                    {presentation.icon}
                </span>
                <div>
                    <p className="font-bold">{presentation.title}</p>
                    <p className="mt-1 text-sm leading-6">
                        {presentation.description}
                    </p>
                    {isPending ? (
                        <div className="mt-3 flex items-center gap-2 text-sm">
                            <span
                                aria-hidden="true"
                                className="h-4 w-4 animate-spin rounded-full border-2 border-[#D8D2C0] border-t-[#5B5546]"
                            />
                            <span>
                                Memeriksa status pembayaran secara berkala…
                            </span>
                        </div>
                    ) : null}
                </div>
            </div>

            {isPaid && order.paidAt ? (
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8A8467]">
                        Waktu Pembayaran
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#102016]">
                        {dateFormatter.format(new Date(order.paidAt))}
                    </p>
                </div>
            ) : null}

            {isPaid ? (
                <p className="rounded-2xl border border-[#B7D2A4] bg-[#EEF5E6] px-4 py-3 text-sm leading-6 text-[#365C2A]">
                    Instruksi akses kelas akan segera dikirimkan ke email atau
                    nomor WhatsApp kamu.
                </p>
            ) : null}
        </div>
    );
}
