import { afterEach, describe, expect, it, vi } from "vitest";
import { checkAdminAuth } from "@/lib/admin-auth";

const SECRET = "s".repeat(32);

afterEach(() => {
    vi.unstubAllEnvs();
});

function requestWithAuth(header?: string) {
    return new Request("https://example.test/api/admin/reconciliation", {
        headers: header ? { authorization: header } : {},
    });
}

describe("checkAdminAuth", () => {
    it("rejects when ADMIN_API_SECRET is not configured", () => {
        vi.stubEnv("ADMIN_API_SECRET", "");
        const result = checkAdminAuth(requestWithAuth(`Bearer ${SECRET}`));
        expect(result.authorized).toBe(false);
    });

    it("rejects a missing Authorization header", () => {
        vi.stubEnv("ADMIN_API_SECRET", SECRET);
        const result = checkAdminAuth(requestWithAuth());
        expect(result.authorized).toBe(false);
    });

    it("rejects an incorrect bearer token", () => {
        vi.stubEnv("ADMIN_API_SECRET", SECRET);
        const result = checkAdminAuth(requestWithAuth("Bearer wrong-secret"));
        expect(result.authorized).toBe(false);
    });

    it("accepts the correct bearer token", () => {
        vi.stubEnv("ADMIN_API_SECRET", SECRET);
        const result = checkAdminAuth(requestWithAuth(`Bearer ${SECRET}`));
        expect(result.authorized).toBe(true);
    });
});
