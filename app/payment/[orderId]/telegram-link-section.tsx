"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 4000;

type LinkStatusResponse = {
    data: { linked: boolean; linkedAt: string | null };
};

type CreateLinkResponse = {
    data:
        | { linked: true; deepLink: null }
        | { linked: false; deepLink: string; expiresAt: string };
};

type LinkState =
    | { phase: "checking" }
    | { phase: "idle" }
    | { phase: "generating" }
    | { phase: "waiting"; deepLink: string; expiresAt: string }
    | { phase: "expired" }
    | { phase: "linked" }
    | { phase: "error"; message: string };

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
});

const PRIMARY_BUTTON_CLASSNAME =
    "inline-flex items-center justify-center rounded-full bg-[#365C2A] px-5 py-3 text-sm font-bold text-[#F8F4EC] transition hover:bg-[#2D4D24] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#365C2A] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

type TelegramLinkSectionProps = {
    orderId: string;
    onLinkedChange?: (linked: boolean) => void;
};

export function TelegramLinkSection({
    orderId,
    onLinkedChange,
}: TelegramLinkSectionProps) {
    const [state, setState] = useState<LinkState>({ phase: "checking" });

    const mountedRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pollingRef = useRef(false);
    const phaseRef = useRef<LinkState["phase"]>(state.phase);
    const expiresAtRef = useRef<string | null>(null);

    useEffect(() => {
        phaseRef.current = state.phase;
        expiresAtRef.current = state.phase === "waiting" ? state.expiresAt : null;
    }, [state]);

    const onLinkedChangeRef = useRef(onLinkedChange);

    useEffect(() => {
        onLinkedChangeRef.current = onLinkedChange;
    }, [onLinkedChange]);

    useEffect(() => {
        onLinkedChangeRef.current?.(state.phase === "linked");
    }, [state.phase]);

    const clearScheduledPoll = useCallback(() => {
        pollingRef.current = false;
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const fetchLinkStatus = useCallback(async (): Promise<boolean> => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const response = await fetch(
            `/api/telegram/link-status?orderId=${encodeURIComponent(orderId)}`,
            { cache: "no-store", signal: controller.signal },
        );

        if (!response.ok) {
            throw new Error("Gagal memuat status Telegram");
        }

        const result = (await response.json()) as LinkStatusResponse;
        return result.data.linked;
    }, [orderId]);

    const schedulePoll = useCallback(() => {
        if (pollingRef.current) return; // never stack duplicate poll chains
        pollingRef.current = true;

        const tick = async () => {
            if (!mountedRef.current || phaseRef.current !== "waiting") {
                pollingRef.current = false;
                return;
            }

            if (
                expiresAtRef.current &&
                Date.now() >= new Date(expiresAtRef.current).getTime()
            ) {
                clearScheduledPoll();
                setState({ phase: "expired" });
                return;
            }

            try {
                const linked = await fetchLinkStatus();

                if (!mountedRef.current) return;

                if (linked) {
                    clearScheduledPoll();
                    setState({ phase: "linked" });
                    return;
                }
            } catch {
                // Transient network hiccup — keep polling silently.
            }

            if (!mountedRef.current || phaseRef.current !== "waiting") {
                pollingRef.current = false;
                return;
            }

            timeoutRef.current = setTimeout(tick, POLL_INTERVAL_MS);
        };

        timeoutRef.current = setTimeout(tick, POLL_INTERVAL_MS);
    }, [fetchLinkStatus, clearScheduledPoll]);

    useEffect(() => {
        mountedRef.current = true;

        fetchLinkStatus()
            .then((linked) => {
                if (!mountedRef.current) return;
                setState(linked ? { phase: "linked" } : { phase: "idle" });
            })
            .catch(() => {
                if (!mountedRef.current) return;
                setState({
                    phase: "error",
                    message: "Gagal memuat status Telegram.",
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
                phaseRef.current !== "waiting"
            ) {
                return;
            }

            fetchLinkStatus()
                .then((linked) => {
                    if (!mountedRef.current) return;
                    if (linked) {
                        clearScheduledPoll();
                        setState({ phase: "linked" });
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
    }, [fetchLinkStatus, clearScheduledPoll]);

    const handleConnect = useCallback(async () => {
        clearScheduledPoll();
        setState({ phase: "generating" });

        try {
            const response = await fetch("/api/telegram/link", {
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

            if (!response.ok) {
                throw new Error("Gagal membuat tautan Telegram");
            }

            const result = (await response.json()) as CreateLinkResponse;

            if (!mountedRef.current) return;

            if (result.data.linked) {
                setState({ phase: "linked" });
                return;
            }

            setState({
                phase: "waiting",
                deepLink: result.data.deepLink,
                expiresAt: result.data.expiresAt,
            });

            if (typeof window !== "undefined") {
                window.open(result.data.deepLink, "_blank", "noopener,noreferrer");
            }

            schedulePoll();
        } catch {
            if (!mountedRef.current) return;
            setState({
                phase: "error",
                message: "Gagal membuat tautan Telegram. Silakan coba lagi.",
            });
        }
    }, [orderId, clearScheduledPoll, schedulePoll]);

    return (
        <div className="rounded-2xl border border-[#D8D2C0] bg-white px-4 py-4">
            <h3 className="text-base font-extrabold text-[#102016]">
                Hubungkan akun Telegram
            </h3>
            <p className="mt-1 text-sm leading-6 text-[#3C4636]">
                Hubungkan akun Telegram yang akan digunakan untuk mengakses
                private channel.
            </p>

            <div className="mt-4">
                {state.phase === "checking" ? (
                    <p className="text-sm text-[#8A8467]">
                        Memeriksa status Telegram…
                    </p>
                ) : null}

                {state.phase === "idle" ? (
                    <button
                        type="button"
                        onClick={handleConnect}
                        className={PRIMARY_BUTTON_CLASSNAME}
                    >
                        Hubungkan Akun Telegram
                    </button>
                ) : null}

                {state.phase === "generating" ? (
                    <div className="flex items-center gap-2 text-sm text-[#5B5546]">
                        <span
                            aria-hidden="true"
                            className="h-4 w-4 animate-spin rounded-full border-2 border-[#D8D2C0] border-t-[#5B5546]"
                        />
                        Menyiapkan tautan Telegram…
                    </div>
                ) : null}

                {state.phase === "waiting" ? (
                    <div className="space-y-3">
                        <a
                            href={state.deepLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={PRIMARY_BUTTON_CLASSNAME}
                        >
                            Buka Telegram
                        </a>
                        <div
                            role="status"
                            aria-live="polite"
                            className="flex items-center gap-2 text-sm text-[#5B5546]"
                        >
                            <span
                                aria-hidden="true"
                                className="h-3 w-3 animate-spin rounded-full border-2 border-[#D8D2C0] border-t-[#5B5546]"
                            />
                            Menunggu akun Telegram dihubungkan…
                        </div>
                        <p className="text-xs text-[#8A8467]">
                            Tautan berlaku sampai{" "}
                            {dateFormatter.format(new Date(state.expiresAt))}.
                        </p>
                    </div>
                ) : null}

                {state.phase === "expired" ? (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-[#B14545]">
                            Tautan sudah kedaluwarsa.
                        </p>
                        <button
                            type="button"
                            onClick={handleConnect}
                            className={PRIMARY_BUTTON_CLASSNAME}
                        >
                            Buat tautan baru
                        </button>
                    </div>
                ) : null}

                {state.phase === "linked" ? (
                    <p className="rounded-2xl border border-[#B7D2A4] bg-[#EEF5E6] px-4 py-3 text-sm leading-6 text-[#365C2A]">
                        Akun Telegram berhasil terhubung.
                    </p>
                ) : null}

                {state.phase === "error" ? (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold text-[#B14545]">
                            {state.message}
                        </p>
                        <button
                            type="button"
                            onClick={handleConnect}
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
