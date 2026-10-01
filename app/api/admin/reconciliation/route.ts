import { NextResponse } from "next/server";

import { checkAdminAuth } from "@/lib/admin-auth";
import { checkRateLimit, RATE_LIMITS, rateLimitResponseInit } from "@/lib/rate-limit";
import { getClientIp, getRequestId } from "@/lib/request-context";
import { AdminReconciliationTriggerSchema } from "@/lib/schemas";
import { runPaymentReconciliation } from "@/lib/payment-reconciliation";
import {
    fingerprintPayload,
    getIdempotencyKey,
    hasMalformedIdempotencyKey,
    idempotencyConflictResponse,
    idempotencyInProgressResponse,
    runIdempotent,
} from "@/lib/idempotency";
import { recordAuditLog } from "@/lib/audit-log";
import { captureException } from "@/lib/error-monitoring";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-triggered payment reconciliation (Milestone 15 §13). Runs the
 * same engine as the scheduled job (`scripts/reconcile-payments.ts`)
 * — both go through `runPaymentReconciliation`, which takes a
 * Postgres advisory lock, so a manual trigger here can never overlap
 * with (or duplicate the effect of) a concurrently running scheduled
 * pass; it simply reports "already running".
 *
 * Auth: `ADMIN_API_SECRET` bearer token — see lib/admin-auth.ts for
 * why this project doesn't yet have real per-admin authentication.
 */
async function handleTrigger(
    body: unknown,
    actor: string,
    requestId: string,
): Promise<{ status: number; body: unknown }> {
    const parsed = AdminReconciliationTriggerSchema.safeParse(body ?? {});

    if (!parsed.success) {
        return { status: 400, body: { message: "Payload tidak valid" } };
    }

    const result = await runPaymentReconciliation({
        batchSize: parsed.data.maxOrders,
        triggeredBy: actor,
    });

    logger.info("Admin reconciliation trigger completed", {
        event: "admin.reconciliation_triggered",
        requestId,
    });

    if (!result.ok) {
        return {
            status: 409,
            body: { message: "Reconciliation lain sedang berjalan. Coba lagi nanti." },
        };
    }

    return { status: 200, body: { data: result.summary } };
}

export async function POST(request: Request) {
    const requestId = getRequestId(request);

    const auth = checkAdminAuth(request);
    if (!auth.authorized) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit({
        key: `admin.reconciliation:${ip}`,
        ...RATE_LIMITS.ADMIN_ACTION,
    });

    if (!rateLimit.allowed) {
        return NextResponse.json(
            { message: "Terlalu banyak permintaan." },
            rateLimitResponseInit(rateLimit),
        );
    }

    if (hasMalformedIdempotencyKey(request)) {
        return NextResponse.json({ message: "Idempotency-Key tidak valid." }, { status: 400 });
    }

    // Not a real per-admin identity (see lib/admin-auth.ts) — "admin"
    // plus the caller's IP is the best available actor label for the
    // audit log until real admin accounts exist.
    const actor = `admin:${ip}`;

    try {
        const body = await request.json().catch(() => null);
        const idempotencyKey = getIdempotencyKey(request);

        const run = () => handleTrigger(body, actor, requestId);

        if (!idempotencyKey) {
            const result = await run();
            return NextResponse.json(result.body, { status: result.status });
        }

        const outcome = await runIdempotent(
            {
                scope: "admin.reconciliation_trigger",
                key: idempotencyKey,
                fingerprint: fingerprintPayload(body),
                requestId,
            },
            run,
        );

        if (outcome.kind === "conflict") return idempotencyConflictResponse();
        if (outcome.kind === "in_progress") return idempotencyInProgressResponse();

        return NextResponse.json(outcome.result.body, { status: outcome.result.status });
    } catch (error) {
        await recordAuditLog({
            actor,
            action: "PAYMENT_RECONCILIATION_TRIGGER",
            outcome: "FAILED",
        });

        captureException(error, {
            operation: "admin.reconciliation_trigger",
            requestId,
            expected: false,
        });

        return NextResponse.json(
            { message: "Gagal menjalankan reconciliation" },
            { status: 500 },
        );
    }
}
