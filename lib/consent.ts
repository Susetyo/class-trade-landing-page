import { prisma } from "@/lib/prisma";
import type { ConsentStatus } from "@/app/generated/prisma/enums";

/**
 * Privacy consent ledger (Milestone 15 §11). Append-only: granting and
 * revoking both insert a new row rather than mutate one boolean, so
 * the full history (who/when/what version) is always reconstructable
 * — see prisma/schema.prisma's `ConsentRecord` model.
 *
 * `subjectType`/`subjectId` intentionally reference the subject
 * loosely (no DB foreign key) so a consent record survives subject
 * deletion, which the record itself may need to prove happened
 * lawfully.
 */

export const CONSENT_TYPE_PRIVACY_POLICY = "privacy_policy";
// Bump this whenever the privacy policy text/scope materially changes
// — a prior GRANTED record at an older version must not be treated as
// covering the new version.
export const CURRENT_PRIVACY_POLICY_VERSION = "2026-08-22";

export type ConsentSubjectType = "registration";

type RecordConsentInput = {
    subjectType: ConsentSubjectType;
    subjectId: string;
    consentType: string;
    consentVersion: string;
    status: ConsentStatus;
    source: string;
};

export async function recordConsent(input: RecordConsentInput): Promise<void> {
    await prisma.consentRecord.create({ data: input });
}

export async function grantConsent(
    params: Omit<RecordConsentInput, "status">,
): Promise<void> {
    await recordConsent({ ...params, status: "GRANTED" });
}

export async function revokeConsent(
    params: Omit<RecordConsentInput, "status">,
): Promise<void> {
    await recordConsent({ ...params, status: "REVOKED" });
}

/**
 * Active consent = the most recent row for this
 * (subjectType, subjectId, consentType) has status GRANTED, at the
 * currently-required version. An older-version grant, or the most
 * recent row being REVOKED, both mean "not active".
 */
export async function hasActiveConsent(
    subjectType: ConsentSubjectType,
    subjectId: string,
    consentType: string,
    requiredVersion?: string,
): Promise<boolean> {
    const latest = await prisma.consentRecord.findFirst({
        where: { subjectType, subjectId, consentType },
        orderBy: { createdAt: "desc" },
        select: { status: true, consentVersion: true },
    });

    if (!latest || latest.status !== "GRANTED") return false;
    if (requiredVersion && latest.consentVersion !== requiredVersion) return false;

    return true;
}
