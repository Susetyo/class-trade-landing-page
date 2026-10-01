import { prisma } from "@/lib/prisma";

/**
 * Postgres session-level advisory lock — prevents two overlapping runs
 * of the same scheduled job (Milestone 15 §13) without adding a
 * separate lock table. `pg_try_advisory_lock` is non-blocking: a
 * second caller gets `false` immediately instead of queueing, which is
 * exactly "skip this run, the previous one is still going" semantics.
 *
 * Lock keys are fixed per job — do not reuse one across unrelated jobs.
 *
 * `pg_advisory_lock`/`pg_advisory_unlock` are tied to the *session*
 * (physical connection) that acquired them — with Prisma's pooled
 * connections, a bare `$queryRaw` lock followed by a separate
 * `$queryRaw` unlock can land on two different pooled connections,
 * silently leaving the lock held forever. `prisma.$transaction`
 * pins its callback to a single connection for its whole duration,
 * so acquiring and releasing inside one interactive transaction is
 * what actually guarantees they're the same session. The tradeoff is
 * that one pool connection sits reserved for the job's full runtime —
 * acceptable for an infrequent background job, but keep `timeout`
 * generous rather than looping this pattern per-request.
 */
export const JOB_LOCK_KEYS = {
    PAYMENT_RECONCILIATION: 851_500_001,
} as const;

const LOCK_HOLD_TIMEOUT_MS = 10 * 60 * 1000;
const LOCK_ACQUIRE_MAX_WAIT_MS = 5_000;

export async function withAdvisoryLock<T>(
    lockKey: number,
    fn: () => Promise<T>,
): Promise<{ ran: true; result: T } | { ran: false }> {
    return prisma.$transaction(
        async (tx) => {
            const rows = await tx.$queryRaw<{ locked: boolean }[]>`
                SELECT pg_try_advisory_lock(${lockKey}) as locked
            `;

            const locked = rows[0]?.locked === true;
            if (!locked) return { ran: false as const };

            try {
                const result = await fn();
                return { ran: true as const, result };
            } finally {
                await tx.$queryRaw`SELECT pg_advisory_unlock(${lockKey})`;
            }
        },
        { timeout: LOCK_HOLD_TIMEOUT_MS, maxWait: LOCK_ACQUIRE_MAX_WAIT_MS },
    );
}
