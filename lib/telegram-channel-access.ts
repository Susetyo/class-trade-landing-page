import { createHash, randomBytes } from "node:crypto";

// 8 bytes -> 16 hex characters, well under Telegram's 32-character
// invite-link name limit, and opaque (no PII, no order/registration
// identifier embedded).
const INVITE_NAME_BYTES = 8;

export function generateInviteLinkName(): string {
    return randomBytes(INVITE_NAME_BYTES).toString("hex");
}

export function hashInviteLink(inviteLink: string): string {
    return createHash("sha256").update(inviteLink).digest("hex");
}
