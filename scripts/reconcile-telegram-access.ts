/**
 * Batch-retries TelegramAccess rows stuck in REVOCATION_PENDING
 * (abandoned mid-attempt) or REVOCATION_FAILED (past their backoff
 * window) via the same idempotent revocation service the Midtrans
 * webhook uses — see lib/telegram-access-revocation.ts.
 *
 * This project has no cron/queue infrastructure yet, so this script
 * is meant to be run manually (or wired into one later) from a secure
 * server environment:
 *
 *   npm run telegram:reconcile
 *
 * Processes a small batch per run and never prints Telegram user IDs,
 * invite links, or secrets — only a count and safe internal
 * status/error codes (already enforced by the service it calls).
 */
import { prisma } from "@/lib/prisma";
import { retryDueTelegramAccessRevocations } from "@/lib/telegram-access-revocation";

const BATCH_SIZE = 20;

async function main() {
    const processed = await retryDueTelegramAccessRevocations(BATCH_SIZE);
    console.log(
        `Reconciliation selesai. Kandidat diproses: ${processed}.`,
    );
}

main()
    .catch((error) => {
        console.error(
            "Reconciliation gagal:",
            error instanceof Error ? error.message : "unknown error",
        );
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
