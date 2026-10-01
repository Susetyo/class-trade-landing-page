import { prisma } from "@/lib/prisma";
import {
    getMidtransTransactionStatus,
    MidtransApiError,
    MidtransNetworkError,
    MidtransTimeoutError,
} from "@/lib/midtrans";
import {
    ENTITLEMENT_SENSITIVE_STATUSES,
    resolvePaymentStatus,
    shouldPersistStatusChange,
} from "@/lib/payment-status";
import { reconcileTelegramAccessForOrder } from "@/lib/telegram-access-revocation";
import { recordAuditLog } from "@/lib/audit-log";
import { captureException } from "@/lib/error-monitoring";
import { logger } from "@/lib/logger";
import { getReconciliationConfig } from "@/lib/env";
import { JOB_LOCK_KEYS, withAdvisoryLock } from "@/lib/job-lock";

/**
 * Payment reconciliation (Milestone 15 §13): recovers Orders stuck at
 * PENDING past a configurable age by re-checking Midtrans' own status
 * API and applying the same status mapping + anti-downgrade guard the
 * webhook uses (see lib/payment-status.ts) — so a webhook delivery
 * that Midtrans never retried, or that this app failed to receive, is
 * still eventually corrected.
 *
 * Entry points:
 * - `runPaymentReconciliation()` — scheduled job (script or cron
 *   route), guarded by a Postgres advisory lock so overlapping runs
 *   never process the same batch twice.
 * - Also callable directly from the admin-triggered route
 *   (`app/api/admin/reconciliation/route.ts`), which does not take the
 *   advisory lock itself — it calls this same function, so the lock
 *   still protects against a manual trigger overlapping a scheduled
 *   run.
 */

export type ReconciliationSummary = {
    scanned: number;
    reconciled: number;
    unchanged: number;
    failed: number;
    skipped: number;
};

const EMPTY_SUMMARY: ReconciliationSummary = {
    scanned: 0,
    reconciled: 0,
    unchanged: 0,
    failed: 0,
    skipped: 0,
};

// A claimed order whose reconciliation attempt never released the
// lock (crashed worker) is treated as abandoned after this long and
// may be reclaimed by a later run.
const STALE_LOCK_MS = 5 * 60 * 1000;

type ReconciliationOptions = {
    pendingAgeMinutes?: number;
    batchSize?: number;
    concurrency?: number;
    triggeredBy: string;
};

function chunk<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
}

async function claimOrder(orderId: string, staleCutoff: Date): Promise<boolean> {
    const result = await prisma.order.updateMany({
        where: {
            id: orderId,
            status: "PENDING",
            OR: [{ reconciliationLockedAt: null }, { reconciliationLockedAt: { lt: staleCutoff } }],
        },
        data: { reconciliationLockedAt: new Date() },
    });

    return result.count === 1;
}

async function releaseClaim(orderId: string): Promise<void> {
    await prisma.order
        .update({ where: { id: orderId }, data: { reconciliationLockedAt: null } })
        .catch(() => {});
}

type ReconcileOneResult = "reconciled" | "unchanged" | "failed" | "skipped";

async function reconcileOneOrder(orderId: string): Promise<ReconcileOneResult> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    // Already resolved by a real webhook (or a previous run) between
    // being selected as a candidate and being claimed — nothing to do.
    if (!order || order.status !== "PENDING") return "skipped";

    let currentTransaction;
    try {
        currentTransaction = await getMidtransTransactionStatus(order.orderNumber);
    } catch (error) {
        const expected =
            error instanceof MidtransApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            error.status !== 429;

        if (!expected) {
            captureException(error, {
                operation: "payment_reconciliation.status_lookup",
                orderId: order.id,
                expected: false,
            });
        }

        logger.warn("Reconciliation: Midtrans status lookup failed", {
            event: "reconciliation.status_lookup_failed",
            orderId: order.id,
            errorName: error instanceof Error ? error.name : "unknown",
            retryable:
                error instanceof MidtransTimeoutError || error instanceof MidtransNetworkError,
        });

        return "failed";
    }

    if (currentTransaction.order_id !== order.orderNumber) {
        logger.error("Reconciliation: order_id mismatch from Midtrans status API", {
            event: "reconciliation.order_id_mismatch",
            orderId: order.id,
        });
        return "failed";
    }

    const mappedStatus = resolvePaymentStatus(currentTransaction);

    if (!mappedStatus || mappedStatus === "PENDING") {
        return "unchanged";
    }

    const persistStatusChange = shouldPersistStatusChange(order.status, mappedStatus);

    if (!persistStatusChange) {
        // Guard tripped (should be unreachable from PENDING today, but
        // never silently apply a status change the shared guard rejects).
        return "unchanged";
    }

    const paidAmount = Number(currentTransaction.gross_amount);
    if (paidAmount !== order.amount) {
        logger.error("Reconciliation: amount mismatch from Midtrans status API", {
            event: "reconciliation.amount_mismatch",
            orderId: order.id,
        });
        return "failed";
    }

    if (
        order.midtransTransactionId &&
        order.midtransTransactionId !== currentTransaction.transaction_id
    ) {
        logger.error("Reconciliation: transaction id mismatch", {
            event: "reconciliation.transaction_id_mismatch",
            orderId: order.id,
        });
        return "failed";
    }

    const refundedAmount = currentTransaction.refund_amount
        ? Number(currentTransaction.refund_amount)
        : order.refundedAmount;

    // Re-verify status is still PENDING at the moment of writing —
    // closes the (small) race window against a real webhook landing
    // between the read above and this write.
    const updateResult = await prisma.order.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: {
            status: mappedStatus,
            midtransTransactionId: currentTransaction.transaction_id,
            paymentType: currentTransaction.payment_type,
            paidAt: mappedStatus === "PAID" ? (order.paidAt ?? new Date()) : order.paidAt,
            refundedAmount,
        },
    });

    if (updateResult.count !== 1) {
        return "skipped";
    }

    await recordAuditLog({
        actor: "system:payment-reconciliation",
        action: "PAYMENT_RECONCILIATION_STATUS_UPDATE",
        targetType: "Order",
        targetId: order.id,
        outcome: mappedStatus,
        metadata: { fromStatus: order.status, toStatus: mappedStatus },
    });

    if (ENTITLEMENT_SENSITIVE_STATUSES.includes(mappedStatus)) {
        await reconcileTelegramAccessForOrder(order.id);
    }

    return "reconciled";
}

