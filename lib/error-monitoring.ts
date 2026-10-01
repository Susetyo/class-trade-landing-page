import { fetchWithTimeout } from "@/lib/http-client";
import { isErrorMonitoringEnabled } from "@/lib/env";
import { logger, redact } from "@/lib/logger";

/**
 * Provider-neutral error monitoring adapter (Milestone 15 §10).
 *
 * No Sentry (or similar) SDK is installed — adding one is a real
 * dependency + product decision (DSN, sampling, data residency) this
 * task should not make unilaterally. Instead this module defines the
 * seam: a small `ErrorMonitoringAdapter` interface, a no-op default,
 * and a generic webhook adapter that POSTs a redacted JSON event to
 * `ERROR_MONITORING_DSN` when configured — compatible with most
 * "ingest a JSON event over HTTP" collectors, and a reasonable stand-in
 * until a specific provider is chosen. Swapping in `@sentry/nextjs`
 * later means implementing `ErrorMonitoringAdapter` against its
 * `captureException` and wiring it in `initErrorMonitoring` — no
 * caller of `captureException` below needs to change.
 *
 * Always disabled unless `ERROR_MONITORING_ENABLED=true` **and**
 * `ERROR_MONITORING_DSN` is set — local/test runs are a no-op by
 * default (see lib/env.ts `isErrorMonitoringEnabled`).
 */

export type ErrorContext = {
    operation: string;
    requestId?: string;
    orderId?: string;
    /** true = expected operational error (validation, business rule) — not a bug. */
    expected?: boolean;
    /** Small, non-PII structured extras only — never raw payloads, tokens, or user fields. */
    extra?: Record<string, unknown>;
};

export interface ErrorMonitoringAdapter {
    captureException(error: unknown, context: ErrorContext): void;
}

class NoopAdapter implements ErrorMonitoringAdapter {
    captureException(): void {
        // intentionally inert
    }
}

class WebhookAdapter implements ErrorMonitoringAdapter {
    constructor(private readonly dsn: string) {}

    captureException(error: unknown, context: ErrorContext): void {
        // Fire-and-forget — error reporting must never slow down or
        // fail the operation that triggered it.
        void this.send(error, context);
    }

    private async send(error: unknown, context: ErrorContext): Promise<void> {
        try {
            const event = redact({
                message: error instanceof Error ? error.message : String(error),
                errorName: error instanceof Error ? error.name : "UnknownError",
                operation: context.operation,
                requestId: context.requestId,
                orderId: context.orderId,
                expected: context.expected ?? false,
                extra: context.extra,
                timestamp: new Date().toISOString(),
            });

            await fetchWithTimeout(
                this.dsn,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(event),
                },
                5_000,
            );
        } catch {
            // Best-effort only — never throw from error reporting itself.
        }
    }
}

let adapter: ErrorMonitoringAdapter = new NoopAdapter();

export function initErrorMonitoring(): void {
    const dsn = process.env.ERROR_MONITORING_DSN;
    adapter = isErrorMonitoringEnabled() && dsn ? new WebhookAdapter(dsn) : new NoopAdapter();
}

/**
 * Reports an error to both the structured logger (always, redacted)
 * and the configured monitoring adapter (only if enabled). Use
 * `context.expected = true` for operational errors — validation
 * failures, business-rule rejections — that should not page anyone,
 * versus an unexpected/unhandled failure.
 */
export function captureException(error: unknown, context: ErrorContext): void {
    logger.error(context.expected ? "Operational error" : "Unexpected error", {
        event: `error_monitoring.${context.operation}`,
        requestId: context.requestId,
        orderId: context.orderId,
        expected: context.expected ?? false,
        errorName: error instanceof Error ? error.name : "UnknownError",
        ...context.extra,
    });

    adapter.captureException(error, context);
}
