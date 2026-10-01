import { describe, expect, it } from "vitest";
import { resolvePaymentStatus, shouldPersistStatusChange } from "@/lib/payment-status";
import type { MidtransTransactionStatus } from "@/lib/midtrans";

function status(overrides: Partial<MidtransTransactionStatus>): MidtransTransactionStatus {
    return {
        order_id: "ORDER-1",
        transaction_id: "trx-1",
        transaction_status: "pending",
        status_code: "201",
        gross_amount: "100000.00",
        ...overrides,
    };
}

describe("resolvePaymentStatus", () => {
    it("maps settlement + 200 to PAID", () => {
        expect(
            resolvePaymentStatus(status({ transaction_status: "settlement", status_code: "200" })),
        ).toBe("PAID");
    });

    it("maps accepted capture + 200 to PAID", () => {
        expect(
            resolvePaymentStatus(
                status({ transaction_status: "capture", status_code: "200", fraud_status: "accept" }),
            ),
        ).toBe("PAID");
    });

    it("does not map a challenged capture to PAID", () => {
        expect(
            resolvePaymentStatus(
                status({ transaction_status: "capture", status_code: "200", fraud_status: "challenge" }),
            ),
        ).not.toBe("PAID");
    });

    it("maps pending/authorize to PENDING", () => {
        expect(resolvePaymentStatus(status({ transaction_status: "pending" }))).toBe("PENDING");
        expect(resolvePaymentStatus(status({ transaction_status: "authorize" }))).toBe("PENDING");
    });

    it("maps expire/cancel/deny/failure", () => {
        expect(resolvePaymentStatus(status({ transaction_status: "expire" }))).toBe("EXPIRED");
        expect(resolvePaymentStatus(status({ transaction_status: "cancel" }))).toBe("CANCELLED");
        expect(resolvePaymentStatus(status({ transaction_status: "deny" }))).toBe("FAILED");
        expect(resolvePaymentStatus(status({ transaction_status: "failure" }))).toBe("FAILED");
    });

    it("maps refund/partial_refund/chargeback/partial_chargeback", () => {
        expect(resolvePaymentStatus(status({ transaction_status: "refund" }))).toBe("REFUNDED");
        expect(resolvePaymentStatus(status({ transaction_status: "partial_refund" }))).toBe(
            "PARTIALLY_REFUNDED",
        );
        expect(resolvePaymentStatus(status({ transaction_status: "chargeback" }))).toBe(
            "CHARGEBACK",
        );
        expect(resolvePaymentStatus(status({ transaction_status: "partial_chargeback" }))).toBe(
            "PARTIAL_CHARGEBACK",
        );
    });

    it("returns null for an unrecognized status", () => {
        expect(resolvePaymentStatus(status({ transaction_status: "something_new" }))).toBeNull();
    });
});

describe("shouldPersistStatusChange — anti-downgrade / anti-out-of-order guard", () => {
    it("allows the same status to persist (idempotent no-op)", () => {
        expect(shouldPersistStatusChange("PAID", "PAID")).toBe(true);
    });

    it("allows PENDING -> PAID", () => {
        expect(shouldPersistStatusChange("PENDING", "PAID")).toBe(true);
    });

    it("never allows REFUNDED to move to anything else (fully terminal)", () => {
        expect(shouldPersistStatusChange("REFUNDED", "PAID")).toBe(false);
        expect(shouldPersistStatusChange("REFUNDED", "PENDING")).toBe(false);
        expect(shouldPersistStatusChange("REFUNDED", "CHARGEBACK")).toBe(false);
    });

    it("never allows CHARGEBACK to move to anything else (fully terminal)", () => {
        expect(shouldPersistStatusChange("CHARGEBACK", "REFUNDED")).toBe(false);
    });

    it("never downgrades PAID to a non-payment status (stale/out-of-order webhook)", () => {
        expect(shouldPersistStatusChange("PAID", "PENDING")).toBe(false);
        expect(shouldPersistStatusChange("PAID", "EXPIRED")).toBe(false);
        expect(shouldPersistStatusChange("PAID", "CANCELLED")).toBe(false);
        expect(shouldPersistStatusChange("PAID", "FAILED")).toBe(false);
    });

    it("allows PAID to move forward to a refund/chargeback state", () => {
        expect(shouldPersistStatusChange("PAID", "REFUNDED")).toBe(true);
        expect(shouldPersistStatusChange("PAID", "PARTIALLY_REFUNDED")).toBe(true);
        expect(shouldPersistStatusChange("PAID", "CHARGEBACK")).toBe(true);
    });

    it("never downgrades PARTIALLY_REFUNDED to a non-payment status", () => {
        expect(shouldPersistStatusChange("PARTIALLY_REFUNDED", "EXPIRED")).toBe(false);
    });
});
