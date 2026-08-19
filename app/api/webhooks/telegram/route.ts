import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
    sendTelegramMessage,
    type TelegramChatJoinRequest,
    type TelegramChatMemberUpdated,
    type TelegramMessage,
    type TelegramUpdate,
} from "@/lib/telegram";
import {
    hashLinkToken,
    isValidRawTokenFormat,
} from "@/lib/telegram-linking";

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

function handleChatJoinRequest(_update: TelegramChatJoinRequest) {
    // Intentionally not processed in this milestone: no approve,
    // decline, invite link, or channel access grant. Handled in
    // Milestone 13.
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

    try {
        if (update.message) {
            await handleMessage(update.message);
        } else if (update.my_chat_member) {
            handleMyChatMember(update.my_chat_member);
        } else if (update.chat_join_request) {
            handleChatJoinRequest(update.chat_join_request);
        }
    } catch (error) {
        // Any unexpected handler failure still returns 200 so Telegram
        // does not endlessly retry this update.
        console.error("Telegram webhook handler error:", error);
    }

    return NextResponse.json({ ok: true });
}
