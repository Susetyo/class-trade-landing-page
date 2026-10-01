import {
    fetchWithTimeout,
    HttpNetworkError,
    HttpTimeoutError,
    isRetryableHttpStatus,
    parseRetryAfterMs,
} from "@/lib/http-client";
import { getOutboundHttpConfig } from "@/lib/env";
import { logger } from "@/lib/logger";
import { withRetry } from "@/lib/retry";

const TELEGRAM_API_BASE_URL = "https://api.telegram.org";

export class TelegramConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TelegramConfigError";
    }
}

export class TelegramNetworkError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TelegramNetworkError";
    }
}

export class TelegramTimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TelegramTimeoutError";
    }
}

export class TelegramApiError extends Error {
    errorCode?: number;
    retryAfterMs?: number;

    constructor(message: string, errorCode?: number, retryAfterMs?: number) {
        super(message);
        this.name = "TelegramApiError";
        this.errorCode = errorCode;
        this.retryAfterMs = retryAfterMs;
    }
}

/**
 * Milestone 15 §7 classification for `withRetry`: timeouts, network
 * errors, HTTP 429 (Telegram's flood-control `error_code`), and 5xx
 * are retryable; everything else (bad request, auth, permission
 * errors) is not.
 */
function classifyTelegramRetry(error: unknown): { retryable: boolean; retryAfterMs?: number } {
    if (error instanceof TelegramTimeoutError || error instanceof TelegramNetworkError) {
        return { retryable: true };
    }

    if (error instanceof TelegramApiError) {
        const status = error.errorCode;
        if (status !== undefined && isRetryableHttpStatus(status)) {
            return { retryable: true, retryAfterMs: error.retryAfterMs };
        }
    }

    return { retryable: false };
}

type TelegramApiResponse<T> = {
    ok: boolean;
    result?: T;
    description?: string;
    error_code?: number;
};

export type TelegramUser = {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
};

export type TelegramChatType =
    | "private"
    | "group"
    | "supergroup"
    | "channel";

export type TelegramChat = {
    id: number;
    type: TelegramChatType;
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
};

export type TelegramChatMemberStatus =
    | "creator"
    | "administrator"
    | "member"
    | "restricted"
    | "left"
    | "kicked";

export type TelegramChatMember = {
    status: TelegramChatMemberStatus;
    user: TelegramUser;
    can_invite_users?: boolean;
    can_restrict_members?: boolean;
};

export type TelegramMessage = {
    message_id: number;
    date: number;
    chat: TelegramChat;
    from?: TelegramUser;
    text?: string;
    // Presence of either field means this message was forwarded rather
    // than typed/tapped directly by the sender.
    forward_date?: number;
    forward_origin?: unknown;
};

export type TelegramChatMemberUpdated = {
    chat: TelegramChat;
    from: TelegramUser;
    date: number;
    old_chat_member: TelegramChatMember;
    new_chat_member: TelegramChatMember;
};

export type TelegramChatInviteLink = {
    invite_link: string;
    creator: TelegramUser;
    creates_join_request: boolean;
    is_primary: boolean;
    is_revoked: boolean;
    name?: string;
    expire_date?: number;
    member_limit?: number;
};

export type TelegramChatJoinRequest = {
    chat: TelegramChat;
    from: TelegramUser;
    date: number;
    bio?: string;
    invite_link?: TelegramChatInviteLink;
};

export type TelegramUpdate = {
    update_id: number;
    message?: TelegramMessage;
    my_chat_member?: TelegramChatMemberUpdated;
    chat_join_request?: TelegramChatJoinRequest;
};

export type TelegramWebhookInfo = {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
    allowed_updates?: string[];
};

function getBotToken(): string {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
        throw new TelegramConfigError(
            "TELEGRAM_BOT_TOKEN belum dikonfigurasi",
        );
    }

    return token;
}

