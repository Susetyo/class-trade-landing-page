import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { grantConsent, hasActiveConsent, revokeConsent } from "@/lib/consent";

const CONSENT_TYPE = "test.privacy_policy";

afterEach(async () => {
    await prisma.consentRecord.deleteMany({ where: { consentType: CONSENT_TYPE } });
});

describe("consent ledger", () => {
    it("is inactive before any consent is recorded", async () => {
        const subjectId = crypto.randomUUID();
        expect(await hasActiveConsent("registration", subjectId, CONSENT_TYPE)).toBe(false);
    });

    it("becomes active once granted", async () => {
        const subjectId = crypto.randomUUID();

        await grantConsent({
            subjectType: "registration",
            subjectId,
            consentType: CONSENT_TYPE,
            consentVersion: "v1",
            source: "test",
        });

        expect(await hasActiveConsent("registration", subjectId, CONSENT_TYPE)).toBe(true);
    });

    it("becomes inactive after being revoked", async () => {
        const subjectId = crypto.randomUUID();

        await grantConsent({
            subjectType: "registration",
            subjectId,
            consentType: CONSENT_TYPE,
            consentVersion: "v1",
            source: "test",
        });
        await revokeConsent({
            subjectType: "registration",
            subjectId,
            consentType: CONSENT_TYPE,
            consentVersion: "v1",
            source: "test",
        });

        expect(await hasActiveConsent("registration", subjectId, CONSENT_TYPE)).toBe(false);
    });

    it("preserves history as an append-only ledger (grant, revoke, grant again)", async () => {
        const subjectId = crypto.randomUUID();

        await grantConsent({
            subjectType: "registration",
            subjectId,
            consentType: CONSENT_TYPE,
            consentVersion: "v1",
            source: "test",
        });
        await revokeConsent({
            subjectType: "registration",
            subjectId,
            consentType: CONSENT_TYPE,
            consentVersion: "v1",
            source: "test",
        });
        await grantConsent({
            subjectType: "registration",
            subjectId,
            consentType: CONSENT_TYPE,
            consentVersion: "v2",
            source: "test",
        });

        const history = await prisma.consentRecord.findMany({
            where: { subjectId, consentType: CONSENT_TYPE },
            orderBy: { createdAt: "asc" },
        });

        expect(history).toHaveLength(3);
        expect(history.map((h) => h.status)).toEqual(["GRANTED", "REVOKED", "GRANTED"]);
        expect(await hasActiveConsent("registration", subjectId, CONSENT_TYPE)).toBe(true);
    });

    it("treats an older-version grant as not covering a newer required version", async () => {
        const subjectId = crypto.randomUUID();

        await grantConsent({
            subjectType: "registration",
            subjectId,
            consentType: CONSENT_TYPE,
            consentVersion: "v1",
            source: "test",
        });

        expect(await hasActiveConsent("registration", subjectId, CONSENT_TYPE, "v2")).toBe(false);
        expect(await hasActiveConsent("registration", subjectId, CONSENT_TYPE, "v1")).toBe(true);
    });
});
