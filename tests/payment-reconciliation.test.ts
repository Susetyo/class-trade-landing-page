import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { getMidtransTransactionStatus } from "@/lib/midtrans";
import { runPaymentReconciliation } from "@/lib/payment-reconciliation";

// vi.mock calls are hoisted by vitest above all imports in this file,
// so the static imports above already resolve to these mocks.
vi.mock("@/lib/midtrans", async () => {
    const actual = await vi.importActual<typeof import("@/lib/midtrans")>("@/lib/midtrans");
    return { ...actual, getMidtransTransactionStatus: vi.fn() };
});

// reconcileTelegramAccessForOrder is only invoked for
// refund/chargeback outcomes, which these tests don't produce — but
// mock it anyway so a future status addition can't accidentally make
// this suite call the real Telegram API.
vi.mock("@/lib/telegram-access-revocation", () => ({
    reconcileTelegramAccessForOrder: vi.fn().mockResolvedValue(undefined),
}));

const createdRegistrationIds: string[] = [];

afterEach(async () => {
    vi.mocked(getMidtransTransactionStatus).mockReset();
    for (const id of createdRegistrationIds.splice(0)) {
        await prisma.registration.delete({ where: { id } }).catch(() => {});
    }
});

async function createStalePendingOrder(amount = 150_000) {
    const registration = await prisma.registration.create({
        data: { name: "Test User", email: `${crypto.randomUUID()}@example.test`, phone: "0800000000" },
    });
    createdRegistrationIds.push(registration.id);

    const orderNumber = `TEST-${crypto.randomUUID()}`;
    const order = await prisma.order.create({
        data: { orderNumber, registrationId: registration.id, amount, status: "PENDING" },
    });

    // Backdate updatedAt past any reasonable pendingAgeMinutes cutoff —
    // Prisma's @updatedAt overwrites any value passed through the
    // normal client API, so this needs raw SQL.
    const backdated = new Date(Date.now() - 60 * 60 * 1000);
    await prisma.$executeRaw`UPDATE "Order" SET "updatedAt" = ${backdated} WHERE id = ${order.id}`;

    return order;
}

describe("runPaymentReconciliation", () => {
    it("recovers a stale PENDING order to PAID when Midtrans reports settlement", async () => {
        const order = await createStalePendingOrder(150_000);

        vi.mocked(getMidtransTransactionStatus).mockResolvedValue({
            order_id: order.orderNumber,
            transaction_id: "trx-1",
            transaction_status: "settlement",
            status_code: "200",
            gross_amount: "150000.00",
        });

        const result = await runPaymentReconciliation({
            pendingAgeMinutes: 1,
            batchSize: 10,
            concurrency: 2,
            triggeredBy: "test",
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.summary.reconciled).toBeGreaterThanOrEqual(1);
        }

        const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
        expect(updated.status).toBe("PAID");
        expect(updated.reconciliationLockedAt).toBeNull();
    });

    it("is safe to run twice — the second run leaves an already-resolved order unchanged", async () => {
        const order = await createStalePendingOrder(150_000);

        vi.mocked(getMidtransTransactionStatus).mockResolvedValue({
            order_id: order.orderNumber,
            transaction_id: "trx-2",
            transaction_status: "settlement",
            status_code: "200",
            gross_amount: "150000.00",
        });

        await runPaymentReconciliation({
            pendingAgeMinutes: 1,
            batchSize: 10,
            concurrency: 2,
            triggeredBy: "test",
        });

        const afterFirstRun = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
        expect(afterFirstRun.status).toBe("PAID");

        // Second run: the order is no longer PENDING, so it won't even
        // be selected as a candidate — status must not change again.
        await runPaymentReconciliation({
            pendingAgeMinutes: 1,
            batchSize: 10,
            concurrency: 2,
            triggeredBy: "test",
        });

        const afterSecondRun = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
        expect(afterSecondRun.status).toBe("PAID");
        expect(afterSecondRun.updatedAt.getTime()).toBe(afterFirstRun.updatedAt.getTime());
    });

    it("does not let one order's failure stop the rest of the batch", async () => {
        const failingOrder = await createStalePendingOrder(100_000);
        const succeedingOrder = await createStalePendingOrder(200_000);

        vi.mocked(getMidtransTransactionStatus).mockImplementation(async (orderNumber: string) => {
            if (orderNumber === failingOrder.orderNumber) {
                throw new Error("simulated Midtrans outage for this order");
            }
            return {
                order_id: succeedingOrder.orderNumber,
                transaction_id: "trx-3",
                transaction_status: "settlement",
                status_code: "200",
                gross_amount: "200000.00",
            };
        });

        const result = await runPaymentReconciliation({
            pendingAgeMinutes: 1,
            batchSize: 10,
            concurrency: 2,
            triggeredBy: "test",
        });

        expect(result.ok).toBe(true);

        const failing = await prisma.order.findUniqueOrThrow({ where: { id: failingOrder.id } });
        const succeeding = await prisma.order.findUniqueOrThrow({
            where: { id: succeedingOrder.id },
        });

        // The failing order stays PENDING (untouched, retryable on the
        // next run) while the other order in the same batch still
        // reconciles successfully.
        expect(failing.status).toBe("PENDING");
        expect(failing.reconciliationLockedAt).toBeNull();
        expect(succeeding.status).toBe("PAID");
    });

    it("never downgrades a final status even if reconciliation somehow re-processes it", async () => {
        const order = await createStalePendingOrder(150_000);

        await prisma.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });

        vi.mocked(getMidtransTransactionStatus).mockResolvedValue({
            order_id: order.orderNumber,
            transaction_id: "trx-4",
            transaction_status: "pending",
            status_code: "201",
            gross_amount: "150000.00",
        });

        // REFUNDED is not PENDING, so this order is not even a
        // candidate — confirms the query-level guard, on top of the
        // shared shouldPersistStatusChange guard already covered in
        // tests/payment-status.test.ts.
        await runPaymentReconciliation({
            pendingAgeMinutes: 1,
            batchSize: 10,
            concurrency: 2,
            triggeredBy: "test",
        });

        const unchanged = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
        expect(unchanged.status).toBe("REFUNDED");
    });
});
