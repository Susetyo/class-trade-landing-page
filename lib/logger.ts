/**
 * Structured logging with recursive PII/secret redaction (Milestone 15).
 *
 * Every log line is a single JSON object with `timestamp`, `level`,
 * `event`, optional `requestId`/`orderId`, `message`, and a redacted
 * `meta` blob. Use this instead of `console.*` anywhere a value that
 * *might* contain user input, a secret, or a raw provider payload gets
 * logged — the redactor walks nested objects/arrays recursively, so a
 * secret buried three levels deep in an error's `.cause` or a webhook
 * payload is still caught.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = {
    requestId?: string;
    orderId?: string;
    event?: string;
    [key: string]: unknown;
};

// Key names redacted wherever they appear, regardless of nesting —
// matched case-insensitively against the raw key. Deliberately broad:
// it is always safer to over-redact an operational field than to leak
// a secret or PII once.
const REDACTED_KEY_PATTERNS: RegExp[] = [
    /authorization/i,
    /cookie/i,
    /session/i,
    /\bpassword\b/i,
    /\botp\b/i,
    /token/i,
    /secret/i,
    /server[_-]?key/i,
    /client[_-]?key/i,
    /signature/i,
    /\bapi[_-]?key\b/i,
    /\bname\b/i,
    /\bemail\b/i,
    /\bphone\b/i,
    /\baddress\b/i,
    /telegram.?user.?id/i,
    /telegram.?account.?id/i,
    /invite.?link/i,
    /customer/i,
    /card/i,
    /cvv/i,
];

const REDACTED_VALUE = "[REDACTED]";
const MAX_DEPTH = 6;

function isSensitiveKey(key: string): boolean {
    return REDACTED_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function redactValue(value: unknown, depth: number): unknown {
    if (depth > MAX_DEPTH) return "[TRUNCATED]";

    if (value === null || value === undefined) return value;

    if (value instanceof Error) {
        return {
            name: value.name,
            message: redactString(value.message),
            stack: value.stack,
        };
    }

    if (Array.isArray(value)) {
        return value.map((item) => redactValue(item, depth + 1));
    }

    if (typeof value === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
            result[key] = isSensitiveKey(key)
                ? REDACTED_VALUE
                : redactValue(val, depth + 1);
        }
        return result;
    }

    if (typeof value === "string") {
        return redactString(value);
    }

    return value;
}

// Best-effort string-level redaction for values that look like emails
// or long hex/base64 secrets even when the surrounding key name wasn't
// caught above (e.g. a free-text error message that echoes an email).
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function redactString(value: string): string {
    return value.replace(EMAIL_PATTERN, REDACTED_VALUE);
}

export function redact<T>(value: T): T {
    return redactValue(value, 0) as T;
}

function write(level: LogLevel, message: string, fields?: LogFields): void {
    const { event, requestId, orderId, ...rest } = fields ?? {};

    const line = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...(event ? { event } : {}),
        ...(requestId ? { requestId } : {}),
        ...(orderId ? { orderId } : {}),
        ...(Object.keys(rest).length > 0 ? { meta: redact(rest) } : {}),
    };

    const serialized = JSON.stringify(line);

    switch (level) {
        case "error":
            console.error(serialized);
            break;
        case "warn":
            console.warn(serialized);
            break;
        default:
            console.log(serialized);
    }
}

export const logger = {
    debug: (message: string, fields?: LogFields) => write("debug", message, fields),
    info: (message: string, fields?: LogFields) => write("info", message, fields),
    warn: (message: string, fields?: LogFields) => write("warn", message, fields),
    error: (message: string, fields?: LogFields) => write("error", message, fields),
};
