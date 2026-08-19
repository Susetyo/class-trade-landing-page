/**
 * Order ownership in this project is capability-based: the opaque Order
 * CUID (`id`, not the human-readable `orderNumber`) doubles as the access
 * token. Anyone holding the CUID from their own payment-status link may
 * read that Order. This helper centralizes the validation so every
 * endpoint that accepts an `orderId` from the browser agrees on the same
 * shape and rejects the same malformed input.
 */
export const ORDER_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export function isValidOrderId(orderId: string): boolean {
    return ORDER_ID_PATTERN.test(orderId);
}
