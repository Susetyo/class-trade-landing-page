import { z } from "zod";

/**
 * Reusable Zod schemas for every external input boundary (Milestone
 * 15 §1): API request bodies, query/route params, provider webhooks,
 * and admin action payloads. Centralized here so validation rules
 * (and their inferred TypeScript types) have one source of truth.
 *
 * Validation failures must never leak internal details — routes using
 * these schemas should respond with a generic message plus (at most)
 * the field paths that failed, never the invalid value itself or any
 * server-side context.
 */

// --- Shared primitives -----------------------------------------------------

// Same shape as lib/order-access.ts's ORDER_ID_PATTERN — the Order
// CUID doubles as a capability token, see that file for the model.
export const OrderIdSchema = z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]{1,64}$/, "Order ID tidak valid");

export const IdempotencyKeyHeaderSchema = z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,128}$/, "Idempotency-Key tidak valid");

// --- Registration -----------------------------------------------------

export const RegistrationInputSchema = z.object({
    name: z.string().trim().min(1, "Nama wajib diisi").max(200),
    email: z.string().trim().toLowerCase().email("Email tidak valid").max(254),
    phone: z
        .string()
        .trim()
        .min(6, "Nomor telepon tidak valid")
        .max(20, "Nomor telepon tidak valid")
        .regex(/^[0-9+()\s-]+$/, "Nomor telepon tidak valid"),
});

export type RegistrationInput = z.infer<typeof RegistrationInputSchema>;

// --- Payment / order creation -----------------------------------------------------

export const PaymentCreateInputSchema = z.object({
    registrationId: z.string().min(1).max(64),
});

export type PaymentCreateInput = z.infer<typeof PaymentCreateInputSchema>;

// --- Telegram browser-triggered actions -----------------------------------------------------

export const OrderIdBodySchema = z.object({
    orderId: OrderIdSchema,
});

export type OrderIdBody = z.infer<typeof OrderIdBodySchema>;

// --- Midtrans webhook -----------------------------------------------------

// Deliberately loose (`.loose()`) — Midtrans may add fields over time
// and this project only acts on the ones listed; unknown extra fields
// must not cause a hard validation failure.
export const MidtransNotificationSchema = z
    .object({
        order_id: z.string().min(1).max(128),
        transaction_id: z.string().min(1).max(128),
        transaction_status: z.string().min(1).max(64),
        status_code: z.string().min(1).max(16),
        gross_amount: z.string().min(1).max(32),
        signature_key: z.string().regex(/^[a-fA-F0-9]{128}$/, "signature_key tidak valid"),
        fraud_status: z.string().max(64).optional(),
        payment_type: z.string().max(64).optional(),
        refund_amount: z.string().max(32).optional(),
    })
    .loose();

export type MidtransNotificationInput = z.infer<typeof MidtransNotificationSchema>;

// --- Telegram webhook -----------------------------------------------------

// Telegram's update payload varies a lot by update type; this schema
// only pins down the envelope (`update_id` + the handful of update
// kinds this project reacts to) and leaves each sub-object loose —
// the route's existing narrow type handling still governs behavior.
const TelegramUserSchema = z.object({ id: z.number() }).loose();
const TelegramChatSchema = z.object({ id: z.number(), type: z.string() }).loose();

export const TelegramUpdateSchema = z
    .object({
        update_id: z.number(),
        message: z
            .object({ chat: TelegramChatSchema, from: TelegramUserSchema.optional() })
            .loose()
            .optional(),
        my_chat_member: z.object({ chat: TelegramChatSchema }).loose().optional(),
        chat_join_request: z
            .object({ chat: TelegramChatSchema, from: TelegramUserSchema })
            .loose()
            .optional(),
    })
    .loose();

export type TelegramUpdateInput = z.infer<typeof TelegramUpdateSchema>;

// --- Admin -----------------------------------------------------

export const AdminReconciliationTriggerSchema = z.object({
    maxOrders: z.number().int().positive().max(500).optional(),
});

export type AdminReconciliationTriggerInput = z.infer<
    typeof AdminReconciliationTriggerSchema
>;

// --- Helper -----------------------------------------------------

/** Field paths only — never the offending value — safe to include in a 400 response. */
export function formatValidationIssues(error: z.ZodError): string[] {
    return error.issues.map((issue) => issue.path.join(".") || "(root)");
}
