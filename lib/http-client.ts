/**
 * Low-level outbound HTTP primitives shared by the Midtrans and
 * Telegram clients (Milestone 15 §6/§7): a bounded-timeout fetch that
 * tells a genuine network failure apart from an aborted-due-to-timeout
 * one, plus a small helper for reading `Retry-After`.
 *
 * Never logs the request URL, headers, or body here — those may
 * contain API keys/tokens; callers are responsible for logging only
 * safe, already-redacted fields.
 */

export class HttpTimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "HttpTimeoutError";
    }
}

export class HttpNetworkError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "HttpNetworkError";
    }
}

/**
 * `fetch` with an `AbortController`-backed timeout. Distinguishes an
 * abort caused by our own timeout (`HttpTimeoutError`) from any other
 * fetch-level failure — DNS, TLS, connection reset — (`HttpNetworkError`).
 * A non-2xx HTTP response is returned normally; callers decide how to
 * treat status codes since "retryable" differs per API.
 */
export async function fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new HttpTimeoutError(`Request timeout after ${timeoutMs}ms: ${url}`);
        }

        throw new HttpNetworkError(
            `Network error: ${error instanceof Error ? error.message : "unknown"}`,
        );
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Parses a `Retry-After` header value (seconds, or an HTTP-date) into
 * milliseconds. Returns `undefined` when absent/unparsable so callers
 * fall back to their own computed backoff.
 */
export function parseRetryAfterMs(headerValue: string | null): number | undefined {
    if (!headerValue) return undefined;

    const seconds = Number(headerValue);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return seconds * 1000;
    }

    const dateMs = Date.parse(headerValue);
    if (!Number.isNaN(dateMs)) {
        const deltaMs = dateMs - Date.now();
        return deltaMs > 0 ? deltaMs : 0;
    }

    return undefined;
}

export function isRetryableHttpStatus(status: number): boolean {
    return status === 429 || (status >= 500 && status <= 599);
}
