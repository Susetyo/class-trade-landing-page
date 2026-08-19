import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { isValidOrderId } from "@/lib/order-access";
import {
    generateInviteLinkName,
    hashInviteLink,
} from "@/lib/telegram-channel-access";
import {
    createChannelJoinRequestInviteLink,
    getChannelMember,
    isActiveChannelMember,
    revokeChannelInviteLink,
} from "@/lib/telegram-channel";
import type { TelegramAccessStatus } from "@/app/generated/prisma/enums";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
    "Cache-Control": "no-store",
};

// Milestone 14: once an access record has entered the revocation
// lifecycle, no new invite may be issued until payment state is
// reconciled — see docs/telegram-setup.md.
const BLOCKED_FOR_NEW_INVITE = new Set<TelegramAccessStatus>([
    "REVOCATION_PENDING",
    "REVOCATION_FAILED",
    "REVOKED",
    "MANUAL_REVIEW",
]);

// Same anti-spam pattern as POST /api/telegram/link: no shared
// rate-limiting infra yet, so refuse to touch the access record faster
// than this interval.
const MIN_ACTION_INTERVAL_MS = 5_000;

const RequestSchema = z.object({
    orderId: z.string().min(1).max(64),
});

type ErrorResponse = {
    success: false;
    message: string;
};

type ChannelAccessActionResponse = {
    success: true;
    status: TelegramAccessStatus;
    inviteUrl: string | null;
    expiresAt: string | null;
};

function errorResponse(message: string, status: number) {
    return NextResponse.json<ErrorResponse>(
        { success: false, message },
        { status, headers: NO_STORE_HEADERS },
    );
}

/**
 * Marks the access record GRANTED and clears the raw invite link (bearer
 * secret — never kept around once it's no longer needed). Also revokes
 * any still-active Telegram invite link so it can't be reused. Used both
 * for the reconciliation path here and, separately, by the webhook.
 */
