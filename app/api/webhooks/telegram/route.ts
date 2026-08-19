import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import {
    sendTelegramMessage,
    type TelegramChatJoinRequest,
    type TelegramChatMemberUpdated,
    type TelegramMessage,
    type TelegramUpdate,
} from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET_TOKEN_HEADER = "x-telegram-bot-api-secret-token";

const PRIVATE_START_WELCOME_MESSAGE =
    "Halo! Bot berhasil terhubung.\n\n" +
    "Akses grup akan tersedia setelah pembayaran kamu dikonfirmasi. " +
    "Silakan kembali ke website untuk melanjutkan.";

const LINKING_NOT_AVAILABLE_MESSAGE =
    "Fitur penghubung akun Telegram akan tersedia pada tahap berikutnya.";

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

async function handlePrivateStart(message: TelegramMessage) {
    const text = message.text?.trim() ?? "";
    const hasParameter = text.length > "/start".length;

    try {
        if (hasParameter) {
            await sendTelegramMessage(
                message.chat.id,
                LINKING_NOT_AVAILABLE_MESSAGE,
            );
        } else {
            await sendTelegramMessage(
                message.chat.id,
                PRIVATE_START_WELCOME_MESSAGE,
            );
        }
    } catch (error) {
        console.error(
            "Gagal mengirim balasan /start:",
            error instanceof Error ? error.message : "unknown error",
        );
    }
}

async function handleMessage(message: TelegramMessage) {
    if (message.chat.type !== "private") {
        return;
    }

    const text = message.text?.trim() ?? "";

    if (!text.startsWith("/start")) {
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
    // Intentionally not processed in this milestone: no approve, decline,
    // Order lookup, or linking. Handled in a future milestone.
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
