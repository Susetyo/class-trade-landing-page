/**
 * Generic bounded retry with exponential backoff + jitter (Milestone
 * 15 §7). Only wrap operations that are actually safe to repeat —
 * callers decide that by what they pass as `isRetryable`, this module
 * only implements the waiting/counting mechanics.
 */

export type RetryableClassification = {
    retryable: boolean;
    retryAfterMs?: number;
};

export type RetryOptions<E = unknown> = {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs?: number;
    isRetryable: (error: E) => RetryableClassification;
    onRetry?: (attempt: number, delayMs: number, error: E) => void;
};

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
    const exponential = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
    // Full jitter: uniform random in [0, exponential] — avoids retry
    // storms from many callers backing off in lockstep.
    return Math.floor(Math.random() * exponential);
}

/**
 * Runs `fn`, retrying up to `maxRetries` additional times when
 * `isRetryable` says the thrown error qualifies. Never retries a
 * successful call, never swallows the final error, and respects an
 * explicit `retryAfterMs` (e.g. from HTTP 429/503 `Retry-After`) over
 * the computed backoff when provided.
 */
export async function withRetry<T, E = unknown>(
    fn: () => Promise<T>,
    options: RetryOptions<E>,
): Promise<T> {
    const maxDelayMs = options.maxDelayMs ?? 30_000;
    let lastError: E;

    for (let attempt = 1; attempt <= options.maxRetries + 1; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as E;

            const isLastAttempt = attempt === options.maxRetries + 1;
            const classification = options.isRetryable(lastError);

            if (isLastAttempt || !classification.retryable) {
                throw lastError;
            }

            const delayMs =
                classification.retryAfterMs ??
                backoffDelay(attempt, options.baseDelayMs, maxDelayMs);

            options.onRetry?.(attempt, delayMs, lastError);
            await sleep(delayMs);
        }
    }

    // Unreachable — the loop above always returns or throws.
    throw lastError!;
}
