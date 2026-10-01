import { describe, expect, it } from "vitest";
import {
    MidtransNotificationSchema,
    OrderIdSchema,
    PaymentCreateInputSchema,
    RegistrationInputSchema,
    TelegramUpdateSchema,
} from "@/lib/schemas";

describe("RegistrationInputSchema", () => {
    it("accepts a valid payload", () => {
        const result = RegistrationInputSchema.safeParse({
            name: "Budi Santoso",
            email: "Budi@Example.com",
            phone: "081234567890",
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.email).toBe("budi@example.com");
        }
    });

    it("rejects an invalid email", () => {
        const result = RegistrationInputSchema.safeParse({
            name: "Budi",
            email: "not-an-email",
            phone: "081234567890",
        });

        expect(result.success).toBe(false);
    });

    it("rejects a missing name", () => {
        const result = RegistrationInputSchema.safeParse({
            name: "",
            email: "budi@example.com",
            phone: "081234567890",
        });

        expect(result.success).toBe(false);
    });

    it("rejects a malformed phone number", () => {
        const result = RegistrationInputSchema.safeParse({
            name: "Budi",
            email: "budi@example.com",
            phone: "not-a-phone!!",
        });

        expect(result.success).toBe(false);
    });
});

describe("PaymentCreateInputSchema", () => {
    it("accepts a valid registrationId", () => {
        expect(
            PaymentCreateInputSchema.safeParse({ registrationId: "clx123" }).success,
        ).toBe(true);
    });

    it("rejects a missing registrationId", () => {
        expect(PaymentCreateInputSchema.safeParse({}).success).toBe(false);
    });
});

describe("OrderIdSchema", () => {
    it("accepts a CUID-shaped id", () => {
        expect(OrderIdSchema.safeParse("clx1234567890abcdef").success).toBe(true);
    });

    it("rejects path traversal / special characters", () => {
        expect(OrderIdSchema.safeParse("../../etc/passwd").success).toBe(false);
        expect(OrderIdSchema.safeParse("id;DROP TABLE Order").success).toBe(false);
    });
});

describe("MidtransNotificationSchema", () => {
    const valid = {
        order_id: "REG-123",
        transaction_id: "abc-123",
        transaction_status: "settlement",
        status_code: "200",
        gross_amount: "150000.00",
        signature_key: "a".repeat(128),
    };

    it("accepts a valid notification payload", () => {
        expect(MidtransNotificationSchema.safeParse(valid).success).toBe(true);
    });

    it("allows unknown extra fields (Midtrans may add fields over time)", () => {
        const result = MidtransNotificationSchema.safeParse({
            ...valid,
            some_future_field: "x",
        });
        expect(result.success).toBe(true);
    });

    it("rejects a malformed signature_key", () => {
        expect(
            MidtransNotificationSchema.safeParse({ ...valid, signature_key: "short" }).success,
        ).toBe(false);
    });

    it("rejects a payload missing required fields", () => {
        const { order_id, ...rest } = valid;
        void order_id;
        expect(MidtransNotificationSchema.safeParse(rest).success).toBe(false);
    });
});

describe("TelegramUpdateSchema", () => {
    it("accepts a minimal message update", () => {
        const result = TelegramUpdateSchema.safeParse({
            update_id: 1,
            message: { chat: { id: 1, type: "private" }, text: "/start" },
        });
        expect(result.success).toBe(true);
    });

    it("rejects a payload without update_id", () => {
        expect(TelegramUpdateSchema.safeParse({ message: {} }).success).toBe(false);
    });
});
