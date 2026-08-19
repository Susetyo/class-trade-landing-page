import { prisma } from "@/lib/prisma";
import {
    getTelegramEntitlementDecision,
    getTelegramIneligibilityReason,
    type TelegramIneligibilityReason,
} from "@/lib/telegram-entitlement";
import {
    sendTelegramMessage,
    TelegramApiError,
    TelegramConfigError,
    TelegramNetworkError,
    TelegramTimeoutError,
} from "@/lib/telegram";
import {
    banChannelMember,
    getChannelMember,
    isActiveChannelMember,
    isPrivilegedChannelMember,
    revokeChannelInviteLink,
    unbanChannelMember,
} from "@/lib/telegram-channel";

// A REVOCATION_PENDING row older than this is assumed to belong to a
// crashed/abandoned attempt and may be reclaimed by a later pass
// (webhook retry or the reconciliation script) rather than left stuck
// forever.
const STUCK_PENDING_MS = 2 * 60 * 1000;

const BASE_BACKOFF_MS = 60 * 1000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;

const ACCESS_REVOKED_MESSAGE =
    "Akses ke private channel telah dinonaktifkan karena pembayaran " +
    "tidak lagi memenuhi persyaratan akses.\n\n" +
    "Jika menurut Anda ini tidak sesuai, silakan hubungi administrator.";

async function loadRevocationTarget(orderId: string) {
    return prisma.order.findUnique({
        where: { id: orderId },
        select: {
            id: true,
            status: true,
            amount: true,
            refundedAmount: true,
            telegramAccess: {
                select: {
                    id: true,
                    status: true,
                    operationVersion: true,
                    inviteLink: true,
                    telegramAccountId: true,
                    revocationRequestedAt: true,
                    revocationStartedAt: true,
                    telegramAccount: {
                        select: { telegramUserId: true },
                    },
                },
            },
        },
    });
}

type RevocationTarget = NonNullable<
    Awaited<ReturnType<typeof loadRevocationTarget>>
>;
type RevocationAccess = NonNullable<RevocationTarget["telegramAccess"]>;

/**
 * Best-effort entrypoint — never throws. Safe to call after every
 * Midtrans webhook commit and from the reconciliation script; it
 * re-derives eligibility from the Order row it reads, so calling it
 * for an Order that turns out to still be eligible (or whose decision
 * didn't change) is a harmless no-op.
 */
export async function reconcileTelegramAccessForOrder(
    orderId: string,
): Promise<void> {
    try {
        await runReconciliation(orderId);
    } catch (error) {
        console.error(
            "Telegram access revocation: unexpected error",
            error instanceof Error ? error.name : "unknown",
        );
    }
}

/**
 * Processes a small batch of TelegramAccess rows that are due for a
 * retry — either a REVOCATION_FAILED row whose backoff has elapsed, or
 * a REVOCATION_PENDING row that looks abandoned. Returns how many
 * candidates were picked up (not how many succeeded — each one is
 * re-verified and processed idempotently via
 * reconcileTelegramAccessForOrder).
 */
export async function retryDueTelegramAccessRevocations(
    batchSize: number,
): Promise<number> {
    const now = new Date();
    const stuckCutoff = new Date(Date.now() - STUCK_PENDING_MS);

    const candidates = await prisma.telegramAccess.findMany({
        where: {
            OR: [
                { status: "REVOCATION_FAILED", nextRevocationAttemptAt: { lte: now } },
                { status: "REVOCATION_PENDING", revocationStartedAt: { lt: stuckCutoff } },
            ],
        },
        select: { orderId: true },
        orderBy: { updatedAt: "asc" },
        take: batchSize,
    });

    for (const candidate of candidates) {
        await reconcileTelegramAccessForOrder(candidate.orderId);
    }

    return candidates.length;
}

async function runReconciliation(orderId: string): Promise<void> {
    const order = await loadRevocationTarget(orderId);

    if (!order || !order.telegramAccess) {
        return;
    }

    const decision = getTelegramEntitlementDecision(order);

    if (decision === "ELIGIBLE" || decision === "UNCHANGED") {
        return;
    }

    if (decision === "REVIEW_REQUIRED") {
        await markManualReview(order.telegramAccess);
        return;
    }

    const reason = getTelegramIneligibilityReason(order);
    await processRevocation(order.telegramAccess, reason);
}

/**
 * Flags an access record for human review without touching Telegram
 * at all — used for partial chargeback, where the project has no
 * automatic revocation policy. A human resolving this manually is the
 * only way out of MANUAL_REVIEW; a later automated pass must not
 * silently override it.
 */
async function markManualReview(access: RevocationAccess): Promise<void> {
    if (access.status === "MANUAL_REVIEW" || access.status === "REVOKED") {
        return;
    }

    await prisma.telegramAccess.updateMany({
        where: {
            id: access.id,
            operationVersion: access.operationVersion,
            status: access.status,
        },
        data: {
            status: "MANUAL_REVIEW",
            revocationReason: "PARTIAL_CHARGEBACK_REVIEW",
            removalOutcome: "MANUAL_REVIEW_REQUIRED",
            operationVersion: { increment: 1 },
        },
    });
}

