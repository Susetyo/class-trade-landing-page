#!/usr/bin/env node

/**
 * Memasang Telegram webhook untuk aplikasi ini.
 *
 * Jalankan dengan:
 *   node --env-file=.env.local scripts/setup-telegram-webhook.mjs
 *
 * Script ini tidak pernah mencetak TELEGRAM_BOT_TOKEN atau
 * TELEGRAM_WEBHOOK_SECRET ke output.
 */

const ALLOWED_UPDATES = [
    "message",
    "my_chat_member",
    "chat_join_request",
];

function requireEnv(name) {
    const value = process.env[name];

    if (!value) {
        console.error(
            `Error: environment variable ${name} belum diset.`,
        );
        process.exit(1);
    }

    return value;
}

async function main() {
    const botToken = requireEnv("TELEGRAM_BOT_TOKEN");
    const webhookSecret = requireEnv("TELEGRAM_WEBHOOK_SECRET");
    const rawAppUrl = requireEnv("APP_URL");

    if (!rawAppUrl.startsWith("https://")) {
        console.error(
            "Error: APP_URL harus menggunakan HTTPS " +
                "(contoh: https://nama-project.vercel.app).",
        );
        process.exit(1);
    }

    const appUrl = rawAppUrl.replace(/\/+$/, "");
    const webhookUrl = `${appUrl}/api/webhooks/telegram`;

    const response = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                url: webhookUrl,
                secret_token: webhookSecret,
                allowed_updates: ALLOWED_UPDATES,
            }),
        },
    );

    const result = await response.json();

    if (!response.ok || !result.ok) {
        console.error("Gagal memasang webhook Telegram.");

        if (result && typeof result.description === "string") {
            console.error(`Detail: ${result.description}`);
        }

        process.exit(1);
    }

    console.log("Webhook berhasil dipasang");
    console.log(`Webhook URL: ${webhookUrl}`);
    console.log(`Allowed update types: ${ALLOWED_UPDATES.join(", ")}`);
}

main().catch((error) => {
    console.error(
        "Terjadi kesalahan saat memasang webhook:",
        error instanceof Error ? error.message : error,
    );
    process.exit(1);
});