async function runBatch(options: ReconciliationOptions): Promise<ReconciliationSummary> {
    const config = getReconciliationConfig();
    const pendingAgeMinutes = options.pendingAgeMinutes ?? config.pendingAgeMinutes;
    const batchSize = options.batchSize ?? config.batchSize;
    const concurrency = Math.max(1, options.concurrency ?? config.concurrency);

    const pendingCutoff = new Date(Date.now() - pendingAgeMinutes * 60 * 1000);
    const staleLockCutoff = new Date(Date.now() - STALE_LOCK_MS);

    const candidates = await prisma.order.findMany({
        where: {
            status: "PENDING",
            updatedAt: { lte: pendingCutoff },
            OR: [{ reconciliationLockedAt: null }, { reconciliationLockedAt: { lt: staleLockCutoff } }],
        },
        select: { id: true },
        orderBy: { updatedAt: "asc" },
        take: batchSize,
    });

    const summary: ReconciliationSummary = { ...EMPTY_SUMMARY, scanned: candidates.length };

    for (const batch of chunk(candidates, concurrency)) {
        await Promise.all(
            batch.map(async (candidate) => {
                const claimed = await claimOrder(candidate.id, staleLockCutoff);

                if (!claimed) {
                    summary.skipped += 1;
                    return;
                }

                try {
                    const outcome = await reconcileOneOrder(candidate.id);
                    summary[outcome] += 1;
                } catch (error) {
                    summary.failed += 1;
                    captureException(error, {
                        operation: "payment_reconciliation.reconcile_one_order",
                        orderId: candidate.id,
                        expected: false,
                    });
                } finally {
                    await releaseClaim(candidate.id);
                }
            }),
        );
    }

    return summary;
}

// Deliberately not a bare `ReconciliationSummary | { skipped: true }`
// union: ReconciliationSummary already has its own `skipped` *count*
// field, which made that shape ambiguous to narrow on (`"skipped" in
// result` was true for both variants). `ok` is the sole discriminant.
export type ReconciliationRunResult =
    | { ok: true; summary: ReconciliationSummary }
    | { ok: false; reason: "already_running" };

/**
 * Runs one reconciliation pass, guarded by an advisory lock so an
 * overlapping scheduled run (or a concurrent manual admin trigger)
 * never processes the same batch twice. Returns `{ ok: false }` (not
 * an error) when another run already holds the lock.
 */
export async function runPaymentReconciliation(
    options: ReconciliationOptions,
): Promise<ReconciliationRunResult> {
    const lockResult = await withAdvisoryLock(JOB_LOCK_KEYS.PAYMENT_RECONCILIATION, () =>
        runBatch(options),
    );

    if (!lockResult.ran) {
        logger.info("Reconciliation run skipped — already in progress", {
            event: "reconciliation.lock_skipped",
        });
        await recordAuditLog({
            actor: options.triggeredBy,
            action: "PAYMENT_RECONCILIATION_RUN",
            outcome: "SKIPPED_ALREADY_RUNNING",
        });
        return { ok: false, reason: "already_running" };
    }

    const summary = lockResult.result;

    await recordAuditLog({
        actor: options.triggeredBy,
        action: "PAYMENT_RECONCILIATION_RUN",
        outcome: "COMPLETED",
        metadata: summary,
    });

    logger.info("Reconciliation run completed", {
        event: "reconciliation.run_completed",
        ...summary,
    });

    return { ok: true, summary };
}
