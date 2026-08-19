import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
    sendTelegramMessage,
    TelegramConfigError,
    TelegramNetworkError,
    TelegramTimeoutError,
    type TelegramChatJoinRequest,
    type TelegramChatMemberUpdated,
    type TelegramMessage,
    type TelegramUpdate,
} from "@/lib/telegram";
import {
    hashLinkToken,
    isValidRawTokenFormat,
} from "@/lib/telegram-linking";
import { hashInviteLink } from "@/lib/telegram-channel-access";
import {
    approveChannelJoinRequest,
    declineChannelJoinRequest,
    getChannelMember,
    isActiveChannelMember,
    isConfiguredChannel,
    revokeChannelInviteLink,
} from "@/lib/telegram-channel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET_TOKEN_HEADER = "x-telegram-bot-api-secret-token";

const PRIVATE_START_WELCOME_MESSAGE =
    "Halo! Bot berhasil terhubung.\n\n" +
    "Akses ke private channel akan tersedia setelah pembayaran kamu " +
    "dikonfirmasi. Silakan kembali ke website untuk melanjutkan.";

const LINK_SUCCESS_MESSAGE =
    "Akun Telegram berhasil terhubung.\n\n" +
    "Silakan kembali ke website. Akses ke private channel akan " +
    "diproses pada langkah berikutnya.";

const LINK_ALREADY_LINKED_SAME_MESSAGE =
    "Akun Telegram ini sudah terhubung.";

const LINK_REGISTRATION_LINKED_TO_OTHER_MESSAGE =
    "Pendaftaran ini sudah terhubung ke akun Telegram lain. Silakan " +
    "hubungi administrator jika kamu perlu mengganti akun.";

const LINK_TELEGRAM_ACCOUNT_TAKEN_MESSAGE =
    "Akun Telegram ini sudah terhubung ke pendaftaran lain. Silakan " +
    "hubungi administrator.";

const LINK_INVALID_MESSAGE =
    "Tautan penghubung tidak valid atau sudah kedaluwarsa. Silakan " +
    "kembali ke website untuk membuat tautan baru.";

const JOIN_REQUEST_APPROVED_MESSAGE =
    "Permintaan bergabung ke private channel sudah disetujui. Silakan " +
    "buka channel Telegram Anda.";

const JOIN_REQUEST_DECLINED_MESSAGE =
    "Permintaan bergabung tidak dapat diproses. Silakan ambil tautan " +
    "baru dari website.";

// Matches "/start", "/start TOKEN", "/start@BotUsername", and
// "/start@BotUsername TOKEN" — nothing else. Group 1 captures the raw
// token when present.
const START_COMMAND_PATTERN =
    /^\/start(?:@[A-Za-z0-9_]{1,64})?(?:\s+([A-Za-z0-9_-]{1,64}))?$/;

type LinkOutcome =
    | { kind: "linked" }
    | { kind: "already-linked-same" }
    | { kind: "already-linked-other" }
    | { kind: "telegram-account-taken" }
    | { kind: "invalid" };

// "ok": fully handled (approved, declined, ignored — nothing more to
// do). "retry": a transient failure occurred while a join request
// should have been approved; returning a non-2xx status tells Telegram
// to redeliver this update so we get another chance.
type JoinRequestOutcome = "ok" | "retry";

