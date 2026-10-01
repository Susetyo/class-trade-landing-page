import { describe, expect, it } from "vitest";
import { verifyTelegramSecretToken } from "@/lib/telegram-webhook-auth";

describe("verifyTelegramSecretToken", () => {
    const expected = "a-valid-webhook-secret-value";

    it("accepts the correct secret", () => {
        expect(verifyTelegramSecretToken(expected, expected)).toBe(true);
    });

    it("rejects a wrong secret", () => {
        expect(verifyTelegramSecretToken("wrong-secret-value-here", expected)).toBe(false);
    });

    it("rejects a missing (null) secret header", () => {
        expect(verifyTelegramSecretToken(null, expected)).toBe(false);
    });

    it("rejects an empty secret header", () => {
        expect(verifyTelegramSecretToken("", expected)).toBe(false);
    });

    it("rejects when the server has no secret configured", () => {
        expect(verifyTelegramSecretToken(expected, undefined)).toBe(false);
    });

    it("rejects a same-length but different secret", () => {
        const sameLength = "b-valid-webhook-secret-value";
        expect(sameLength.length).toBe(expected.length);
        expect(verifyTelegramSecretToken(sameLength, expected)).toBe(false);
    });
});