async function reconcileGranted(
    accessId: string,
    currentInviteLink: string | null,
) {
    if (currentInviteLink) {
        try {
            await revokeChannelInviteLink(currentInviteLink);
        } catch (error) {
            console.error(
                "Channel access: revoke-on-reconcile failed",
                error instanceof Error ? error.name : "unknown",
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

export async function POST(request: Request) {
    try {
        const json = await request.json().catch(() => null);
        const parsed = RequestSchema.safeParse(json);

        if (!parsed.success || !isValidOrderId(parsed.data.orderId)) {
            return errorResponse("Order ID tidak valid", 400);
        }

        const { orderId } = parsed.data;

        // Ownership: same Order-CUID-as-capability model as every other
        // Telegram endpoint — see lib/order-access.ts.
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                status: true,
                registration: {
                    select: {
                        telegramAccount: {
                            select: { id: true, telegramUserId: true },
                        },
                    },
                },
                telegramAccess: {
                    select: {
                        id: true,
                        status: true,
                        telegramAccountId: true,
                        inviteLink: true,
                        inviteExpiresAt: true,
                        updatedAt: true,
                    },
                },
            },
        });

        if (!order || !order.registration) {
            return errorResponse("Order tidak ditemukan", 404);
        }

        if (order.status !== "PAID") {
            return errorResponse("Pembayaran belum berhasil.", 409);
        }

        const telegramAccount = order.registration.telegramAccount;

        if (!telegramAccount) {
            return errorResponse("Akun Telegram belum dihubungkan.", 409);
        }

        const access = order.telegramAccess;

        if (access && access.telegramAccountId !== telegramAccount.id) {
            // Should not happen under normal flow (an Order's Registration
            // and its linked Telegram account are both fixed once set),
            // but never trust stale linkage — fail safe and generic.
            console.error(
                "Channel access: telegramAccountId mismatch for Order",
            );
            return errorResponse(
                "Terjadi gangguan sementara, silakan coba lagi.",
                500,
            );
        }

        if (access?.status === "GRANTED") {
            return NextResponse.json<ChannelAccessActionResponse>(
                {
                    success: true,
                    status: "GRANTED",
                    inviteUrl: null,
                    expiresAt: null,
                },
                { status: 200, headers: NO_STORE_HEADERS },
            );
        }

        if (access && BLOCKED_FOR_NEW_INVITE.has(access.status)) {
            // Report current state so the client can render the right
            // revocation UI — this is not an error, just a decision
            // not to issue a new invite while payment state is
            // ineligible / not yet reconciled.
            return NextResponse.json<ChannelAccessActionResponse>(
                {
                    success: true,
                    status: access.status,
                    inviteUrl: null,
                    expiresAt: null,
                },
                { status: 200, headers: NO_STORE_HEADERS },
            );
        }

        if (
            access &&
            Date.now() - access.updatedAt.getTime() < MIN_ACTION_INTERVAL_MS
        ) {
            return errorResponse(
                "Terlalu banyak permintaan. Silakan coba lagi sebentar.",
                429,
            );
        }

        // Reconciliation: the user may already be a channel member
        // (approved earlier, or added manually) even if our own record
        // says otherwise — trust Telegram's live membership over our
        // local state.
        try {
            const member = await getChannelMember(
                Number(telegramAccount.telegramUserId),
            );

            if (isActiveChannelMember(member.status)) {
                const accessId =
                    access?.id ??
                    (
                        await prisma.telegramAccess.create({
                            data: {
                                orderId: order.id,
                                telegramAccountId: telegramAccount.id,
                            },
                            select: { id: true },
                        })
                    ).id;

                await reconcileGranted(accessId, access?.inviteLink ?? null);

                return NextResponse.json<ChannelAccessActionResponse>(
                    {
                        success: true,
                        status: "GRANTED",
                        inviteUrl: null,
                        expiresAt: null,
                    },
                    { status: 200, headers: NO_STORE_HEADERS },
                );
            }
        } catch (error) {
            // Reconciliation is best-effort — if Telegram can't tell us
            // membership status, fall through to the normal invite flow.
            console.error(
                "Channel access: reconciliation check failed",
                error instanceof Error ? error.name : "unknown",
            );
        }

        // An active, unexpired invite already exists — hand the same
        // link back rather than minting a new one.
        if (
            access?.status === "INVITED" &&
            access.inviteLink &&
            access.inviteExpiresAt &&
            access.inviteExpiresAt.getTime() > Date.now()
        ) {
            return NextResponse.json<ChannelAccessActionResponse>(
                {
                    success: true,
                    status: "INVITED",
                    inviteUrl: access.inviteLink,
                    expiresAt: access.inviteExpiresAt.toISOString(),
                },
                { status: 200, headers: NO_STORE_HEADERS },
            );
        }

        // Step 1: prepare/reserve the database row before calling
        // Telegram, so there's always a row to update once the invite
        // link comes back.
        const preparedAccess = await prisma.telegramAccess.upsert({
            where: { orderId: order.id },
            create: {
                orderId: order.id,
                telegramAccountId: telegramAccount.id,
            },
            update: {
                telegramAccountId: telegramAccount.id,
            },
            select: { id: true },
        });

        const inviteLinkName = generateInviteLinkName();

        // Step 2: create the invite link via Telegram — outside any DB
        // transaction, so a slow/failed network call never holds a lock.
        let inviteLink;
        try {
            inviteLink =
                await createChannelJoinRequestInviteLink(inviteLinkName);
        } catch (error) {
            console.error(
                "Channel access: createChatInviteLink failed",
                error instanceof Error ? error.name : "unknown",
            );

            await prisma.telegramAccess
                .update({
                    where: { id: preparedAccess.id },
                    data: {
                        status: "FAILED",
                        lastErrorCode:
                            error instanceof Error ? error.name : "unknown",
                    },
                })
                .catch(() => {});

            return errorResponse(
                "Terjadi gangguan sementara, silakan coba lagi.",
                502,
            );
        }

        const inviteExpiresAt = inviteLink.expire_date
            ? new Date(inviteLink.expire_date * 1000)
            : null;

        // Step 3: persist the result. If this write fails, the invite
        // link was already created on Telegram's side but must never be
        // exposed — attempt to revoke it (compensation) instead.
        try {
            await prisma.telegramAccess.update({
                where: { id: preparedAccess.id },
                data: {
                    status: "INVITED",
                    inviteLink: inviteLink.invite_link,
                    inviteLinkHash: hashInviteLink(inviteLink.invite_link),
                    inviteLinkName,
                    inviteExpiresAt,
                    lastErrorCode: null,
                },
            });
        } catch (dbError) {
            console.error(
                "Channel access: failed to persist invite link",
                dbError instanceof Error ? dbError.name : "unknown",
            );

            try {
                await revokeChannelInviteLink(inviteLink.invite_link);
            } catch (revokeError) {
                console.error(
                    "Channel access: compensation revoke failed",
                    revokeError instanceof Error
                        ? revokeError.name
                        : "unknown",
                );
            }

            return errorResponse(
                "Terjadi gangguan sementara, silakan coba lagi.",
                500,
            );
        }

        return NextResponse.json<ChannelAccessActionResponse>(
            {
                success: true,
                status: "INVITED",
                inviteUrl: inviteLink.invite_link,
                expiresAt: inviteExpiresAt
                    ? inviteExpiresAt.toISOString()
                    : null,
            },
            { status: 201, headers: NO_STORE_HEADERS },
        );
    } catch (error) {
        console.error(
            "Channel access: unexpected error",
            error instanceof Error ? error.name : "unknown",
        );

        return errorResponse(
            "Terjadi gangguan sementara, silakan coba lagi.",
            500,
        );
    }
}

type ChannelAccessStatusResponse = {
    success: true;
    paid: boolean;
    telegramLinked: boolean;
    accessStatus: TelegramAccessStatus | null;
    inviteExpiresAt: string | null;
    grantedAt: string | null;
    revokedAt: string | null;
};

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const orderId = url.searchParams.get("orderId") ?? "";

        if (!orderId || !isValidOrderId(orderId)) {
            return errorResponse("Order ID tidak valid", 400);
        }

        const order = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                status: true,
                registration: {
                    select: {
                        telegramAccount: { select: { id: true } },
                    },
                },
                telegramAccess: {
                    select: {
                        status: true,
                        inviteExpiresAt: true,
                        grantedAt: true,
                        revokedAt: true,
                    },
                },
            },
        });

        if (!order || !order.registration) {
            return errorResponse("Order tidak ditemukan", 404);
        }

        const access = order.telegramAccess;

        return NextResponse.json<ChannelAccessStatusResponse>(
            {
                success: true,
                paid: order.status === "PAID",
                telegramLinked: Boolean(order.registration.telegramAccount),
                accessStatus: access?.status ?? null,
                inviteExpiresAt: access?.inviteExpiresAt
                    ? access.inviteExpiresAt.toISOString()
                    : null,
                grantedAt: access?.grantedAt
                    ? access.grantedAt.toISOString()
                    : null,
                revokedAt: access?.revokedAt
                    ? access.revokedAt.toISOString()
                    : null,
            },
            { status: 200, headers: NO_STORE_HEADERS },
        );
    } catch (error) {
        console.error(
            "Channel access status: unexpected error",
            error instanceof Error ? error.name : "unknown",
        );

        return errorResponse(
            "Terjadi gangguan sementara, silakan coba lagi.",
            500,
        );
    }
}
