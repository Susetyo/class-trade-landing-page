/**
 * Next.js instrumentation hook (Milestone 15 §10/§14) — runs once per
 * server instance start. Validates security-critical environment
 * variables (fail-fast in production), initializes the error
 * monitoring adapter, and installs global handlers for unhandled
 * exceptions/promise rejections so a bug that would otherwise crash
 * the process silently is at least reported once before exit.
 */
export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;

    const { assertRequiredSecurityEnv } = await import("@/lib/env");
    const { initErrorMonitoring } = await import("@/lib/error-monitoring");
    const { registerProcessHandlers } = await import("@/lib/process-handlers");

    assertRequiredSecurityEnv();
    initErrorMonitoring();
    registerProcessHandlers();
}