/** Single attempt — no retry. See `telegramRequest` for the retrying wrapper. */
async function doTelegramRequest<T>(
    method: string,
    body: Record<string, unknown> | undefined,
    timeoutMs: number,
): Promise<T> {
    const token = getBotToken();

    let response: Response;

    try {
        response = await fetchWithTimeout(
            `${TELEGRAM_API_BASE_URL}/bot${token}/${method}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: body ? JSON.stringify(body) : undefined,
                cache: "no-store",
            },
            timeoutMs,
        );
    } catch (error) {
        if (error instanceof HttpTimeoutError) {
            throw new TelegramTimeoutError(`Telegram API request timeout: ${method}`);
        }
        if (error instanceof HttpNetworkError) {
            throw new TelegramNetworkError(`Telegram API network error: ${method}`);
        }
        throw error;
    }

    let payload: TelegramApiResponse<T>;

    try {
        payload = await response.json();
    } catch {
        throw new TelegramApiError(
            `Telegram API mengembalikan response yang tidak valid: ${method}`,
        );
    }

    if (!response.ok || !payload.ok) {
        logger.error("Telegram API error", {
            event: "telegram.api_error",
            method,
            httpStatus: response.status,
            errorCode: payload.error_code,
        });

        throw new TelegramApiError(
            `Telegram API error pada method ${method}`,
            payload.error_code ?? response.status,
            parseRetryAfterMs(response.headers.get("retry-after")),
        );
    }

    return payload.result as T;
}

/**
 * Telegram Bot API request. Never logs the request URL or request
 * body — both may contain the bot token or update payloads. Retries
 * (bounded, exponential backoff + jitter) only when `retryable` is
 * true — callers must only pass `true` for operations that are safe
 * to repeat (reads, and writes Telegram already treats as idempotent
 * such as ban/unban/approve/revoke). `sendMessage` and
 * `createChatInviteLink` are never retried here — see
 * docs/telegram-setup.md §12.
 */
export async function telegramRequest<T>(
    method: string,
    body?: Record<string, unknown>,
    options?: { timeoutMs?: number; retryable?: boolean },
): Promise<T> {
    const outbound = getOutboundHttpConfig();
    const timeoutMs = options?.timeoutMs ?? outbound.timeoutMs;
    const retryable = options?.retryable ?? true;

    if (!retryable) {
        return doTelegramRequest<T>(method, body, timeoutMs);
    }

    return withRetry(() => doTelegramRequest<T>(method, body, timeoutMs), {
        maxRetries: outbound.maxRetries,
        baseDelayMs: outbound.retryBaseDelayMs,
        isRetryable: classifyTelegramRetry,
        onRetry: (attempt, delayMs) => {
            logger.warn("Telegram API retry", {
                event: "telegram.api_retry",
                method,
                attempt,
                delayMs,
            });
        },
    });
}

export async function getTelegramBot(): Promise<TelegramUser> {
    return telegramRequest<TelegramUser>("getMe");
}

export async function sendTelegramMessage(
    chatId: number | string,
    text: string,
): Promise<TelegramMessage> {
    // Not retried — a duplicate send would DM the user twice. See
    // docs/telegram-setup.md §12.
    return telegramRequest<TelegramMessage>(
        "sendMessage",
        { chat_id: chatId, text },
        { retryable: false },
    );
}

export async function getTelegramChat(
    chatId: number | string,
): Promise<TelegramChat> {
    return telegramRequest<TelegramChat>("getChat", {
        chat_id: chatId,
    });
}

export async function getTelegramChatMember(
    chatId: number | string,
    userId: number,
): Promise<TelegramChatMember> {
    return telegramRequest<TelegramChatMember>("getChatMember", {
        chat_id: chatId,
        user_id: userId,
    });
}

export async function getTelegramWebhookInfo(): Promise<TelegramWebhookInfo> {
    return telegramRequest<TelegramWebhookInfo>("getWebhookInfo");
}

export async function setTelegramWebhook(params: {
    url: string;
    secretToken: string;
    allowedUpdates?: string[];
}): Promise<boolean> {
    return telegramRequest<boolean>("setWebhook", {
        url: params.url,
        secret_token: params.secretToken,
        allowed_updates: params.allowedUpdates,
    });
}

export async function createChatInviteLink(params: {
    chatId: number | string;
    name?: string;
    expireDate?: number;
    createsJoinRequest?: boolean;
}): Promise<TelegramChatInviteLink> {
    // Not retried — creating an invite link is not idempotent; a
    // retried create would mint a second, orphaned link. The caller
    // (lib/telegram-channel.ts / channel-access route) already has its
    // own compensation logic for a failed create.
    return telegramRequest<TelegramChatInviteLink>(
        "createChatInviteLink",
        {
            chat_id: params.chatId,
            name: params.name,
            expire_date: params.expireDate,
            creates_join_request: params.createsJoinRequest,
        },
        { retryable: false },
    );
}

export async function revokeChatInviteLink(
    chatId: number | string,
    inviteLink: string,
): Promise<TelegramChatInviteLink> {
    return telegramRequest<TelegramChatInviteLink>(
        "revokeChatInviteLink",
        {
            chat_id: chatId,
            invite_link: inviteLink,
        },
    );
}

export async function approveChatJoinRequest(
    chatId: number | string,
    userId: number,
): Promise<boolean> {
    return telegramRequest<boolean>("approveChatJoinRequest", {
        chat_id: chatId,
        user_id: userId,
    });
}

export async function declineChatJoinRequest(
    chatId: number | string,
    userId: number,
): Promise<boolean> {
    return telegramRequest<boolean>("declineChatJoinRequest", {
        chat_id: chatId,
        user_id: userId,
    });
}

/**
 * Removes a member from the chat. Used as the first half of a
 * ban-then-unban removal — see unbanChatMember and
 * lib/telegram-access-revocation.ts — never as a permanent block on
 * its own.
 */
export async function banChatMember(
    chatId: number | string,
    userId: number,
): Promise<boolean> {
    return telegramRequest<boolean>("banChatMember", {
        chat_id: chatId,
        user_id: userId,
    });
}

/**
 * Lifts a ban so the user is free to rejoin later through a fresh
 * invite flow, without being auto-added back. `onlyIfBanned: true`
 * makes this a safe no-op (still `ok: true`) when the user was never
 * banned, so callers can call it idempotently during reconciliation.
 */
export async function unbanChatMember(
    chatId: number | string,
    userId: number,
    onlyIfBanned = true,
): Promise<boolean> {
    return telegramRequest<boolean>("unbanChatMember", {
        chat_id: chatId,
        user_id: userId,
        only_if_banned: onlyIfBanned,
    });
}