type ClaimResult =
    | { claimed: true; version: number }
    | { claimed: false };

/**
 * Conditional claim into REVOCATION_PENDING — the sole point where
 * concurrent workers race, guarded by `operationVersion` so only one
 * of them proceeds. A lost race, an already-REVOKED row, or a row
 * still being actively worked on by another (non-stuck) attempt all
 * resolve to `claimed: false`, which callers treat as an idempotent
 * no-op — never as an error.
 */
async function claimForRevocation(
    access: RevocationAccess,
    reason: TelegramIneligibilityReason,
): Promise<ClaimResult> {
    if (access.status === "REVOKED" || access.status === "MANUAL_REVIEW") {
        // REVOKED: already done. MANUAL_REVIEW: a human checkpoint —
        // never silently overridden by an automated pass.
        return { claimed: false };
    }

    const stuckCutoff = new Date(Date.now() - STUCK_PENDING_MS);
    const isStuckPending =
        access.status === "REVOCATION_PENDING" &&
        access.revocationStartedAt !== null &&
        access.revocationStartedAt < stuckCutoff;

    if (access.status === "REVOCATION_PENDING" && !isStuckPending) {
        // Actively being processed by another worker/request.
        return { claimed: false };
    }

    const now = new Date();

    const result = await prisma.telegramAccess.updateMany({
        where: {
            id: access.id,
            operationVersion: access.operationVersion,
            status: access.status,
        },
        data: {
            status: "REVOCATION_PENDING",
            revocationReason: reason,
            revocationRequestedAt: access.revocationRequestedAt ?? now,
            revocationStartedAt: now,
            operationVersion: { increment: 1 },
        },
    });

    if (result.count !== 1) {
        return { claimed: false };
    }

    return { claimed: true, version: access.operationVersion + 1 };
}

type RevocationStep = "lookup" | "ban" | "unban" | "verify" | "invite_revoke";

/**
 * Maps a Telegram client error to a safe internal code. Never inspects
 * or persists the raw Telegram error description — TelegramApiError's
 * message is already generic (see lib/telegram.ts), and only the
 * numeric error_code (if any) and the step that failed are used.
 */
function classifyTelegramError(error: unknown, step: RevocationStep): string {
    if (error instanceof TelegramTimeoutError) return "TELEGRAM_TIMEOUT";
    if (error instanceof TelegramNetworkError) return "TELEGRAM_HTTP_ERROR";
    if (error instanceof TelegramConfigError) return "TELEGRAM_HTTP_ERROR";

    if (error instanceof TelegramApiError && error.errorCode === 403) {
        return "TELEGRAM_PERMISSION_DENIED";
    }

    switch (step) {
        case "lookup":
            return "TELEGRAM_MEMBER_LOOKUP_FAILED";
        case "ban":
            return "TELEGRAM_BAN_FAILED";
        case "unban":
            return "TELEGRAM_UNBAN_FAILED";
        case "verify":
            return "TELEGRAM_VERIFICATION_FAILED";
        case "invite_revoke":
            return "INVITE_REVOCATION_FAILED";
    }
}

async function markRevocationFailed(
    accessId: string,
    version: number,
    errorCode: string,
): Promise<void> {
    const current = await prisma.telegramAccess.findUnique({
        where: { id: accessId },
        select: { revocationAttemptCount: true },
    });

    const attempt = (current?.revocationAttemptCount ?? 0) + 1;
    const backoffMs = Math.min(
        BASE_BACKOFF_MS * 2 ** Math.min(attempt - 1, 10),
        MAX_BACKOFF_MS,
    );

    await prisma.telegramAccess.updateMany({
        where: { id: accessId, operationVersion: version, status: "REVOCATION_PENDING" },
        data: {
            status: "REVOCATION_FAILED",
            revocationAttemptCount: { increment: 1 },
            lastRevocationAttemptAt: new Date(),
            lastRevocationErrorCode: errorCode,
            nextRevocationAttemptAt: new Date(Date.now() + backoffMs),
            operationVersion: { increment: 1 },
        },
    });

    console.error("Telegram access revocation attempt failed", {
        attempt,
        errorCode,
    });
}

async function finalizeRevoked(
    accessId: string,
    version: number,
    outcome: "REMOVED" | "ALREADY_NOT_MEMBER" | "SKIPPED_OTHER_ENTITLEMENT",
): Promise<void> {
    await prisma.telegramAccess.updateMany({
        where: { id: accessId, operationVersion: version, status: "REVOCATION_PENDING" },
        data: {
            status: "REVOKED",
            revokedAt: new Date(),
            removalOutcome: outcome,
            lastRevocationErrorCode: null,
            nextRevocationAttemptAt: null,
            operationVersion: { increment: 1 },
        },
    });
}

