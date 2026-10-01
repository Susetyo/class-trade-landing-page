import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { computeMidtransSignature, verifyMidtransSignature } from "@/lib/midtrans-signature";

const SERVER_KEY = "test-server-key-do-not-use-in-prod";

function makeNotification(overrides: Partial<Record<string, string>> = {}) {
    const order_id = overrides.order_id ?? "REG-1700000000-abcd1234";
    const status_code = overrides.status_code ?? "200";
    const gross_amount = overrides.gross_amount ?? "150000.00";

    const signature_key =
        overrides.signature_key ??
        createHash("sha512").update(order_id + status_code + gross_amount + SERVER_KEY).digest("hex");

    return { order_id, status_code, gross_amount, signature_key };
}

describe("verifyMidtransSignature", () => {
    it("accepts a correctly computed signature", () => {
        const notification = makeNotification();
        expect(verifyMidtransSignature(notification, SERVER_KEY)).toBe(true);
    });

    it("rejects a forged/incorrect signature", () => {
        const notification = makeNotification({ signature_key: "f".repeat(128) });
        expect(verifyMidtransSignature(notification, SERVER_KEY)).toBe(false);
    });

    it("rejects a signature computed with the wrong server key", () => {
        const notification = makeNotification();
        expect(verifyMidtransSignature(notification, "a-different-server-key")).toBe(false);
    });

    it("rejects a signature that is not 128 hex characters", () => {
        const notification = makeNotification({ signature_key: "not-hex" });
        expect(verifyMidtransSignature(notification, SERVER_KEY)).toBe(false);
    });

    it("rejects when any signed field is tampered with (amount changed after signing)", () => {
        const notification = makeNotification();
        const tampered = { ...notification, gross_amount: "1.00" };
        expect(verifyMidtransSignature(tampered, SERVER_KEY)).toBe(false);
    });

    it("matches the documented formula exactly", () => {
        const orderId = "ORDER-1";
        const statusCode = "200";
        const grossAmount = "10000.00";
        const expected = createHash("sha512")
            .update(orderId + statusCode + grossAmount + SERVER_KEY)
            .digest("hex");

        expect(computeMidtransSignature(orderId, statusCode, grossAmount, SERVER_KEY)).toBe(
            expected,
        );
    });
});
