import { afterEach, describe, expect, it, vi } from "vitest";
import {
    fetchWithTimeout,
    HttpNetworkError,
    HttpTimeoutError,
    isRetryableHttpStatus,
    parseRetryAfterMs,
} from "@/lib/http-client";

const originalFetch = global.fetch;

afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
});

describe("fetchWithTimeout", () => {
    it("throws HttpTimeoutError when the request exceeds the timeout", async () => {
        global.fetch = vi.fn().mockImplementation(
            (_url: string, init: RequestInit) =>
                new Promise((_resolve, reject) => {
                    init.signal?.addEventListener("abort", () => {
                        const error = new Error("aborted");
                        error.name = "AbortError";
                        reject(error);
                    });
                }),
        ) as unknown as typeof fetch;

        await expect(fetchWithTimeout("https://example.test", {}, 10)).rejects.toBeInstanceOf(
            HttpTimeoutError,
        );
    });

    it("throws HttpNetworkError on a genuine fetch failure (not a timeout)", async () => {
        global.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed")) as unknown as typeof fetch;

        await expect(fetchWithTimeout("https://example.test", {}, 1_000)).rejects.toBeInstanceOf(
            HttpNetworkError,
        );
    });

    it("resolves normally when the response arrives before the timeout", async () => {
        global.fetch = vi.fn().mockResolvedValue(new Response("ok", { status: 200 })) as unknown as typeof fetch;

        const response = await fetchWithTimeout("https://example.test", {}, 1_000);
        expect(response.status).toBe(200);
    });
});

describe("isRetryableHttpStatus", () => {
    it("treats 429 and 5xx as retryable", () => {
        expect(isRetryableHttpStatus(429)).toBe(true);
        expect(isRetryableHttpStatus(500)).toBe(true);
        expect(isRetryableHttpStatus(503)).toBe(true);
    });

    it("treats other 4xx as non-retryable", () => {
        expect(isRetryableHttpStatus(400)).toBe(false);
        expect(isRetryableHttpStatus(401)).toBe(false);
        expect(isRetryableHttpStatus(404)).toBe(false);
    });
});

describe("parseRetryAfterMs", () => {
    it("parses a numeric seconds value", () => {
        expect(parseRetryAfterMs("2")).toBe(2000);
    });

    it("returns undefined for a missing header", () => {
        expect(parseRetryAfterMs(null)).toBeUndefined();
    });
});
