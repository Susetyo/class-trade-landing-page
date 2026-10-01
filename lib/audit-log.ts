import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Non-PII audit trail for admin actions and scheduled jobs (Milestone
 * 15 §13). `metadata` must only ever contain small structured
 * operational values (counts, status codes, order ids) — the caller
 * is responsible for that; this module does not attempt to redact
 * `metadata` itself, so never pass raw request bodies or user fields
 * into it.
 */

export type AuditLogEntry = {
    actor: string;
    action: string;
    targetType?: string;
    targetId?: string;
    outcome: string;
    metadata?: Record<string, unknown>;
};

export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
    try {
        await prisma.adminAuditLog.create({
            data: {
                actor: entry.actor,
                action: entry.action,
                targetType: entry.targetType,
                targetId: entry.targetId,
                outcome: entry.outcome,
                metadata: entry.metadata as Prisma.InputJsonValue | undefined,
            },
        });
    } catch (error) {
        // Audit logging must never take down the operation it is
        // describing — log the failure itself and move on.
        logger.error("Failed to record audit log", {
            event: "audit_log.write_failed",
            action: entry.action,
        });
        void error;
    }
}
