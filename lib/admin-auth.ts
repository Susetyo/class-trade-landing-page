import { timingSafeEqual } from "node:crypto";

import { getAdminApiSecret } from "@/lib/env";

/**
 * Admin authentication/authorization (Milestone 15 §13).
 *
 * This project has no user accounts, sessions, or role system yet —
 * every other endpoint is either public or capability-based (the
 * Order CUID, see lib/order-access.ts). For the admin-only actions
 * introduced in this milestone (triggering payment reconciliation), a
 * single high-entropy bearer secret (`ADMIN_API_SECRET`) is the
 * interim mechanism: anyone holding it is treated as "the admin".
 *
 * This is intentionally minimal and should be replaced with real
 * per-admin authentication + role checks before there is more than
 * one operator — see docs/security-reliability.md for the documented
 * limitation and upgrade path.
 */

const HEADER_NAME = "authorization";
const BEARER_PREFIX = "Bearer ";

export type AdminAuthResult =
    | { authorized: true }
    | { authorized: false; reason: "not_configured" | "missing" | "invalid" };

export function checkAdminAuth(request: Request): AdminAuthResult {
    const expected = getAdminApiSecret();

    if (!expected) {
        return { authorized: false, reason: "not_configured" };
    }

    const header = request.headers.get(HEADER_NAME);

    if (!header || !header.startsWith(BEARER_PREFIX)) {
        return { authorized: false, reason: "missing" };
    }

    const provided = header.slice(BEARER_PREFIX.length);

    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);

    if (providedBuffer.length !== expectedBuffer.length) {
        return { authorized: false, reason: "invalid" };
    }

    if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
        return { authorized: false, reason: "invalid" };
    }

    return { authorized: true };
}
