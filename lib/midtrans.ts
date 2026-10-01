import {
    fetchWithTimeout,
    HttpNetworkError,
    HttpTimeoutError,
    isRetryableHttpStatus,
    parseRetryAfterMs,
} from "@/lib/http-client";
import { getMidtransServerKey, getOutboundHttpConfig } from "@/lib/env";
import { logger } from "@/lib/logger";
import { withRetry } from "@/lib/retry";

export class MidtransConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MidtransConfigError";
    }
}

export class MidtransTimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MidtransTimeoutError";
    }
}

export class MidtransNetworkError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MidtransNetworkError";
    }
}

export class MidtransApiError extends Error {
    status: number;
    retryAfterMs?: number;

    constructor(message: string, status: number, retryAfterMs?: number) {
        super(message);
        this.name = "MidtransApiError";
        this.status = status;
        this.retryAfterMs = retryAfterMs;
    }
}

function classifyMidtransRetry(error: unknown): { retryable: boolean; retryAfterMs?: number } {
    if (error instanceof MidtransTimeoutError || error instanceof MidtransNetworkError) {
        return { retryable: true };
    }

    if (error instanceof MidtransApiError && isRetryableHttpStatus(error.status)) {
        return { retryable: true, retryAfterMs: error.retryAfterMs };
    }

    return { retryable: false };
}

function getBaseUrls(): { snap: string; api: string } {
    const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

    return isProduction
        ? { snap: "https://app.midtrans.com", api: "https://api.midtrans.com" }
        : { snap: "https://app.sandbox.midtrans.com", api: "https://api.sandbox.midtrans.com" };
}

function getAuthorizationHeader(): string {
    const serverKey = getMidtransServerKey();
    return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
}

/**
 * Single HTTP attempt against the Midtrans API. Never logs the
 * response body on error — Midtrans echoes back `customer_details`
 * (name/email/phone) on some error responses, so only status code and
 * a generic Midtrans-reported error message array are surfaced.
 */
async function requestMidtrans<T>(
    url: string,
    init: RequestInit,
    timeoutMs: number,
): Promise<T> {
    let response: Response;

    try {
        response = await fetchWithTimeout(
            url,
            {
                ...init,
                headers: {
                    Accept: "application/json",
                    Authorization: getAuthorizationHeader(),
                    ...init.headers,
                },
                cache: "no-store",
            },
            timeoutMs,
        );
    } catch (error) {
        if (error instanceof HttpTimeoutError) {
            throw new MidtransTimeoutError(`Midtrans request timeout: ${init.method ?? "GET"}`);
        }
        if (error instanceof HttpNetworkError) {
            throw new MidtransNetworkError(`Midtrans network error: ${init.method ?? "GET"}`);
        }
        throw error;
    }

    let result: unknown;
    try {
        result = await response.json();
    } catch {
        throw new MidtransApiError(
            "Midtrans mengembalikan response yang tidak valid",
            response.status,
        );
    }

    if (!response.ok) {
        const statusMessage =
            typeof result === "object" && result !== null && "status_message" in result
                ? String((result as { status_message: unknown }).status_message)
                : undefined;

        logger.error("Midtrans API error", {
            event: "midtrans.api_error",
            httpStatus: response.status,
            statusMessage,
        });

        throw new MidtransApiError(
            "Midtrans API error",
            response.status,
            parseRetryAfterMs(response.headers.get("retry-after")),
        );
    }

    return result as T;
}

/** Retrying wrapper — only for requests that are safe to repeat. */
async function requestMidtransWithRetry<T>(
    url: string,
    init: RequestInit,
    options: { retryable: boolean },
): Promise<T> {
    const outbound = getOutboundHttpConfig();

    if (!options.retryable) {
        return requestMidtrans<T>(url, init, outbound.timeoutMs);
    }

    return withRetry(() => requestMidtrans<T>(url, init, outbound.timeoutMs), {
        maxRetries: outbound.maxRetries,
        baseDelayMs: outbound.retryBaseDelayMs,
        isRetryable: classifyMidtransRetry,
        onRetry: (attempt, delayMs) => {
            logger.warn("Midtrans API retry", {
                event: "midtrans.api_retry",
                attempt,
                delayMs,
            });
        },
    });
}

type SnapTransactionInput = {
    orderId: string;
    amount: number;
    customer: {
        name: string;
        email: string;
        phone?: string | null;
    };
};

type SnapTransactionResult = {
    token: string;
    redirect_url: string;
};

/**
 * Creates a Snap transaction. Not retried automatically: Midtrans does
 * not guarantee `order_id`-based idempotency on this endpoint the way
 * a payment-creation call ideally should, so a blind retry after an
 * ambiguous failure (e.g. timeout with the request possibly already
 * received) risks a duplicate-looking transaction. The caller
 * (`POST /api/payments`) is itself made safe for client-side retries
 * via the `Idempotency-Key` header — see lib/idempotency.ts.
 */
export async function createSnapTransaction({
    orderId,
    amount,
    customer,
}: SnapTransactionInput): Promise<SnapTransactionResult> {
    const { snap: baseUrl } = getBaseUrls();

    return requestMidtransWithRetry<SnapTransactionResult>(
        `${baseUrl}/snap/v1/transactions`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                transaction_details: {
                    order_id: orderId,
                    gross_amount: amount,
                },
                customer_details: {
                    first_name: customer.name,
                    email: customer.email,
                    phone: customer.phone || undefined,
                },
                credit_card: {
                    secure: true,
                },
            }),
        },
        { retryable: false },
    );
}

export type MidtransTransactionStatus = {
    order_id: string;
    transaction_id: string;
    transaction_status: string;
    status_code: string;
    gross_amount: string;
    payment_type?: string;
    fraud_status?: string;
    signature_key?: string;
    // Present when transaction_status is "refund" or "partial_refund" —
    // cumulative amount refunded so far, per Midtrans transaction-status
    // reference.
    refund_amount?: string;
};

/** Read-only status lookup — safe to retry on timeout/network/429/5xx. */
export async function getMidtransTransactionStatus(
    orderId: string,
): Promise<MidtransTransactionStatus> {
    const { api: baseUrl } = getBaseUrls();

    return requestMidtransWithRetry<MidtransTransactionStatus>(
        `${baseUrl}/v2/${encodeURIComponent(orderId)}/status`,
        { method: "GET" },
        { retryable: true },
    );
}
