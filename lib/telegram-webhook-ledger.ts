import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Telegram update dedupe ledger (Milestone 15 §5) — backs
 * `TelegramWebhookEvent.updateId` (unique). Shared by the webhook
 * route for every update type it processes (`chat_join_request`,
 * `message`, `my_chat_member`) so "already fully handled" has one
 * definition, and is independently testable without going through the
 * HTTP route.
 */

export async function shouldSkipDuplicateUpdate(updateId: string): Promise<boolean> {
    const existing = await prisma.telegramWebhookEvent.findUnique({
        where: { updateId },
        select: { status: true },
    });

    return existing?.status === "done";
}

export async function recordUpdateEvent(
    updateId: string,
    eventType: string,
    status: string,
): Promise<void> {
    await prisma.telegramWebhookEvent
        .upsert({
            where: { updateId },
            create: {
                updateId,
                eventType,
                status,
                processedAt: status === "done" ? new Date() : null,
            },
            update: {
                status,
                processedAt: status === "done" ? new Date() : null,
            },
        })
        .catch((error) => {
            logger.error("Failed to record Telegram webhook event", {
                event: "telegram.webhook_event_record_failed",
                errorName: error instanceof Error ? error.name : "unknown",
            });
        });
}