function isValidSecretToken(receivedSecret: string | null): boolean {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    if (!expectedSecret) {
        console.error(
            "TELEGRAM_WEBHOOK_SECRET belum dikonfigurasi",
        );
        return false;
    }

    if (!receivedSecret) {
        return false;
    }

    const receivedBuffer = Buffer.from(receivedSecret);
    const expectedBuffer = Buffer.from(expectedSecret);

    if (receivedBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return timingSafeEqual(receivedBuffer, expectedBuffer);
}

function isForwardedMessage(message: TelegramMessage): boolean {
    return (
        message.forward_date !== undefined ||
        message.forward_origin !== undefined
    );
}

async function sendSafeMessage(chatId: number, text: string) {
    try {
        await sendTelegramMessage(chatId, text);
    } catch (error) {
        console.error(
            "Gagal mengirim balasan Telegram:",
            error instanceof Error ? error.message : "unknown error",
        );
    }
}

/**
 * Consumes a Telegram link token atomically. All decisions are made
 * inside a single Prisma transaction: the token is only marked used via
 * a conditional `updateMany` (id + usedAt: null + revokedAt: null +
 * expiresAt in the future), so a concurrent attempt on the same token
 * always resolves to 0 rows updated and is treated as invalid — this is
 * what prevents double-linking under a race.
 */
async function consumeLinkToken(
    rawToken: string,
    telegramUserId: string,
): Promise<LinkOutcome> {
    const tokenHash = hashLinkToken(rawToken);

    try {
        return await prisma.$transaction(async (tx) => {
            const tokenRecord = await tx.telegramLinkToken.findUnique({
                where: { tokenHash },
                select: {
                    id: true,
                    usedAt: true,
                    revokedAt: true,
                    expiresAt: true,
                    order: {
                        select: {
                            status: true,
                            registration: {
                                select: {
                                    id: true,
                                    telegramAccount: {
                                        select: { telegramUserId: true },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            if (
                !tokenRecord ||
                tokenRecord.usedAt ||
                tokenRecord.revokedAt ||
                tokenRecord.expiresAt.getTime() <= Date.now()
            ) {
                return { kind: "invalid" };
            }

            const { order } = tokenRecord;

            if (!order || order.status !== "PAID" || !order.registration) {
                return { kind: "invalid" };
            }

            const { registration } = order;

            if (registration.telegramAccount) {
                return registration.telegramAccount.telegramUserId ===
                    telegramUserId
                    ? { kind: "already-linked-same" }
                    : { kind: "already-linked-other" };
            }

            const telegramAccountInUse =
                await tx.telegramAccount.findUnique({
                    where: { telegramUserId },
                    select: { id: true },
                });

            if (telegramAccountInUse) {
                return { kind: "telegram-account-taken" };
            }

            const consumed = await tx.telegramLinkToken.updateMany({
                where: {
                    id: tokenRecord.id,
                    usedAt: null,
                    revokedAt: null,
                    expiresAt: { gt: new Date() },
                },
                data: { usedAt: new Date() },
            });

            if (consumed.count !== 1) {
                return { kind: "invalid" };
            }

            await tx.telegramAccount.create({
                data: {
                    registrationId: registration.id,
                    telegramUserId,
                },
            });

            return { kind: "linked" };
        });
    } catch (error) {
        // Covers unexpected DB errors, including a unique-constraint
        // race on TelegramAccount that the pre-checks above didn't
        // catch. Fail safe with a generic "invalid" outcome — never
        // leak internals to the Telegram reply.
        console.error(
            "Telegram linking transaction error:",
            error instanceof Error ? error.message : "unknown error",
        );
        return { kind: "invalid" };
    }
}

async function handleLinkAttempt(
    message: TelegramMessage,
    rawToken: string,
) {
    if (!isValidRawTokenFormat(rawToken) || !message.from) {
        await sendSafeMessage(message.chat.id, LINK_INVALID_MESSAGE);
        return;
    }

    const telegramUserId = String(message.from.id);
    const outcome = await consumeLinkToken(rawToken, telegramUserId);

    switch (outcome.kind) {
        case "linked":
            await sendSafeMessage(message.chat.id, LINK_SUCCESS_MESSAGE);
            return;
        case "already-linked-same":
            await sendSafeMessage(
                message.chat.id,
                LINK_ALREADY_LINKED_SAME_MESSAGE,
            );
            return;
        case "already-linked-other":
            await sendSafeMessage(
                message.chat.id,
                LINK_REGISTRATION_LINKED_TO_OTHER_MESSAGE,
            );
            return;
        case "telegram-account-taken":
            await sendSafeMessage(
                message.chat.id,
                LINK_TELEGRAM_ACCOUNT_TAKEN_MESSAGE,
            );
            return;
        case "invalid":
        default:
            await sendSafeMessage(message.chat.id, LINK_INVALID_MESSAGE);
    }
}

async function handlePrivateStart(message: TelegramMessage) {
    const text = message.text?.trim() ?? "";
    const match = START_COMMAND_PATTERN.exec(text);

    if (!match) {
        return;
    }

    const rawToken = match[1];

    if (!rawToken) {
        await sendSafeMessage(
            message.chat.id,
            PRIVATE_START_WELCOME_MESSAGE,
        );
        return;
    }

    // Linking must only ever be triggered by the user tapping the deep
    // link themselves in a private chat — never from a forwarded
    // message, which could replay someone else's token attempt.
    if (isForwardedMessage(message)) {
        await sendSafeMessage(message.chat.id, LINK_INVALID_MESSAGE);
        return;
    }

    await handleLinkAttempt(message, rawToken);
}

async function handleMessage(message: TelegramMessage) {
    // Linking (and the welcome reply) only ever applies to a private
    // chat with the bot — never a channel, group, supergroup, or a
    // channel's linked discussion group.
    if (message.chat.type !== "private") {
        return;
    }

    await handlePrivateStart(message);
}

function handleMyChatMember(update: TelegramChatMemberUpdated) {
    console.log("Bot membership status updated", {
        chatType: update.chat.type,
        chatId: update.chat.id,
        status: update.new_chat_member.status,
    });
}

// --- chat_join_request handling -------------------------------------

async function declineSafely(telegramUserId: number) {
    try {
        await declineChannelJoinRequest(telegramUserId);
    } catch (error) {
        console.error(
            "Channel join request decline failed:",
            error instanceof Error ? error.name : "unknown error",
        );
    }

    await sendSafeMessage(telegramUserId, JOIN_REQUEST_DECLINED_MESSAGE);
}

async function grantAccess(accessId: string, telegramUserId: number) {
    const current = await prisma.telegramAccess.findUnique({
        where: { id: accessId },
        select: { inviteLink: true, status: true },
    });

    if (current?.status === "GRANTED") {
        return;
    }

    if (current?.inviteLink) {
        try {
            await revokeChannelInviteLink(current.inviteLink);
        } catch (error) {
            console.error(
                "Channel join request: post-approve revoke failed:",
                error instanceof Error ? error.name : "unknown error",
            );
        }
    }

    await prisma.telegramAccess.update({
        where: { id: accessId },
        data: {
            status: "GRANTED",
            grantedAt: new Date(),
            inviteLink: null,
            inviteLinkHash: null,
            inviteLinkName: null,
            inviteExpiresAt: null,
        },
    });
}

/**
 * Recovery path used both when an access record is unexpectedly already
 * "REQUESTED" (a previous attempt may have approved on Telegram's side
 * but failed to save that locally) and after a failed
 * approveChatJoinRequest call. Trusts Telegram's live membership over
 * local state.
 */
async function reconcileStuckRequest(
    accessId: string,
    telegramUserId: number,
): Promise<JoinRequestOutcome> {
    try {
        const member = await getChannelMember(telegramUserId);

        if (isActiveChannelMember(member.status)) {
            await grantAccess(accessId, telegramUserId);
            await sendSafeMessage(
                telegramUserId,
                JOIN_REQUEST_APPROVED_MESSAGE,
            );
            return "ok";
        }
    } catch (error) {
        console.error(
            "Channel join request: reconciliation getChatMember failed:",
            error instanceof Error ? error.name : "unknown error",
        );
    }

    // Not (yet) a member and nothing more we can safely do here — this
    // specific join request appears gone. Revert to INVITED so the
    // underlying invite link (if still valid) remains usable for a
    // fresh join request.
    await prisma.telegramAccess
        .updateMany({
            where: { id: accessId, status: "REQUESTED" },
            data: { status: "INVITED" },
        })
        .catch(() => {});

    return "ok";
}

async function handleApproveFailure(
    accessId: string,
    telegramUserId: number,
    error: unknown,
): Promise<JoinRequestOutcome> {
    console.error(
        "Channel join request: approveChatJoinRequest failed:",
        error instanceof Error ? error.name : "unknown error",
    );

    if (
        error instanceof TelegramNetworkError ||
        error instanceof TelegramTimeoutError ||
        error instanceof TelegramConfigError
    ) {
        // Genuinely transient/systemic — undo the claim so a retried
        // delivery of this same update can attempt approval again.
        await prisma.telegramAccess
            .update({
                where: { id: accessId },
                data: { status: "INVITED" },
            })
            .catch(() => {});
        return "retry";
    }

    // A TelegramApiError here typically means Telegram no longer has
    // this join request (e.g. "request not found") — reconcile via live
    // membership rather than assume failure.
    return reconcileStuckRequest(accessId, telegramUserId);
}

async function approveAndFinalize(
    accessId: string,
    telegramUserId: number,
): Promise<JoinRequestOutcome> {
    try {
        await approveChannelJoinRequest(telegramUserId);
    } catch (error) {
        return handleApproveFailure(accessId, telegramUserId, error);
    }

    try {
        await grantAccess(accessId, telegramUserId);
    } catch (dbError) {
        console.error(
            "Channel join request: post-approve DB update failed:",
            dbError instanceof Error ? dbError.name : "unknown error",
        );
        // Telegram-side approval already succeeded; leave status
        // REQUESTED so a retried delivery reconciles via getChatMember
        // instead of re-approving.
        return "retry";
    }

    await sendSafeMessage(telegramUserId, JOIN_REQUEST_APPROVED_MESSAGE);
    return "ok";
}

async function processJoinRequest(
    request: TelegramChatJoinRequest,
): Promise<JoinRequestOutcome> {
    if (
        !isConfiguredChannel(request.chat.id) ||
        request.chat.type !== "channel"
    ) {
        // Not the configured channel, or somehow not a channel at all
        // (e.g. a linked discussion group) — out of scope, ignore.
        return "ok";
    }

    const telegramUserId = request.from?.id;

    if (!telegramUserId) {
        return "ok";
    }

    const rawInviteLink = request.invite_link?.invite_link;

    if (!rawInviteLink) {
        await declineSafely(telegramUserId);
        return "ok";
    }

    const inviteLinkHash = hashInviteLink(rawInviteLink);

    const access = await prisma.telegramAccess.findUnique({
        where: { inviteLinkHash },
        select: {
            id: true,
            status: true,
            inviteExpiresAt: true,
            telegramAccount: { select: { telegramUserId: true } },
            order: { select: { status: true } },
        },
    });

    if (!access) {
        await declineSafely(telegramUserId);
        return "ok";
    }

    if (access.telegramAccount.telegramUserId !== String(telegramUserId)) {
        await declineSafely(telegramUserId);
        return "ok";
    }

    if (access.order.status !== "PAID") {
        await declineSafely(telegramUserId);
        return "ok";
    }

    if (access.status === "GRANTED") {
        // Duplicate delivery after success — idempotent no-op.
        return "ok";
    }

    if (access.status === "REQUESTED") {
        return reconcileStuckRequest(access.id, telegramUserId);
    }

    if (access.status !== "INVITED") {
        // REVOKED / FAILED / ELIGIBLE — nothing valid to approve.
        await declineSafely(telegramUserId);
        return "ok";
    }

    if (
        !access.inviteExpiresAt ||
        access.inviteExpiresAt.getTime() <= Date.now()
    ) {
        await declineSafely(telegramUserId);
        return "ok";
    }

    // Atomic conditional claim: only one concurrent delivery of this
    // update can move this specific access row from INVITED to
    // REQUESTED. A lost race means another delivery is already handling
    // it — let it finish.
    const claimed = await prisma.telegramAccess.updateMany({
        where: { id: access.id, status: "INVITED" },
        data: { status: "REQUESTED", joinRequestedAt: new Date() },
    });

    if (claimed.count !== 1) {
        return "ok";
    }

    return approveAndFinalize(access.id, telegramUserId);
}

async function shouldSkipDuplicateJoinRequest(
    updateId: string,
): Promise<boolean> {
    const existing = await prisma.telegramWebhookEvent.findUnique({
        where: { updateId },
        select: { status: true },
    });

    return existing?.status === "done";
}

async function recordJoinRequestEvent(updateId: string, status: string) {
    await prisma.telegramWebhookEvent
        .upsert({
            where: { updateId },
            create: {
                updateId,
                eventType: "chat_join_request",
                status,
                processedAt: status === "done" ? new Date() : null,
            },
            update: {
                status,
                processedAt: status === "done" ? new Date() : null,
            },
        })
        .catch((error) => {
            console.error(
                "Failed to record Telegram webhook event:",
                error instanceof Error ? error.name : "unknown error",
            );
        });
}

async function handleChatJoinRequest(
    request: TelegramChatJoinRequest,
    updateId: string,
): Promise<JoinRequestOutcome> {
    // Idempotency fast path: if we already fully processed this exact
    // update_id to completion, skip re-processing entirely. Anything
    // not marked "done" (including a previous "retry") is safe to
    // reprocess — every step above is itself idempotent via the
    // conditional updateMany claim and the reconciliation fallbacks.
    if (await shouldSkipDuplicateJoinRequest(updateId)) {
        return "ok";
    }

    let outcome: JoinRequestOutcome;

    try {
        outcome = await processJoinRequest(request);
    } catch (error) {
        console.error(
            "Channel join request: unexpected processing error:",
            error instanceof Error ? error.name : "unknown error",
        );
        await recordJoinRequestEvent(updateId, "failed");
        return "retry";
    }

    // Only ever marked "done" once processing has fully completed — a
    // "retry" outcome is recorded as "failed" so a redelivery is not
    // treated as a duplicate.
    await recordJoinRequestEvent(updateId, outcome === "ok" ? "done" : "failed");

    return outcome;
}

export async function POST(request: Request) {
    const receivedSecret = request.headers.get(SECRET_TOKEN_HEADER);

    if (!isValidSecretToken(receivedSecret)) {
        return NextResponse.json(
            { message: "Unauthorized" },
            { status: 401 },
        );
    }

    let update: TelegramUpdate;

    try {
        const rawBody = await request.text();
        const parsed: unknown = JSON.parse(rawBody);

        if (
            !parsed ||
            typeof parsed !== "object" ||
            typeof (parsed as { update_id?: unknown }).update_id !==
                "number"
        ) {
            throw new Error("invalid update payload");
        }

        update = parsed as TelegramUpdate;
    } catch {
        return NextResponse.json(
            { message: "Payload webhook tidak valid" },
            { status: 400 },
        );
    }

    if (update.chat_join_request) {
        const outcome = await handleChatJoinRequest(
            update.chat_join_request,
            String(update.update_id),
        );

        if (outcome === "retry") {
            return NextResponse.json(
                { message: "Gangguan sementara" },
                { status: 503 },
            );
        }

        return NextResponse.json({ ok: true });
    }

    try {
        if (update.message) {
            await handleMessage(update.message);
        } else if (update.my_chat_member) {
            handleMyChatMember(update.my_chat_member);
        }
    } catch (error) {
        // Any unexpected handler failure still returns 200 so Telegram
        // does not endlessly retry this update — unlike
        // chat_join_request, retrying these has no benefit.
        console.error("Telegram webhook handler error:", error);
    }

    return NextResponse.json({ ok: true });
}