async function finalizeManualReviewFromPending(
    accessId: string,
    version: number,
): Promise<void> {
    await prisma.telegramAccess.updateMany({
        where: { id: accessId, operationVersion: version, status: "REVOCATION_PENDING" },
        data: {
            status: "MANUAL_REVIEW",
            removalOutcome: "MANUAL_REVIEW_REQUIRED",
            lastRevocationErrorCode: null,
            nextRevocationAttemptAt: null,
            operationVersion: { increment: 1 },
        },
    });
}

/**
 * Best-effort DM — a failure here must never undo or block a
 * revocation that has already been finalized in the database.
 */
async function notifyAccessRevoked(telegramUserId: number): Promise<void> {
    try {
        await sendTelegramMessage(telegramUserId, ACCESS_REVOKED_MESSAGE);
    } catch (error) {
        console.error(
            "Telegram access revocation: notification failed",
            error instanceof Error ? error.name : "unknown",
        );
    }
}

/**
 * Revokes the Order's own invite link (if any) and clears the raw
 * link from the database. Returns false on failure so the caller can
 * mark the access retryable — an un-revoked invite link must not be
 * silently ignored.
 */
async function revokeOrderInviteLink(
    accessId: string,
    version: number,
    inviteLink: string | null,
): Promise<boolean> {
    if (!inviteLink) return true;

    try {
        await revokeChannelInviteLink(inviteLink);
    } catch (error) {
        await markRevocationFailed(
            accessId,
            version,
            classifyTelegramError(error, "invite_revoke"),
        );
        return false;
    }

    await prisma.telegramAccess
        .update({
            where: { id: accessId },
            data: {
                inviteLink: null,
                inviteLinkHash: null,
                inviteLinkName: null,
                inviteExpiresAt: null,
            },
        })
        .catch(() => {});

    return true;
}

/**
 * Another Order for the same Telegram account still legitimately
 * entitles it to this channel — checked against the database, not
 * just the current Order, so a still-PAID sibling Order always wins.
 */
async function findOtherValidEntitlement(
    telegramAccountId: string,
    excludingAccessId: string,
) {
    return prisma.telegramAccess.findFirst({
        where: {
            telegramAccountId,
            id: { not: excludingAccessId },
            status: { not: "REVOKED" },
            order: { status: "PAID" },
        },
        select: { id: true },
    });
}

/** Bans then immediately unbans, verifying the end state via getChatMember. */
async function removeChannelMembership(
    accessId: string,
    version: number,
    telegramUserId: number,
): Promise<boolean> {
    try {
        await banChannelMember(telegramUserId);
    } catch (error) {
        await markRevocationFailed(accessId, version, classifyTelegramError(error, "ban"));
        return false;
    }

    try {
        await unbanChannelMember(telegramUserId);
    } catch (error) {
        await markRevocationFailed(accessId, version, classifyTelegramError(error, "unban"));
        return false;
    }

    try {
        const verified = await getChannelMember(telegramUserId);
        if (isActiveChannelMember(verified.status)) {
            await markRevocationFailed(accessId, version, "TELEGRAM_VERIFICATION_FAILED");
            return false;
        }
    } catch (error) {
        await markRevocationFailed(accessId, version, classifyTelegramError(error, "verify"));
        return false;
    }

    return true;
}

async function processRevocation(
    access: RevocationAccess,
    reason: TelegramIneligibilityReason,
): Promise<void> {
    const claim = await claimForRevocation(access, reason);
    if (!claim.claimed) return;

    const accessId = access.id;
    const version = claim.version;

    const inviteOk = await revokeOrderInviteLink(accessId, version, access.inviteLink);
    if (!inviteOk) return;

    const otherEntitlement = await findOtherValidEntitlement(
        access.telegramAccountId,
        accessId,
    );

    if (otherEntitlement) {
        await finalizeRevoked(accessId, version, "SKIPPED_OTHER_ENTITLEMENT");
        return;
    }

    const telegramUserId = Number(access.telegramAccount.telegramUserId);

    let member;
    try {
        member = await getChannelMember(telegramUserId);
    } catch (error) {
        await markRevocationFailed(accessId, version, classifyTelegramError(error, "lookup"));
        return;
    }

    if (isPrivilegedChannelMember(member.status)) {
        // Administrator/creator — never demoted or removed automatically.
        await finalizeManualReviewFromPending(accessId, version);
        return;
    }

    if (!isActiveChannelMember(member.status)) {
        // "left" or "kicked" — already not a member.
        if (member.status === "kicked") {
            try {
                await unbanChannelMember(telegramUserId);
            } catch (error) {
                await markRevocationFailed(
                    accessId,
                    version,
                    classifyTelegramError(error, "unban"),
                );
                return;
            }
        }

        await finalizeRevoked(accessId, version, "ALREADY_NOT_MEMBER");
        await notifyAccessRevoked(telegramUserId);
        return;
    }

    const removed = await removeChannelMembership(accessId, version, telegramUserId);
    if (!removed) return;

    await finalizeRevoked(accessId, version, "REMOVED");
    await notifyAccessRevoked(telegramUserId);
}
