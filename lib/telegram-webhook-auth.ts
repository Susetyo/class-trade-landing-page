import { timingSafeEqual } from "node:crypto";

/**
 * Telegram webhook `X-Telegram-Bot-Api-Secret-Token` verification
 * (Milestone 15 §4). Extracted from the webhook route for unit
 * testing. Rejects when the secret is empty, not configured, or
 * doesn't match — using a constant-time comparison so response timing
 * can't be used to guess the secret byte-by-byte.
 */
export function verifyTelegramSecretToken(
    received: string | null,
    expected: string | undefined,
): boolean {
    if (!expected) return false;
    if (!received) return false;

    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);

    if (receivedBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return timingSafeEqual(receivedBuffer, expectedBuffer);
}
