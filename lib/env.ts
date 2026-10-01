import { z } from "zod";

/**
 * Central environment variable schema and accessors (Milestone 15).
 *
 * Every external-facing module should read configuration through this
 * file instead of `process.env` directly, so that:
 * - shape/type is validated once with Zod,
 * - a missing/invalid variable fails with a message naming only the
 *   variable, never a value,
 * - production fails fast on missing security-critical variables (see
 *   `assertRequiredSecurityEnv`), while local/test can still run with
 *   defaults for the non-critical ones.
 *
 * This module must never log the parsed values themselves.
 */

const numericString = (fallback: number) =>
    z
        .string()
        .optional()
        .transform((value) => (value === undefined || value === "" ? fallback : Number(value)))
        .pipe(z.number().finite());

const positiveIntString = (fallback: number) =>
    numericString(fallback).pipe(z.number().int().positive());

const EnvSchema = z.object({
    NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),

    // --- Core -----------------------------------------------------
    DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),

    // --- Midtrans ---------------------------------------------------
    MIDTRANS_SERVER_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: z.string().min(1).optional(),
    MIDTRANS_IS_PRODUCTION: z
        .string()
        .optional()
        .transform((v) => v === "true"),
    REGISTRATION_PRICE: numericString(150_000).pipe(
        z.number().int().positive(),
    ),

    // --- Telegram -----------------------------------------------------
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    TELEGRAM_BOT_USERNAME: z.string().min(1).optional(),
    TELEGRAM_CHANNEL_ID: z.string().min(1).optional(),
    TELEGRAM_CHANNEL_INVITE_TTL_MINUTES: positiveIntString(30),
    TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),
    APP_URL: z.string().url().optional(),

    // --- Admin ---------------------------------------------------------
    // Bearer secret for the admin-only endpoints (Milestone 15 §13).
    // This project has no user/role system yet, so a single
    // high-entropy shared secret is the interim authorization
    // mechanism — see docs/security-reliability.md.
    ADMIN_API_SECRET: z.string().min(32).optional(),

    // --- Outbound HTTP (Midtrans/Telegram API calls) -------------------
    OUTBOUND_REQUEST_TIMEOUT_MS: positiveIntString(10_000),
    OUTBOUND_MAX_RETRIES: numericString(2).pipe(z.number().int().min(0).max(10)),
    OUTBOUND_RETRY_BASE_DELAY_MS: positiveIntString(300),

    // --- Rate limiting ---------------------------------------------------
    RATE_LIMIT_ENABLED: z
        .string()
        .optional()
        .transform((v) => v !== "false"),

    // --- Reconciliation --------------------------------------------------
    RECONCILIATION_PENDING_AGE_MINUTES: positiveIntString(30),
    RECONCILIATION_BATCH_SIZE: positiveIntString(50),
    RECONCILIATION_CONCURRENCY: positiveIntString(5),
    RECONCILIATION_CRON: z.string().optional(),

    // --- Error monitoring --------------------------------------------------
    ERROR_MONITORING_DSN: z.string().optional(),
    ERROR_MONITORING_ENABLED: z
        .string()
        .optional()
        .transform((v) => v === "true"),
});

export type AppEnv = z.infer<typeof EnvSchema>;

let cached: AppEnv | undefined;

/** Names only — never values — surfaced in the thrown error/log. */
function formatZodIssues(error: z.ZodError): string {
    return error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
}

/**
 * Parses and caches `process.env` against `EnvSchema`. Throws a
 * generic, non-sensitive error (variable names + reasons only) if
 * validation fails — never includes the offending value.
 */
export function getEnv(): AppEnv {
    if (cached) return cached;

    const parsed = EnvSchema.safeParse(process.env);

    if (!parsed.success) {
        throw new Error(
            `Konfigurasi environment variable tidak valid: ${formatZodIssues(parsed.error)}`,
        );
    }

    cached = parsed.data;
    return cached;
}

/** Test-only escape hatch to force re-parsing after mutating process.env. */
export function resetEnvCacheForTests(): void {
    cached = undefined;
}

const SECURITY_CRITICAL_PRODUCTION_VARS = [
    "DATABASE_URL",
    "MIDTRANS_SERVER_KEY",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_BOT_USERNAME",
    "TELEGRAM_CHANNEL_ID",
    "TELEGRAM_WEBHOOK_SECRET",
    "ADMIN_API_SECRET",
] as const;

/**
 * Fail-fast boot check for production. Only checks presence (names
 * only, never values) of variables this project cannot safely run
 * without in production — a missing webhook secret or server key
 * would otherwise silently downgrade security guarantees instead of
 * refusing to start. Intended to be called once from
 * `instrumentation.ts`. In development/test this only warns, so local
 * setup with a partial `.env.local` keeps working.
 */
export function assertRequiredSecurityEnv(): void {
    const isProduction = process.env.NODE_ENV === "production";
    const missing = SECURITY_CRITICAL_PRODUCTION_VARS.filter(
        (name) => !process.env[name],
    );

    if (missing.length === 0) return;

    const message = `Environment variable keamanan wajib belum diset: ${missing.join(", ")}`;

    if (isProduction) {
        console.error(message);
        throw new Error(message);
    }

    console.warn(`[dev] ${message}`);
}

function required(value: string | undefined, name: string): string {
    if (!value) {
        throw new Error(`${name} belum dikonfigurasi`);
    }
    return value;
}

// --- Typed accessors for the security-critical secrets --------------------
// Centralizing these means every call site gets the same "missing env"
// error shape, and none of them accidentally logs the value.

export function getMidtransServerKey(): string {
    return required(process.env.MIDTRANS_SERVER_KEY, "MIDTRANS_SERVER_KEY");
}

export function getTelegramBotToken(): string {
    return required(process.env.TELEGRAM_BOT_TOKEN, "TELEGRAM_BOT_TOKEN");
}

export function getTelegramWebhookSecret(): string | undefined {
    return process.env.TELEGRAM_WEBHOOK_SECRET;
}

export function getAdminApiSecret(): string | undefined {
    return process.env.ADMIN_API_SECRET;
}

export function getOutboundHttpConfig(): {
    timeoutMs: number;
    maxRetries: number;
    retryBaseDelayMs: number;
} {
    const env = getEnv();
    return {
        timeoutMs: env.OUTBOUND_REQUEST_TIMEOUT_MS,
        maxRetries: env.OUTBOUND_MAX_RETRIES,
        retryBaseDelayMs: env.OUTBOUND_RETRY_BASE_DELAY_MS,
    };
}

export function getReconciliationConfig(): {
    pendingAgeMinutes: number;
    batchSize: number;
    concurrency: number;
    cron: string | undefined;
} {
    const env = getEnv();
    return {
        pendingAgeMinutes: env.RECONCILIATION_PENDING_AGE_MINUTES,
        batchSize: env.RECONCILIATION_BATCH_SIZE,
        concurrency: env.RECONCILIATION_CONCURRENCY,
        cron: env.RECONCILIATION_CRON,
    };
}

export function isRateLimitEnabled(): boolean {
    return getEnv().RATE_LIMIT_ENABLED;
}

export function isErrorMonitoringEnabled(): boolean {
    const env = getEnv();
    return env.ERROR_MONITORING_ENABLED && Boolean(env.ERROR_MONITORING_DSN);
}
