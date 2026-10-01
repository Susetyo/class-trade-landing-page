import { logger } from "@/lib/logger";
import { captureException } from "@/lib/error-monitoring";

/**
 * Node-only global handlers, split into their own module so
 * `instrumentation.ts` can dynamically import it strictly behind the
 * `NEXT_RUNTIME === "nodejs"` check — kept out of the edge runtime
 * bundle entirely rather than merely dead-code-guarded within it.
 */
export function registerProcessHandlers(): void {
    process.on("unhandledRejection", (reason) => {
        logger.error("Unhandled promise rejection", {
            event: "process.unhandled_rejection",
        });
        captureException(reason, {
            operation: "process.unhandled_rejection",
            expected: false,
        });
    });

    process.on("uncaughtException", (error) => {
        logger.error("Uncaught exception", {
            event: "process.uncaught_exception",
        });
        captureException(error, {
            operation: "process.uncaught_exception",
            expected: false,
        });
    });
}
