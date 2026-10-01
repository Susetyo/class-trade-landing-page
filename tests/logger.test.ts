import { describe, expect, it } from "vitest";
import { redact } from "@/lib/logger";

describe("redact", () => {
    it("redacts top-level secret-like keys", () => {
        const result = redact({
            password: "hunter2",
            token: "abc",
            authorization: "Bearer xyz",
            serverKey: "SB-Mid-server-xxx",
            name: "Budi Santoso",
            email: "budi@example.com",
            phone: "081234567890",
        }) as Record<string, unknown>;

        expect(result.password).toBe("[REDACTED]");
        expect(result.token).toBe("[REDACTED]");
        expect(result.authorization).toBe("[REDACTED]");
        expect(result.serverKey).toBe("[REDACTED]");
        expect(result.name).toBe("[REDACTED]");
        expect(result.email).toBe("[REDACTED]");
        expect(result.phone).toBe("[REDACTED]");
    });

    it("redacts secrets nested arbitrarily deep", () => {
        const result = redact({
            order: {
                id: "order_123",
                meta: {
                    contact: {
                        details: { email: "deep@example.com", password: "s3cr3t" },
                    },
                },
            },
        }) as any;

        expect(result.order.id).toBe("order_123");
        expect(result.order.meta.contact.details.email).toBe("[REDACTED]");
        expect(result.order.meta.contact.details.password).toBe("[REDACTED]");
    });

    it("redacts an entire nested object when its own key name is sensitive", () => {
        const result = redact({
            order: { id: "order_123", customer: { name: "Budi", email: "budi@example.com" } },
        }) as any;

        expect(result.order.id).toBe("order_123");
        expect(result.order.customer).toBe("[REDACTED]");
    });

    it("redacts secrets inside arrays", () => {
        const result = redact({
            items: [{ token: "abc" }, { token: "def" }],
        }) as any;

        expect(result.items[0].token).toBe("[REDACTED]");
        expect(result.items[1].token).toBe("[REDACTED]");
    });

    it("keeps safe operational fields untouched", () => {
        const result = redact({
            orderId: "order_123",
            status: "PAID",
            requestId: "req-1",
            httpStatus: 200,
        }) as Record<string, unknown>;

        expect(result.orderId).toBe("order_123");
        expect(result.status).toBe("PAID");
        expect(result.requestId).toBe("req-1");
        expect(result.httpStatus).toBe(200);
    });

    it("redacts an email embedded in a free-text string value", () => {
        const result = redact({ message: "failed for user someone@example.com" }) as Record<
            string,
            unknown
        >;

        expect(result.message).not.toContain("someone@example.com");
    });

    it("redacts Error objects' message field for embedded emails, keeps name/stack", () => {
        const error = new Error("lookup failed for someone@example.com");
        const result = redact({ error }) as any;

        expect(result.error.name).toBe("Error");
        expect(result.error.message).not.toContain("someone@example.com");
    });
});
