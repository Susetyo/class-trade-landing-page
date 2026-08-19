"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 4000;

type ChannelAccessStatusValue =
    | "ELIGIBLE"
    | "INVITED"
    | "REQUESTED"
    | "GRANTED"
    | "REVOKED"
    | "FAILED"
    | "REVOCATION_PENDING"
    | "REVOCATION_FAILED"
    | "MANUAL_REVIEW";

type ChannelAccessStatusResponse = {
    success: true;
    paid: boolean;
    telegramLinked: boolean;
    accessStatus: ChannelAccessStatusValue | null;
    inviteExpiresAt: string | null;
    grantedAt: string | null;
    revokedAt: string | null;
};

type ChannelAccessActionResponse = {
    success: true;
    status: ChannelAccessStatusValue;
    inviteUrl: string | null;
    expiresAt: string | null;
};

type ChannelAccessErrorResponse = {
    success: false;
    message: string;
};

type ChannelAccessState =
    | { phase: "checking" }
    | { phase: "idle" }
    | { phase: "requesting" }
    | { phase: "invited"; expiresAt: string }
    | { phase: "requested" }
    | { phase: "expired" }
    | { phase: "granted" }
    | { phase: "revoking" }
    | { phase: "revoked" }
    | { phase: "revocation-retry" }
    | { phase: "manual-review" }
    | { phase: "error"; message: string };

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
});

const PRIMARY_BUTTON_CLASSNAME =
    "inline-flex items-center justify-center rounded-full bg-[#365C2A] px-5 py-3 text-sm font-bold text-[#F8F4EC] transition hover:bg-[#2D4D24] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#365C2A] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

function isWaitingPhase(phase: ChannelAccessState["phase"]): boolean {
    return (
        phase === "invited" ||
        phase === "requested" ||
        phase === "revoking" ||
        phase === "revocation-retry"
    );
}

function deriveState(
    status: ChannelAccessStatusResponse,
): ChannelAccessState {
    // Revocation-lifecycle states are reported regardless of the
    // current `paid`/`telegramLinked` flags — payment is no longer
    // PAID by the time these are set, but the user still needs to see
    // what happened to their access.
    switch (status.accessStatus) {
        case "REVOCATION_PENDING":
            return { phase: "revoking" };
        case "REVOKED":
            return { phase: "revoked" };
        case "REVOCATION_FAILED":
            return { phase: "revocation-retry" };
        case "MANUAL_REVIEW":
            return { phase: "manual-review" };
        default:
            break;
    }

    if (!status.paid || !status.telegramLinked) {
        return { phase: "idle" };
    }

    switch (status.accessStatus) {
        case null:
        case "ELIGIBLE":
        case "FAILED":
            return { phase: "idle" };
        case "REQUESTED":
            return { phase: "requested" };
        case "GRANTED":
            return { phase: "granted" };
        case "INVITED": {
            if (
                status.inviteExpiresAt &&
                new Date(status.inviteExpiresAt).getTime() <= Date.now()
            ) {
                return { phase: "expired" };
            }
            return {
                phase: "invited",
                expiresAt: status.inviteExpiresAt ?? "",
            };
        }
        default:
            return { phase: "idle" };
    }
}

type TelegramChannelAccessSectionProps = {
    orderId: string;
};

