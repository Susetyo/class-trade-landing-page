#!/usr/bin/env node

/**
 * Memverifikasi konfigurasi Telegram bot: token, webhook, dan (jika
 * TELEGRAM_CHANNEL_ID diset) status admin bot di private channel
 * tujuan. Target project ini adalah private Telegram channel — bukan
 * group/supergroup — jadi verifikasi ini menolak tipe chat selain
 * `channel`.
 *
 * Jalankan dengan:
 *   node --env-file=.env.local scripts/check-telegram-bot.mjs
 *
 * Script ini tidak pernah mencetak TELEGRAM_BOT_TOKEN atau
 * TELEGRAM_WEBHOOK_SECRET ke output.
 */

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

async function callTelegram(botToken, method, body) {
    const response = await fetch(
        `https://api.telegram.org/bot${botToken}/${method}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: body ? JSON.stringify(body) : undefined,
        },
    );

    const result = await response.json();

    if (!response.ok || !result.ok) {
        const description =
            result && typeof result.description === "string"
                ? result.description
                : "unknown error";

        throw new Error(
            `Telegram API error pada method ${method}: ${description}`,
        );
    }

    return result.result;
}

async function checkBot(botToken) {
    console.log("=== Verifikasi Bot ===");

    const me = await callTelegram(botToken, "getMe");

    console.log(`Bot ID: ${me.id}`);
    console.log(`Bot username: @${me.username ?? "-"}`);
    console.log(`Bot display name: ${me.first_name}`);
    console.log("Status: OK — token valid dan bot aktif.\n");

    return me;
}

async function checkWebhook(botToken) {
    console.log("=== Webhook Info ===");

    const webhookInfo = await callTelegram(botToken, "getWebhookInfo");

    console.log(`Webhook URL: ${webhookInfo.url || "(belum diset)"}`);
    console.log(
        `Pending update count: ${webhookInfo.pending_update_count}`,
    );
    console.log(
        `Last error date: ${
            webhookInfo.last_error_date
                ? new Date(
                      webhookInfo.last_error_date * 1000,
                  ).toISOString()
                : "-"
        }`,
    );
    console.log(
        `Last error message: ${webhookInfo.last_error_message ?? "-"}`,
    );
    console.log(
        `Allowed updates: ${
            (webhookInfo.allowed_updates ?? []).join(", ") ||
            "(default: semua tipe)"
        }\n`,
    );
}

async function checkChannel(botToken, channelId, botId) {
    console.log("=== Verifikasi Private Channel ===");

    const chat = await callTelegram(botToken, "getChat", {
        chat_id: channelId,
    });

    console.log(`Chat title: ${chat.title ?? "-"}`);
    console.log(`Chat type: ${chat.type}`);

    if (chat.type !== "channel") {
        console.error(
            "\nError: TELEGRAM_CHANNEL_ID harus menunjuk ke Telegram " +
                "channel, bukan group atau supergroup.",
        );
        process.exitCode = 1;
        return;
    }

    const member = await callTelegram(botToken, "getChatMember", {
        chat_id: channelId,
        user_id: botId,
    });

    console.log(`Bot status di channel: ${member.status}`);

    const isAdmin =
        member.status === "administrator" || member.status === "creator";

    // Telegram tidak menyertakan `can_invite_users` untuk status
    // "creator" karena creator otomatis memiliki semua permission.
    const canInviteUsers =
        member.status === "creator"
            ? true
            : member.can_invite_users === true;

    if (!isAdmin) {
        console.error(
            "\nTambahkan bot sebagai administrator pada private " +
                "channel tersebut.",
        );
        process.exitCode = 1;
        return;
    }

    if (!canInviteUsers) {
        console.error(
            "\nAktifkan permission Invite Users untuk bot pada " +
                "private channel tersebut.",
        );
        process.exitCode = 1;
        return;
    }

    console.log("\nTelegram channel terverifikasi");
    console.log("Bot adalah administrator channel");
    console.log("Permission Invite Users aktif");
}

async function main() {
    const botToken = requireEnv("TELEGRAM_BOT_TOKEN");
    const channelId = process.env.TELEGRAM_CHANNEL_ID;

    const me = await checkBot(botToken);
    await checkWebhook(botToken);

    if (!channelId) {
        console.log(
            "TELEGRAM_CHANNEL_ID tidak diset — verifikasi channel dilewati.",
        );
        return;
    }

    await checkChannel(botToken, channelId, me.id);
}

main().catch((error) => {
    console.error(
        "Verifikasi gagal:",
        error instanceof Error ? error.message : error,
    );
    process.exit(1);
});
