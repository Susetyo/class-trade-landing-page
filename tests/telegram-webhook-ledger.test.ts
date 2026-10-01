import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordUpdateEvent, shouldSkipDuplicateUpdate } from "@/lib/telegram-webhook-ledger";

const TEST_UPDATE_ID_PREFIX = "test-update-";

afterEach(async () => {
    await prisma.telegramWebhookEvent.deleteMany({
        where: { updateId: { startsWith: TEST_UPDATE_ID_PREFIX } },
    });
});

describe("telegram webhook update_id dedupe", () => {
    it("does not flag an unseen update_id as duplicate", async () => {
        const updateId = `${TEST_UPDATE_ID_PREFIX}${crypto.randomUUID()}`;
        expect(await shouldSkipDuplicateUpdate(updateId)).toBe(false);
    });

    it("flags an update_id as duplicate once recorded 'done'", async () => {
        const updateId = `${TEST_UPDATE_ID_PREFIX}${crypto.randomUUID()}`;

        await recordUpdateEvent(updateId, "message", "done");

        expect(await shouldSkipDuplicateUpdate(updateId)).toBe(true);
    });

    it("does not flag an update_id recorded as 'failed' as duplicate (safe to reprocess)", async () => {
        const updateId = `${TEST_UPDATE_ID_PREFIX}${crypto.randomUUID()}`;

        await recordUpdateEvent(updateId, "chat_join_request", "failed");

        expect(await shouldSkipDuplicateUpdate(updateId)).toBe(false);
    });

    it("upsert is idempotent — recording the same update_id twice does not create two rows", async () => {
        const updateId = `${TEST_UPDATE_ID_PREFIX}${crypto.randomUUID()}`;

        await recordUpdateEvent(updateId, "message", "done");
        await recordUpdateEvent(updateId, "message", "done");

        const rows = await prisma.telegramWebhookEvent.findMany({ where: { updateId } });
        expect(rows).toHaveLength(1);
    });
});
