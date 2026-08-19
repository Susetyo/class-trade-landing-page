import { createHash, randomBytes } from "node:crypto";

import { TelegramConfigError } from "@/lib/telegram";

const RAW_TOKEN_BYTES = 32;
const MAX_TOKEN_LENGTH = 64;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export const TELEGRAM_LINK_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * Generates a raw, single-use linking token. 32 random bytes encoded as
 * base64url typically yields 43 characters — comfortably under Telegram's
 * 64-character deep-link parameter limit. The raw value is only ever
 * returned to the caller; it must never be persisted, logged, or included
 * in error/analytics reporting. Only its SHA-256 hash is stored.
 */
export function generateRawLinkToken(): string {
    const token = randomBytes(RAW_TOKEN_BYTES).toString("base64url");

    if (token.length > MAX_TOKEN_LENGTH) {
        throw new Error(
            "Generated Telegram link token exceeds max length",
        );
    }

    return token;
}

export function hashLinkToken(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
}

export function isValidRawTokenFormat(token: string): boolean {
    return (
        token.length > 0 &&
        token.length <= MAX_TOKEN_LENGTH &&
        BASE64URL_PATTERN.test(token)
    );
}

export function getTelegramLinkTokenExpiry(): Date {
    return new Date(Date.now() + TELEGRAM_LINK_TOKEN_TTL_MS);
}

export function buildTelegramDeepLink(rawToken: string): string {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME;

    if (!botUsername) {
        throw new TelegramConfigError(
            "TELEGRAM_BOT_USERNAME belum dikonfigurasi",
        );
    }

    return `https://t.me/${botUsername}?start=${rawToken}`;
}
