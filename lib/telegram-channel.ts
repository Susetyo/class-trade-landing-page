import {
    approveChatJoinRequest,
    banChatMember,
    createChatInviteLink,
    declineChatJoinRequest,
    getTelegramChat,
    getTelegramChatMember,
    revokeChatInviteLink,
    unbanChatMember,
    TelegramApiError,
    TelegramConfigError,
    type TelegramChat,
    type TelegramChatInviteLink,
    type TelegramChatMember,
    type TelegramChatMemberStatus,
} from "@/lib/telegram";

const ACTIVE_MEMBER_STATUSES = new Set<TelegramChatMemberStatus>([
    "member",
    "administrator",
    "creator",
]);

export function isActiveChannelMember(
    status: TelegramChatMemberStatus,
): boolean {
    return ACTIVE_MEMBER_STATUSES.has(status);
}

const PRIVILEGED_MEMBER_STATUSES = new Set<TelegramChatMemberStatus>([
    "administrator",
    "creator",
]);

/**
 * Administrators and creators are never auto-removed — Milestone 14
 * policy routes them to manual review instead. See
 * lib/telegram-access-revocation.ts.
 */
export function isPrivilegedChannelMember(
    status: TelegramChatMemberStatus,
): boolean {
    return PRIVILEGED_MEMBER_STATUSES.has(status);
}

const DEFAULT_INVITE_TTL_MINUTES = 30;

function getChannelId(): string {
    const channelId = process.env.TELEGRAM_CHANNEL_ID;

    if (!channelId) {
        throw new TelegramConfigError(
            "TELEGRAM_CHANNEL_ID belum dikonfigurasi",
        );
    }

    return channelId;
}

export function getChannelInviteTtlMinutes(): number {
    const raw = process.env.TELEGRAM_CHANNEL_INVITE_TTL_MINUTES;

    if (!raw) {
        return DEFAULT_INVITE_TTL_MINUTES;
    }

    const minutes = Number(raw);

    if (!Number.isFinite(minutes) || minutes <= 0) {
        throw new TelegramConfigError(
            "TELEGRAM_CHANNEL_INVITE_TTL_MINUTES tidak valid",
        );
    }

    return minutes;
}

/**
 * Resolves the configured chat and verifies it is a private channel —
 * never a group, supergroup, or discussion group. Throws
 * TelegramConfigError otherwise, which callers should surface as a
 * generic "gangguan sementara" message, never the raw description.
 */
export async function getTelegramChannel(): Promise<TelegramChat> {
    const channelId = getChannelId();
    const chat = await getTelegramChat(channelId);

    if (chat.type !== "channel") {
        throw new TelegramConfigError(
            "TELEGRAM_CHANNEL_ID harus menunjuk ke Telegram channel, " +
                "bukan group atau supergroup",
        );
    }

    return chat;
}

export async function createChannelJoinRequestInviteLink(
    name: string,
): Promise<TelegramChatInviteLink> {
    const channelId = getChannelId();
    const ttlMinutes = getChannelInviteTtlMinutes();
    const expireDate = Math.floor(Date.now() / 1000) + ttlMinutes * 60;

    // Never pass member_limit alongside creates_join_request — Telegram
    // rejects that combination.
    const link = await createChatInviteLink({
        chatId: channelId,
        name,
        expireDate,
        createsJoinRequest: true,
    });

    if (!link.creates_join_request) {
        throw new TelegramApiError(
            "Telegram invite link dibuat tanpa creates_join_request",
        );
    }

    return link;
}

export async function revokeChannelInviteLink(
    inviteLink: string,
): Promise<TelegramChatInviteLink> {
    const channelId = getChannelId();
    return revokeChatInviteLink(channelId, inviteLink);
}

export async function approveChannelJoinRequest(
    telegramUserId: number,
): Promise<boolean> {
    const channelId = getChannelId();
    return approveChatJoinRequest(channelId, telegramUserId);
}

export async function declineChannelJoinRequest(
    telegramUserId: number,
): Promise<boolean> {
    const channelId = getChannelId();
    return declineChatJoinRequest(channelId, telegramUserId);
}

export async function getChannelMember(
    telegramUserId: number,
): Promise<TelegramChatMember> {
    const channelId = getChannelId();
    return getTelegramChatMember(channelId, telegramUserId);
}

/**
 * Removes a member from the configured channel. Always followed by
 * unbanChannelMember (ban-then-unban) so the user is excluded now but
 * free to rejoin later through a fresh invite — never left in a
 * permanent blacklist. See lib/telegram-access-revocation.ts.
 */
export async function banChannelMember(
    telegramUserId: number,
): Promise<boolean> {
    const channelId = getChannelId();
    return banChatMember(channelId, telegramUserId);
}

export async function unbanChannelMember(
    telegramUserId: number,
): Promise<boolean> {
    const channelId = getChannelId();
    return unbanChatMember(channelId, telegramUserId, true);
}

/**
 * Compares chat.id from an inbound webhook update against the
 * configured channel — as strings, since Telegram chat ids can exceed
 * safe integer range and this project never stores/compares them as
 * JS `number`.
 */
export function isConfiguredChannel(chatId: number | string): boolean {
    const channelId = process.env.TELEGRAM_CHANNEL_ID;
    if (!channelId) return false;
    return String(chatId) === channelId;
}
