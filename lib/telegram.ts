const TELEGRAM_API_BASE_URL = "https://api.telegram.org";
const DEFAULT_TIMEOUT_MS = 10_000;

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

    constructor(message: string, errorCode?: number) {
        super(message);
        this.name = "TelegramApiError";
        this.errorCode = errorCode;
    }
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

/**
 * Low-level Telegram Bot API request. Never logs the request URL or
 * request body — both may contain the bot token or update payloads.
 */
export async function telegramRequest<T>(
    method: string,
    body?: Record<string, unknown>,
    options?: { timeoutMs?: number },
): Promise<T> {
    const token = getBotToken();

    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    let response: Response;

    try {
        response = await fetch(
            `${TELEGRAM_API_BASE_URL}/bot${token}/${method}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
                cache: "no-store",
            },
        );
    } catch (error) {
        if (
            error instanceof Error &&
            error.name === "AbortError"
        ) {
            throw new TelegramTimeoutError(
                `Telegram API request timeout: ${method}`,
            );
        }

        throw new TelegramNetworkError(
            `Telegram API network error: ${method}`,
        );
    } finally {
        clearTimeout(timeout);
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
        console.error("Telegram API error", {
            method,
            httpStatus: response.status,
            errorCode: payload.error_code,
            description: payload.description,
        });

        throw new TelegramApiError(
            `Telegram API error pada method ${method}`,
            payload.error_code,
        );
    }

    return payload.result as T;
}

export async function getTelegramBot(): Promise<TelegramUser> {
    return telegramRequest<TelegramUser>("getMe");
}

export async function sendTelegramMessage(
    chatId: number | string,
    text: string,
): Promise<TelegramMessage> {
    return telegramRequest<TelegramMessage>("sendMessage", {
        chat_id: chatId,
        text,
    });
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
    return telegramRequest<TelegramChatInviteLink>(
        "createChatInviteLink",
        {
            chat_id: params.chatId,
            name: params.name,
            expire_date: params.expireDate,
            creates_join_request: params.createsJoinRequest,
        },
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
