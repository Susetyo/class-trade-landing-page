import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RegistrationInputSchema } from "@/lib/schemas";
import { checkRateLimit, RATE_LIMITS, rateLimitResponseInit } from "@/lib/rate-limit";
import { getClientIp, getRequestId } from "@/lib/request-context";
import {
    fingerprintPayload,
    getIdempotencyKey,
    hasMalformedIdempotencyKey,
    idempotencyConflictResponse,
    idempotencyInProgressResponse,
    runIdempotent,
} from "@/lib/idempotency";
import {
    CONSENT_TYPE_PRIVACY_POLICY,
    CURRENT_PRIVACY_POLICY_VERSION,
    grantConsent,
} from "@/lib/consent";
import { captureException } from "@/lib/error-monitoring";
import { logger } from "@/lib/logger";
import { checkAdminAuth } from "@/lib/admin-auth";

export const runtime = "nodejs";

async function handleCreate(
    body: unknown,
    requestId: string,
): Promise<{ status: number; body: unknown }> {
    const parsed = RegistrationInputSchema.safeParse(body);

    if (!parsed.success) {
        return {
            status: 400,
            body: { message: "Data pendaftaran tidak valid." },
        };
    }

    if (
        typeof body === "object" &&
        body !== null &&
        "privacyConsent" in body &&
        (body as { privacyConsent?: unknown }).privacyConsent !== true
    ) {
        return {
            status: 400,
            body: { message: "Persetujuan privasi wajib diberikan." },
        };
    }

    const { name, email, phone } = parsed.data;

    const registration = await prisma.registration.create({
        data: { name, email, phone },
    });

    await grantConsent({
        subjectType: "registration",
        subjectId: registration.id,
        consentType: CONSENT_TYPE_PRIVACY_POLICY,
        consentVersion: CURRENT_PRIVACY_POLICY_VERSION,
        source: "registration_form",
    });

    logger.info("Registration created", {
        event: "registration.created",
        requestId,
    });

    return {
        status: 201,
        body: {
            message: "Pendaftaran berhasil",
            data: registration,
        },
    };
}

export async function POST(request: Request) {
    const requestId = getRequestId(request);
    const ip = getClientIp(request);

    const rateLimit = await checkRateLimit({
        key: `registration.create:${ip}`,
        ...RATE_LIMITS.REGISTRATION_CREATE,
    });

    if (!rateLimit.allowed) {
        return NextResponse.json(
            { message: "Terlalu banyak permintaan. Silakan coba lagi nanti." },
            rateLimitResponseInit(rateLimit),
        );
    }

    if (hasMalformedIdempotencyKey(request)) {
        return NextResponse.json(
            { message: "Idempotency-Key tidak valid." },
            { status: 400 },
        );
    }

    try {
        const body = await request.json().catch(() => null);
        const idempotencyKey = getIdempotencyKey(request);

        if (!idempotencyKey) {
            const result = await handleCreate(body, requestId);
            return NextResponse.json(result.body, { status: result.status });
        }

        const outcome = await runIdempotent(
            {
                scope: "registration.create",
                key: idempotencyKey,
                fingerprint: fingerprintPayload(body),
                requestId,
            },
            () => handleCreate(body, requestId),
        );

        if (outcome.kind === "conflict") return idempotencyConflictResponse();
        if (outcome.kind === "in_progress") return idempotencyInProgressResponse();

        return NextResponse.json(outcome.result.body, { status: outcome.result.status });
    } catch (error) {
        captureException(error, {
            operation: "registrations.create",
            requestId,
            expected: false,
        });

        return NextResponse.json(
            { message: "Terjadi kesalahan pada server" },
            { status: 500 },
        );
    }
}

// Milestone 15: this listing returns every registrant's name, email,
// and phone — it was previously unauthenticated. Treated as an admin
// endpoint (see lib/admin-auth.ts); not used by any page in this
// codebase (registration-form.tsx only POSTs).
export async function GET(request: Request) {
    const requestId = getRequestId(request);

    const auth = checkAdminAuth(request);
    if (!auth.authorized) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = await checkRateLimit({
        key: `registration.list:${getClientIp(request)}`,
        ...RATE_LIMITS.ADMIN_ACTION,
    });

    if (!rateLimit.allowed) {
        return NextResponse.json(
            { message: "Terlalu banyak permintaan." },
            rateLimitResponseInit(rateLimit),
        );
    }

    try {
        const registration = await prisma.registration.findMany({
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ data: registration });
    } catch (error) {
        captureException(error, {
            operation: "registrations.list",
            requestId,
            expected: false,
        });

        return NextResponse.json(
            { message: "Gagal mengambil data pendaftaran" },
            { status: 500 },
        );
    }
}
