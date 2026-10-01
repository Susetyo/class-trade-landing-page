/**
 * Rate limiting abstraction (Milestone 15 §2).
 *
 * `RateLimitStore` is the seam for swapping the backing store without
 * touching call sites. The only implementation shipped today is
 * in-memory, which has a real limitation documented below — read it
 * before relying on this in a multi-instance deployment.
 *
 * ---
 * ## In-memory limitation
 *
 * `InMemoryRateLimitStore` keeps counters in a single process' memory.
 * On a single long-running Node server (e.g. one Vercel/Node
 * container, `next start` on one box) this is accurate. It is **not**
 * accurate across multiple instances/containers/serverless invocations
 * running concurrently — each instance has its own counter, so the
 * *effective* limit becomes `limit * instanceCount`, and Vercel's
 * serverless functions in particular do not share memory across
 * invocations at all, making this store close to a no-op there.
 *
 * ## Migrating to a shared store
 *
 * Implement `RateLimitStore` against Redis (e.g. `INCR` + `PEXPIRE`,
 * or a Lua script for atomicity) or another shared KV store, then swap
 * the instance constructed in `getRateLimitStore()` below. No call
 * site needs to change — they only depend on `checkRateLimit`.
 */

export type RateLimitResult = {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetAt: number;
    retryAfterSeconds: number;
};

export interface RateLimitStore {
    /**
     * Atomically increments the counter for `key` within the current
     * window (creating it with a fresh window if absent/expired), and
     * returns the counter value after incrementing plus when that
     * window resets.
     */
    increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
}

type Bucket = { count: number; resetAt: number };

export class InMemoryRateLimitStore implements RateLimitStore {
    private readonly buckets = new Map<string, Bucket>();
    // Bounds unbounded growth from an attacker cycling through many
    // keys (e.g. spoofed IPs) — oldest entries are evicted first.
    private readonly maxEntries: number;

    constructor(maxEntries = 50_000) {
        this.maxEntries = maxEntries;
    }

    async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
        const now = Date.now();
        const existing = this.buckets.get(key);

        if (existing && existing.resetAt > now) {
            existing.count += 1;
            return existing;
        }

        const fresh: Bucket = { count: 1, resetAt: now + windowMs };

        if (this.buckets.size >= this.maxEntries) {
            const oldestKey = this.buckets.keys().next().value;
            if (oldestKey !== undefined) this.buckets.delete(oldestKey);
        }

        this.buckets.set(key, fresh);
        return fresh;
    }
}

const globalForRateLimit = globalThis as unknown as {
    __rateLimitStore?: RateLimitStore;
};

function getRateLimitStore(): RateLimitStore {
    if (!globalForRateLimit.__rateLimitStore) {
        globalForRateLimit.__rateLimitStore = new InMemoryRateLimitStore();
    }
    return globalForRateLimit.__rateLimitStore;
}

export type RateLimitOptions = {
    /** Stable identifier for the caller — typically `${ip}:${route}` or `${ip}:${route}:${resourceId}`. */
    key: string;
    limit: number;
    windowMs: number;
};

export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
    const store = getRateLimitStore();
    const { count, resetAt } = await store.increment(options.key, options.windowMs);

    const allowed = count <= options.limit;
    const remaining = Math.max(0, options.limit - count);
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

    return { allowed, limit: options.limit, remaining, resetAt, retryAfterSeconds };
}

/** Standard 429 JSON response with `Retry-After`, for consistent handling across routes. */
export function rateLimitResponseInit(
    result: RateLimitResult,
    extraHeaders?: HeadersInit,
): ResponseInit {
    return {
        status: 429,
        headers: {
            "Retry-After": String(result.retryAfterSeconds),
            "X-RateLimit-Limit": String(result.limit),
            "X-RateLimit-Remaining": String(result.remaining),
            ...(extraHeaders ? Object.fromEntries(new Headers(extraHeaders)) : {}),
        },
    };
}

/** Named limit presets so routes agree on consistent, documented budgets. */
export const RATE_LIMITS = {
    // POST /api/registrations — public form submission.
    REGISTRATION_CREATE: { limit: 5, windowMs: 60_000 },
    // POST /api/payments — creates an Order + calls Midtrans.
    PAYMENT_CREATE: { limit: 5, windowMs: 60_000 },
    // POST /api/webhooks/midtrans — provider webhook, generous but bounded.
    MIDTRANS_WEBHOOK: { limit: 60, windowMs: 60_000 },
    // POST /api/webhooks/telegram — provider webhook.
    TELEGRAM_WEBHOOK: { limit: 120, windowMs: 60_000 },
    // Telegram link/channel-access actions triggered from the browser.
    TELEGRAM_ACTION: { limit: 10, windowMs: 60_000 },
    // Admin endpoints — low volume, high sensitivity.
    ADMIN_ACTION: { limit: 20, windowMs: 60_000 },
} as const;
