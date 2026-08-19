import type { PaymentStatus } from "@/app/generated/prisma/enums";

/**
 * Single source of truth for whether an Order's current payment state
 * still entitles its Telegram account to private channel access. The
 * Midtrans webhook (to decide whether to trigger revocation) and the
 * revocation service (to re-verify before acting) both call this —
 * the decision must never be re-implemented anywhere else.
 */
export type TelegramEntitlementDecision =
    | "ELIGIBLE"
    | "INELIGIBLE"
    | "REVIEW_REQUIRED"
    | "UNCHANGED";

export type TelegramIneligibilityReason = "FULL_REFUND" | "CHARGEBACK";

type OrderEntitlementInput = {
    status: PaymentStatus;
    amount: number;
    refundedAmount: number;
};

/**
 * Business policy (Milestone 14), decided centrally here so it can be
 * changed in one place later:
 *
 * - PAID is the only status that grants/keeps eligibility.
 * - REFUNDED and CHARGEBACK (full) always revoke.
 * - PARTIALLY_REFUNDED only revokes once the cumulative refunded
 *   amount reaches or exceeds the paid amount — i.e. it is treated as
 *   a full refund by value, no matter how many partial refunds it
 *   took to get there. A lesser cumulative amount keeps access by
 *   default; that state is expected to be reviewed manually rather
 *   than acted on automatically.
 * - PARTIAL_CHARGEBACK never auto-revokes. The project has no
 *   explicit policy yet for partial-chargeback revocation, so it
 *   always requires manual review instead of a silent financial
 *   decision.
 * - Non-payment statuses (PENDING/EXPIRED/CANCELLED/FAILED) never
 *   change entitlement on their own — an old or out-of-order webhook
 *   reporting one of these must never be able to revoke a
 *   previously-PAID access. (The webhook layer additionally refuses
 *   to let these statuses overwrite a PAID-or-later Order status at
 *   all — see app/api/webhooks/midtrans/route.ts.)
 */
export function getTelegramEntitlementDecision(
    order: OrderEntitlementInput,
): TelegramEntitlementDecision {
    switch (order.status) {
        case "PAID":
            return "ELIGIBLE";
        case "REFUNDED":
        case "CHARGEBACK":
            return "INELIGIBLE";
        case "PARTIAL_CHARGEBACK":
            return "REVIEW_REQUIRED";
        case "PARTIALLY_REFUNDED":
            return order.refundedAmount >= order.amount
                ? "INELIGIBLE"
                : "UNCHANGED";
        default:
            return "UNCHANGED";
    }
}

/** Internal reason code to persist on TelegramAccess.revocationReason. */
export function getTelegramIneligibilityReason(
    order: Pick<OrderEntitlementInput, "status">,
): TelegramIneligibilityReason {
    return order.status === "CHARGEBACK" ? "CHARGEBACK" : "FULL_REFUND";
}
