import { randomUUID } from "node:crypto";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Correlation ID for a single inbound request — reused from an
 * upstream proxy's `X-Request-Id` if present (trimmed/bounded to avoid
 * a client stuffing an oversized or malformed value into logs),
 * otherwise generated fresh. Attach the returned value to both log
 * lines (`logger.*({ requestId })`) and the response header so a user
 * report ("it failed around 10:32") can be traced through logs and
 * error monitoring.
 */
export function getRequestId(request: Request): string {
    const incoming = request.headers.get(REQUEST_ID_HEADER);

    if (incoming && /^[A-Za-z0-9_-]{1,128}$/.test(incoming)) {
        return incoming;
    }

    return randomUUID();
}

export function withRequestIdHeader(
    headers: HeadersInit | undefined,
    requestId: string,
): Headers {
    const result = new Headers(headers);
    result.set(REQUEST_ID_HEADER, requestId);
    return result;
}

/** Best-effort client IP for rate limiting — never used for anything security-authoritative beyond that. */
export function getClientIp(request: Request): string {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
        return forwardedFor.split(",")[0]!.trim();
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp.trim();

    return "unknown";
}