export function TelegramChannelAccessSection({
    orderId,
}: TelegramChannelAccessSectionProps) {
    const [state, setState] = useState<ChannelAccessState>({
        phase: "checking",
    });

    const mountedRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pollingRef = useRef(false);
    const phaseRef = useRef<ChannelAccessState["phase"]>(state.phase);

    useEffect(() => {
        phaseRef.current = state.phase;
    }, [state.phase]);

    const clearScheduledPoll = useCallback(() => {
        pollingRef.current = false;
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const fetchStatus =
        useCallback(async (): Promise<ChannelAccessStatusResponse> => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;

            const response = await fetch(
                `/api/telegram/channel-access?orderId=${encodeURIComponent(orderId)}`,
                { cache: "no-store", signal: controller.signal },
            );

            if (!response.ok) {
                throw new Error("Gagal memuat status akses channel");
            }

            return (await response.json()) as ChannelAccessStatusResponse;
        }, [orderId]);

    const schedulePoll = useCallback(() => {
        if (pollingRef.current) return; // never stack duplicate poll chains
        pollingRef.current = true;

        const tick = async () => {
            if (!mountedRef.current || !isWaitingPhase(phaseRef.current)) {
                pollingRef.current = false;
                return;
            }

            try {
                const status = await fetchStatus();
                if (!mountedRef.current) return;

                const next = deriveState(status);
                setState(next);

                if (!isWaitingPhase(next.phase)) {
                    clearScheduledPoll();
                    return;
                }
            } catch {
                // Transient network hiccup — keep polling silently.
            }

            if (!mountedRef.current || !isWaitingPhase(phaseRef.current)) {
                pollingRef.current = false;
                return;
            }

            timeoutRef.current = setTimeout(tick, POLL_INTERVAL_MS);
        };

        timeoutRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    }, [fetchStatus, clearScheduledPoll]);

    useEffect(() => {
        mountedRef.current = true;

        fetchStatus()
            .then((status) => {
                if (!mountedRef.current) return;
                const next = deriveState(status);
                setState(next);
                if (isWaitingPhase(next.phase)) {
                    schedulePoll();
                }
            })
            .catch(() => {
                if (!mountedRef.current) return;
                setState({
                    phase: "error",
                    message: "Gagal memuat status akses channel.",
                });
            });

        return () => {
            mountedRef.current = false;
            clearScheduledPoll();
            abortRef.current?.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        function handleVisibilityChange() {
            if (
                document.visibilityState !== "visible" ||
                !isWaitingPhase(phaseRef.current)
            ) {
                return;
            }

            fetchStatus()
                .then((status) => {
                    if (!mountedRef.current) return;
                    const next = deriveState(status);
                    setState(next);
                    if (!isWaitingPhase(next.phase)) {
                        clearScheduledPoll();
                    }
                })
                .catch(() => {
                    // The regular poll loop will retry.
                });
        }

        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );
        };
    }, [fetchStatus, clearScheduledPoll]);

    const handleRequestAccess = useCallback(async () => {
        clearScheduledPoll();
        setState({ phase: "requesting" });

        try {
            const response = await fetch("/api/telegram/channel-access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                cache: "no-store",
                body: JSON.stringify({ orderId }),
            });

            if (response.status === 429) {
                if (!mountedRef.current) return;
                setState({
                    phase: "error",
                    message:
                        "Terlalu banyak permintaan. Silakan coba lagi sebentar.",
                });
                return;
            }

            const body = (await response.json().catch(() => null)) as
                | ChannelAccessActionResponse
                | ChannelAccessErrorResponse
                | null;

            if (!response.ok || !body || body.success === false) {
                throw new Error(
                    body && body.success === false
                        ? body.message
                        : "Gagal memproses permintaan akses channel.",
                );
            }

            if (!mountedRef.current) return;

            if (body.status === "GRANTED") {
                setState({ phase: "granted" });
                return;
            }

            if (body.status === "INVITED" && body.inviteUrl) {
                setState({
                    phase: "invited",
                    expiresAt: body.expiresAt ?? "",
                });

                if (typeof window !== "undefined") {
                    window.open(
                        body.inviteUrl,
                        "_blank",
                        "noopener,noreferrer",
                    );
                }

                schedulePoll();
                return;
            }

            // Unexpected but non-error status — fall back to a fresh
            // status read rather than guessing.
            const status = await fetchStatus();
            if (!mountedRef.current) return;
            const next = deriveState(status);
            setState(next);
            if (isWaitingPhase(next.phase)) {
                schedulePoll();
            }
        } catch (error) {
            if (!mountedRef.current) return;
            setState({
                phase: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Gagal memproses permintaan akses channel.",
            });
        }
    }, [orderId, clearScheduledPoll, schedulePoll, fetchStatus]);

    return (
        <div className="rounded-2xl border border-[#D8D2C0] bg-white px-4 py-4">
            <h3 className="text-base font-extrabold text-[#102016]">
                Akses Private Channel
            </h3>

            <div className="mt-4">
                {state.phase === "checking" ? (
                    <p className="text-sm text-[#8A8467]">
                        Memeriksa status akses channel…
                    </p>
                ) : null}

                {state.phase === "idle" ? (
                    <div className="space-y-2">
                        <p className="text-sm leading-6 text-[#3C4636]">
                            Akun Telegram kamu sudah terhubung. Tekan tombol
                            di bawah untuk membuat tautan bergabung ke
                            private channel.
                        </p>
                        <button
                            type="button"
                            onClick={handleRequestAccess}
                            className={PRIMARY_BUTTON_CLASSNAME}
                        >
                            Dapatkan Akses Channel
                        </button>
                    </div>
                ) : null}

                {state.phase === "requesting" ? (
                    <div className="flex items-center gap-2 text-sm text-[#5B5546]">
                        <span
                            aria-hidden="true"
                            className="h-4 w-4 animate-spin rounded-full border-2 border-[#D8D2C0] border-t-[#5B5546]"
                        />
                        Menyiapkan akses channel…
                    </div>
                ) : null}

                {state.phase === "invited" ? (
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={handleRequestAccess}
                            className={PRIMARY_BUTTON_CLASSNAME}
                        >
                            Ajukan Bergabung ke Private Channel
                        </button>
                        <p className="text-sm leading-6 text-[#3C4636]">
                            Tekan tombol join/request di Telegram — bot akan
                            memverifikasi permintaan kamu secara otomatis.
                        </p>
                        {state.expiresAt ? (
                            <p className="text-xs text-[#8A8467]">
                                Tautan berlaku sampai{" "}
                                {dateFormatter.format(
                                    new Date(state.expiresAt),
                                )}
                                .
                            </p>
                        ) : null}
                    </div>
                ) : null}

                {state.phase === "requested" ? (
                    <div
                        role="status"
                        aria-live="polite"
                        className="flex items-center gap-2 text-sm text-[#5B5546]"
                    >
                        <span
                            aria-hidden="true"
                            className="h-3 w-3 animate-spin rounded-full border-2 border-[#D8D2C0] border-t-[#5B5546]"
                        />
                        Menunggu permintaan bergabung dari Telegram
                    </div>
                ) : null}

                {state.phase === "expired" ? (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-[#B14545]">
                            Tautan sudah kedaluwarsa.
                        </p>
                        <button
                            type="button"
                            onClick={handleRequestAccess}
                            className={PRIMARY_BUTTON_CLASSNAME}
                        >
                            Buat tautan baru
                        </button>
                    </div>
                ) : null}

                {state.phase === "granted" ? (
                    <p className="rounded-2xl border border-[#B7D2A4] bg-[#EEF5E6] px-4 py-3 text-sm leading-6 text-[#365C2A]">
                        Akses private channel sudah diberikan.
                    </p>
                ) : null}

                {state.phase === "revoking" ? (
                    <div
                        role="status"
                        aria-live="polite"
                        className="flex items-center gap-2 rounded-2xl border border-[#D8D2C0] bg-[#F3EFE3] px-4 py-3 text-sm leading-6 text-[#5B5546]"
                    >
                        <span
                            aria-hidden="true"
                            className="h-3 w-3 animate-spin rounded-full border-2 border-[#D8D2C0] border-t-[#5B5546]"
                        />
                        Akses private channel sedang dinonaktifkan.
                    </div>
                ) : null}

                {state.phase === "revoked" ? (
                    <p className="rounded-2xl border border-[#C6D3E8] bg-[#EBF0FA] px-4 py-3 text-sm leading-6 text-[#385480]">
                        Akses private channel telah dinonaktifkan karena
                        pembayaran tidak lagi memenuhi persyaratan akses.
                    </p>
                ) : null}

                {state.phase === "manual-review" ? (
                    <p className="rounded-2xl border border-[#D8D2C0] bg-[#F3EFE3] px-4 py-3 text-sm leading-6 text-[#5B5546]">
                        Status akses sedang diperiksa. Silakan hubungi
                        administrator jika status tidak berubah.
                    </p>
                ) : null}

                {state.phase === "revocation-retry" ? (
                    <div
                        role="status"
                        aria-live="polite"
                        className="flex items-center gap-2 rounded-2xl border border-[#D8D2C0] bg-[#F3EFE3] px-4 py-3 text-sm leading-6 text-[#5B5546]"
                    >
                        <span
                            aria-hidden="true"
                            className="h-3 w-3 animate-spin rounded-full border-2 border-[#D8D2C0] border-t-[#5B5546]"
                        />
                        Pembaruan akses sedang diproses. Silakan periksa
                        kembali beberapa saat lagi.
                    </div>
                ) : null}

                {state.phase === "error" ? (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-[#B14545]">
                            {state.message}
                        </p>
                        <button
                            type="button"
                            onClick={handleRequestAccess}
                            className={PRIMARY_BUTTON_CLASSNAME}
                        >
                            Coba lagi
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
