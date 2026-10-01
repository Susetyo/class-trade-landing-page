import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * `Idempotency-Key` support for POST endpoints that create a
 * record/side effect (Milestone 15 §5): order/payment creation,
 * registration, and admin actions.
 *
 * Contract:
 * - Client sends `Idempotency-Key: <opaque client-generated string>`.
 * - Same key + same request body within the TTL → the original
 *   response is replayed verbatim, the handler does not run again.
 * - Same key + a *different* request body → rejected with 409, since
 *   silently ignoring the new payload or overwriting the old result
 *   would both be surprising.
 * - No key supplied → the handler always runs (idempotency is opt-in
 *   per the client, matching how most payment/webhook APIs work).
 *
 * The `@@unique([scope, key])` constraint on `IdempotencyKey` is the
 * database-level guard: two concurrent requests with the same key
 * race to `create()`, exactly one wins, the other observes the unique
 * violation and falls back to reading (and, if necessary, briefly
 * waiting on) the winner's row — so a race never produces two orders.
 */

const HEADER_NAME = "idempotency-key";
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const RACE_POLL_ATTEMPTS = 5;
const RACE_POLL_DELAY_MS = 200;

export function getIdempotencyKey(request: Request): string | null {
    const value = request.headers.get(HEADER_NAME);
    if (!value) return null;
    return KEY_PATTERN.test(value) ? value : null;
}

export function hasMalformedIdempotencyKey(request: Request): boolean {
    const raw = request.headers.get(HEADER_NAME);
    return Boolean(raw) && !KEY_PATTERN.test(raw!);
}

export function fingerprintPayload(payload: unknown): string {
    return createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex");
}

type HandlerResult = { status: number; body: unknown };

type RunIdempotentOptions = {
    scope: string;
    key: string;
    fingerprint: string;
    ttlMs?: number;
    requestId?: string;
};

type RunIdempotentOutcome =
    | { kind: "ran"; result: HandlerResult }
    | { kind: "replayed"; result: HandlerResult }
    | { kind: "conflict" }
    | { kind: "in_progress" };

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `handler` under idempotency protection. `handler` must return a
 * plain `{status, body}` describing the response to persist/replay —
 * it should not throw for expected failure statuses (e.g. validation
 * errors), only for genuinely unexpected errors, which are treated as
 * non-idempotent (the reservation is released so a legitimate retry
 * can proceed cleanly).
 */
export async function runIdempotent(
    options: RunIdempotentOptions,
    handler: () => Promise<HandlerResult>,
): Promise<RunIdempotentOutcome> {
    const { scope, key, fingerprint } = options;
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

    for (let pollAttempt = 0; pollAttempt < RACE_POLL_ATTEMPTS; pollAttempt++) {
        let claimed = false;

        try {
            await prisma.idempotencyKey.create({
                data: {
                    scope,
                    key,
                    requestFingerprint: fingerprint,
                    status: "PROCESSING",
                    expiresAt: new Date(Date.now() + ttlMs),
                },
            });
            claimed = true;
        } catch (error) {
            if (
                !(error instanceof Prisma.PrismaClientKnownRequestError) ||
                error.code !== "P2002"
            ) {
                throw error;
            }
            // Unique violation — another request already holds this
            // (scope, key). Fall through to inspect it below.
        }

        if (claimed) {
            try {
                const result = await handler();

                await prisma.idempotencyKey.update({
                    where: { scope_key: { scope, key } },
                    data: {
                        status: "COMPLETED",
                        responseStatus: result.status,
                        responseBody: result.body as Prisma.InputJsonValue,
                    },
                });

                return { kind: "ran", result };
            } catch (error) {
                // Release the reservation so a genuine retry (after we
                // recover) is not permanently blocked by a half-finished
                // attempt.
                await prisma.idempotencyKey
                    .delete({ where: { scope_key: { scope, key } } })
                    .catch(() => {});

                logger.error("Idempotent handler failed", {
                    event: "idempotency.handler_error",
                    requestId: options.requestId,
                    scope,
                });

                throw error;
            }
        }

        const existing = await prisma.idempotencyKey.findUnique({
            where: { scope_key: { scope, key } },
        });

        if (!existing) {
            // The other request's row was deleted (its handler failed)
            // between our failed create and this read — safe to retry
            // claiming it ourselves.
            continue;
        }

        if (existing.requestFingerprint !== fingerprint) {
            return { kind: "conflict" };
        }

        if (existing.status === "COMPLETED") {
            return {
                kind: "replayed",
                result: {
                    status: existing.responseStatus ?? 200,
                    body: existing.responseBody,
                },
            };
        }

        // Still PROCESSING (genuine concurrent race) — briefly poll for
        // the other request to finish rather than immediately failing.
        await sleep(RACE_POLL_DELAY_MS);
    }

    return { kind: "in_progress" };
}

export function idempotencyConflictResponse(): NextResponse {
    return NextResponse.json(
        {
            message:
                "Idempotency-Key ini sudah pernah dipakai dengan data permintaan yang berbeda.",
        },
        { status: 409 },
    );
}

export function idempotencyInProgressResponse(): NextResponse {
    return NextResponse.json(
        {
            message: "Permintaan dengan Idempotency-Key ini sedang diproses. Coba lagi sebentar.",
        },
        { status: 409, headers: { "Retry-After": "1" } },
    );
}
