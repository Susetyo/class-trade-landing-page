import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Midtrans webhook `signature_key` verification (Milestone 15 §3).
 * Formula per Midtrans documentation:
 * `SHA512(order_id + status_code + gross_amount + server_key)`.
 * Extracted from the webhook route so the formula and its
 * constant-time comparison are independently unit-testable, and so
 * the route can never accidentally skip this check.
 */

export type MidtransSignatureInput = {
    order_id: string;
    status_code: string;
    gross_amount: string;
    signature_key: string;
};

const SIGNATURE_HEX_PATTERN = /^[a-f0-9]{128}$/;

export function computeMidtransSignature(
    orderId: string,
    statusCode: string,
    grossAmount: string,
    serverKey: string,
): string {
    return createHash("sha512").update(orderId + statusCode + grossAmount + serverKey).digest("hex");
}

/** Uses the raw fields exactly as received — no reformatting/rounding of amounts. */
export function verifyMidtransSignature(
    notification: MidtransSignatureInput,
    serverKey: string,
): boolean {
    const expected = computeMidtransSignature(
        notification.order_id,
        notification.status_code,
        notification.gross_amount,
        serverKey,
    );

    const received = notification.signature_key.toLowerCase();

    if (!SIGNATURE_HEX_PATTERN.test(received)) {
        return false;
    }

    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}
