import type { PaymentStatus } from "@/app/generated/prisma/enums";
import type { MidtransTransactionStatus } from "@/lib/midtrans";

/**
 * Midtrans status → internal `PaymentStatus` mapping and the
 * anti-downgrade/anti-out-of-order guard. Shared by the Midtrans
 * webhook (`app/api/webhooks/midtrans/route.ts`) and payment
 * reconciliation (`lib/payment-reconciliation.ts`) — both apply
 * Midtrans-reported status to an Order, so this decision must never
 * be implemented twice and risk drifting apart. See
 * docs/telegram-setup.md §13 for the original design rationale.
 */

// Once an Order has reached PAID (or a refund/chargeback state
// derived from it), a stale or out-of-order notification reporting
// one of NON_PAYMENT_STATUSES must never downgrade it.
export const NEVER_DOWNGRADE_FROM: PaymentStatus[] = [
    "PAID",
    "REFUNDED",
    "PARTIALLY_REFUNDED",
    "CHARGEBACK",
    "PARTIAL_CHARGEBACK",
];

export const NON_PAYMENT_STATUSES: PaymentStatus[] = [
    "PENDING",
    "EXPIRED",
    "CANCELLED",
    "FAILED",
];

// Statuses that can affect Telegram entitlement — only these are
// worth the extra query + potential Telegram calls after commit.
export const ENTITLEMENT_SENSITIVE_STATUSES: PaymentStatus[] = [
    "REFUNDED",
    "PARTIALLY_REFUNDED",
    "CHARGEBACK",
    "PARTIAL_CHARGEBACK",
];

export function shouldPersistStatusChange(
    current: PaymentStatus,
    next: PaymentStatus,
): boolean {
    if (current === next) return true;

    // Fully terminal — once a transaction has been reported fully
    // refunded or fully charged back, no later notification may move
    // it anywhere else.
    if (current === "REFUNDED" || current === "CHARGEBACK") return false;

    if (NEVER_DOWNGRADE_FROM.includes(current) && NON_PAYMENT_STATUSES.includes(next)) {
        return false;
    }

    return true;
}

export function resolvePaymentStatus(
    transaction: MidtransTransactionStatus,
): PaymentStatus | null {
    const transactionStatus = transaction.transaction_status.toLowerCase();
    const fraudStatus = transaction.fraud_status?.toLowerCase();

    if (transactionStatus === "settlement" && transaction.status_code === "200") {
        return "PAID";
    }

    if (
        transactionStatus === "capture" &&
        transaction.status_code === "200" &&
        fraudStatus === "accept"
    ) {
        return "PAID";
    }

    if (transactionStatus === "pending" || transactionStatus === "authorize") {
        return "PENDING";
    }

    if (transactionStatus === "expire") return "EXPIRED";
    if (transactionStatus === "cancel") return "CANCELLED";
    if (transactionStatus === "deny" || transactionStatus === "failure") return "FAILED";
    if (transactionStatus === "refund") return "REFUNDED";
    if (transactionStatus === "partial_refund") return "PARTIALLY_REFUNDED";
    if (transactionStatus === "chargeback") return "CHARGEBACK";

    if (transactionStatus === "partial_chargeback") {
        // Kept distinct from full CHARGEBACK — Milestone 14 policy
        // requires manual review rather than an automatic revocation.
        // See lib/telegram-entitlement.ts.
        return "PARTIAL_CHARGEBACK";
    }

    return null;
}
