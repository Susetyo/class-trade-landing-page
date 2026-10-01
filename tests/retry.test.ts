import { describe, expect, it, vi } from "vitest";
import { withRetry } from "@/lib/retry";

class RetryableError extends Error {}
class NonRetryableError extends Error {}

describe("withRetry", () => {
    it("returns the result on first success without retrying", async () => {
        const fn = vi.fn().mockResolvedValue("ok");

        const result = await withRetry(fn, {
            maxRetries: 3,
            baseDelayMs: 1,
            isRetryable: () => ({ retryable: true }),
        });

        expect(result).toBe("ok");
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries a retryable error up to maxRetries then throws", async () => {
        const fn = vi.fn().mockRejectedValue(new RetryableError("timeout"));

        await expect(
            withRetry(fn, {
                maxRetries: 2,
                baseDelayMs: 1,
                isRetryable: (error) => ({ retryable: error instanceof RetryableError }),
            }),
        ).rejects.toBeInstanceOf(RetryableError);

        // 1 initial attempt + 2 retries = 3 calls total.
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it("does not retry a non-retryable error", async () => {
        const fn = vi.fn().mockRejectedValue(new NonRetryableError("bad request"));

        await expect(
            withRetry(fn, {
                maxRetries: 5,
                baseDelayMs: 1,
                isRetryable: (error) => ({ retryable: error instanceof RetryableError }),
            }),
        ).rejects.toBeInstanceOf(NonRetryableError);

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("succeeds after a transient failure within the retry budget", async () => {
        const fn = vi
            .fn()
            .mockRejectedValueOnce(new RetryableError("timeout"))
            .mockResolvedValueOnce("recovered");

        const result = await withRetry(fn, {
            maxRetries: 2,
            baseDelayMs: 1,
            isRetryable: () => ({ retryable: true }),
        });

        expect(result).toBe("recovered");
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it("respects an explicit retryAfterMs over computed backoff", async () => {
        const fn = vi.fn().mockRejectedValueOnce(new RetryableError()).mockResolvedValueOnce("ok");
        const onRetry = vi.fn();

        await withRetry(fn, {
            maxRetries: 1,
            baseDelayMs: 5_000,
            isRetryable: () => ({ retryable: true, retryAfterMs: 1 }),
            onRetry,
        });

        expect(onRetry).toHaveBeenCalledWith(1, 1, expect.any(RetryableError));
    });
});
