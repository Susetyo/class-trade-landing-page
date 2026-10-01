/**
 * Payment reconciliation (Milestone 15 §13) — re-checks Orders stuck
 * at PENDING past a configurable age against Midtrans' own status
 * API, via the same engine the admin-triggered endpoint uses (see
 * lib/payment-reconciliation.ts). Guarded by a Postgres advisory
 * lock, so running this concurrently with another instance of itself
 * (or with a manual admin trigger) is safe — the second caller simply
 * observes "already running" and exits.
 *
 * Run manually:
 *
 *   npm run payments:reconcile
 *
 * Or wire into a scheduler (cron, Vercel Cron, GitHub Actions on a
 * schedule, etc.) using `RECONCILIATION_CRON` as the expression —
 * this script itself does not read that variable; it is meant to be
 * used to configure whatever scheduler invokes this command. See
 * docs/security-reliability.md for a worked example.
 *
 * Never prints PII or secrets — only the run summary (counts).
 */
import { prisma } from "@/lib/prisma";
import { runPaymentReconciliation } from "@/lib/payment-reconciliation";

async function main() {
    const result = await runPaymentReconciliation({ triggeredBy: "system:cron" });

    if (!result.ok) {
        console.log("Reconciliation dilewati — sudah ada proses lain yang berjalan.");
        return;
    }

    const { summary } = result;
    console.log(
        `Reconciliation selesai. scanned=${summary.scanned} reconciled=${summary.reconciled} ` +
            `unchanged=${summary.unchanged} failed=${summary.failed} skipped=${summary.skipped}`,
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
