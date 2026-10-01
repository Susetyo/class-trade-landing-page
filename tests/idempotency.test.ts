import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { fingerprintPayload, runIdempotent } from "@/lib/idempotency";

const TEST_SCOPE_PREFIX = "test.idempotency";

afterEach(async () => {
    await prisma.idempotencyKey.deleteMany({
        where: { scope: { startsWith: TEST_SCOPE_PREFIX } },
    });
});

function scope(name: string) {
    return `${TEST_SCOPE_PREFIX}.${name}`;
}

describe("runIdempotent", () => {
    it("runs the handler once and returns its result", async () => {
        const key = crypto.randomUUID();
        const handler = vi.fn().mockResolvedValue({ status: 201, body: { orderId: "1" } });

        const outcome = await runIdempotent(
            { scope: scope("run-once"), key, fingerprint: fingerprintPayload({ a: 1 }) },
            handler,
        );

        expect(outcome.kind).toBe("ran");
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("replays the stored response for a repeat request with the same key and payload", async () => {
        const key = crypto.randomUUID();
        const handler = vi.fn().mockResolvedValue({ status: 201, body: { orderId: "abc" } });
        const fingerprint = fingerprintPayload({ registrationId: "reg_1" });

        const first = await runIdempotent(
            { scope: scope("replay"), key, fingerprint },
            handler,
        );
        const second = await runIdempotent(
            { scope: scope("replay"), key, fingerprint },
            handler,
        );

        expect(first.kind).toBe("ran");
        expect(second.kind).toBe("replayed");
        // The handler that creates the order/payment must run exactly
        // once — this is the "duplicate request creates only one
        // record" guarantee.
        expect(handler).toHaveBeenCalledTimes(1);
        if (second.kind === "replayed") {
            expect(second.result.body).toEqual({ orderId: "abc" });
        }
    });

    it("rejects the same key reused with a different payload", async () => {
        const key = crypto.randomUUID();
        const handler = vi.fn().mockResolvedValue({ status: 201, body: {} });

        await runIdempotent(
            { scope: scope("conflict"), key, fingerprint: fingerprintPayload({ a: 1 }) },
            handler,
        );

        const conflict = await runIdempotent(
            { scope: scope("conflict"), key, fingerprint: fingerprintPayload({ a: 2 }) },
            handler,
        );

        expect(conflict.kind).toBe("conflict");
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("releases the reservation on handler failure so a retry can proceed", async () => {
        const key = crypto.randomUUID();
        const fingerprint = fingerprintPayload({ a: 1 });
        const failingHandler = vi.fn().mockRejectedValue(new Error("boom"));

        await expect(
            runIdempotent({ scope: scope("failure-retry"), key, fingerprint }, failingHandler),
        ).rejects.toThrow("boom");

        const succeedingHandler = vi.fn().mockResolvedValue({ status: 201, body: { ok: true } });
        const retryOutcome = await runIdempotent(
            { scope: scope("failure-retry"), key, fingerprint },
            succeedingHandler,
        );

        expect(retryOutcome.kind).toBe("ran");
        expect(succeedingHandler).toHaveBeenCalledTimes(1);
    });

    it("handles a concurrent duplicate request race with exactly one handler execution", async () => {
        const key = crypto.randomUUID();
        const fingerprint = fingerprintPayload({ registrationId: "reg_race" });

        let callCount = 0;
        const handler = vi.fn().mockImplementation(async () => {
            callCount += 1;
            // Simulate real work (DB write + external API call) so both
            // requests are genuinely in flight at the same time.
            await new Promise((resolve) => setTimeout(resolve, 50));
            return { status: 201, body: { orderId: "race-winner" } };
        });

        const [a, b] = await Promise.all([
            runIdempotent({ scope: scope("race"), key, fingerprint }, handler),
            runIdempotent({ scope: scope("race"), key, fingerprint }, handler),
        ]);

        expect(callCount).toBe(1);
        const kinds = [a.kind, b.kind].sort();
        expect(kinds).toEqual(["ran", "replayed"]);

        const bodies = [a, b].map((o) => (o.kind === "conflict" || o.kind === "in_progress" ? null : o.result.body));
        expect(bodies[0]).toEqual(bodies[1]);
    });
});
