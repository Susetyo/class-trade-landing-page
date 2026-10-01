import { describe, expect, it } from "vitest";
import { checkRateLimit, InMemoryRateLimitStore } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
    it("allows requests under the limit", async () => {
        const key = `test:${crypto.randomUUID()}`;
        const result = await checkRateLimit({ key, limit: 3, windowMs: 60_000 });
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(2);
    });

    it("returns 429-shaped result with Retry-After once the limit is exceeded", async () => {
        const key = `test:${crypto.randomUUID()}`;

        for (let i = 0; i < 3; i++) {
            const result = await checkRateLimit({ key, limit: 3, windowMs: 60_000 });
            expect(result.allowed).toBe(true);
        }

        const blocked = await checkRateLimit({ key, limit: 3, windowMs: 60_000 });
        expect(blocked.allowed).toBe(false);
        expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("tracks separate keys independently", async () => {
        const keyA = `test:${crypto.randomUUID()}`;
        const keyB = `test:${crypto.randomUUID()}`;

        await checkRateLimit({ key: keyA, limit: 1, windowMs: 60_000 });
        const blockedA = await checkRateLimit({ key: keyA, limit: 1, windowMs: 60_000 });
        const allowedB = await checkRateLimit({ key: keyB, limit: 1, windowMs: 60_000 });

        expect(blockedA.allowed).toBe(false);
        expect(allowedB.allowed).toBe(true);
    });
});

describe("InMemoryRateLimitStore", () => {
    it("resets the counter after the window elapses", async () => {
        const store = new InMemoryRateLimitStore();
        const key = "reset-test";

        const first = await store.increment(key, 10);
        expect(first.count).toBe(1);

        await new Promise((resolve) => setTimeout(resolve, 20));

        const second = await store.increment(key, 10);
        expect(second.count).toBe(1);
    });
});
