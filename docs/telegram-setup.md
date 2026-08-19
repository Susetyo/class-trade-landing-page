# Telegram Bot Setup (Milestone 11)

Milestone ini menyiapkan infrastruktur dasar Telegram bot: client API,
webhook, dan verifikasi. **Belum** ada logic yang menghubungkan Order
dengan Telegram user, linking token, invite link berbayar, auto-approve
join request, atau penambahan/pencabutan akses grup — itu masuk
milestone berikutnya.

## 1. Environment variables

| Variable | Keterangan |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Token rahasia dari BotFather. Hanya dipakai di backend (server-side), tidak pernah dikirim ke client. |
| `TELEGRAM_GROUP_ID` | Numeric chat ID dari private group, supergroup, atau channel tujuan (nama variable dipertahankan `TELEGRAM_GROUP_ID` walau targetnya bisa berupa channel). |
| `TELEGRAM_WEBHOOK_SECRET` | Random secret untuk memverifikasi request webhook Telegram (header `X-Telegram-Bot-Api-Secret-Token`). |
| `APP_URL` | Domain HTTPS production yang stabil, misalnya `https://nama-project.vercel.app`. Jangan pakai URL preview deployment yang berubah setiap commit. |

Aturan:

- Tidak ada prefix `NEXT_PUBLIC_` pada variable di atas — semuanya
  server-only.
- `TELEGRAM_BOT_TOKEN` tidak pernah dikembalikan oleh API, tidak
  pernah ditulis ke log.
- `.env` dan `.env.local` sudah masuk `.gitignore` project ini —
  jangan commit.

Untuk pengembangan lokal, `scripts/setup-telegram-webhook.mjs` dan
`scripts/check-telegram-bot.mjs` dijalankan dengan
`node --env-file=.env.local`, jadi isi keempat variable di atas pada
`.env.local` (placeholder kosong sudah ditambahkan di file tersebut).

## 2. Membuat bot lewat BotFather

1. Buka chat `@BotFather` di Telegram.
2. Jalankan perintah `/newbot`.
3. Tentukan nama tampilan bot (bebas, misalnya "Synex Trade Academy Bot").
4. Tentukan username bot — harus unik dan berakhiran `bot`
   (misalnya `synextrade_bot`).
5. BotFather akan membalas dengan token API. Simpan token tersebut ke
   `TELEGRAM_BOT_TOKEN` di environment variable (Vercel / `.env.local`),
   **jangan** ditempel ke chat lain, issue, commit, atau log manapun.
6. Jika token pernah terekspos (misalnya tidak sengaja ter-commit atau
   terlihat orang lain), buka lagi `@BotFather` → pilih bot → gunakan
   opsi *Revoke current token* / *API Token* untuk generate ulang
   token, lalu update environment variable dengan token baru.

## 3. Menyiapkan grup/channel dan menjadikan bot admin

Project ini menargetkan sebuah **private channel** (bukan supergroup)
sebagai tujuan akses berbayar. Telegram Bot API mendukung admin
permission dan `chat_join_request` untuk channel dengan cara yang
sama seperti group/supergroup, jadi langkahnya setara:

1. Buat channel Telegram baru, set sebagai **private channel**.
2. Tambahkan bot yang baru dibuat ke channel tersebut.
3. Jadikan bot sebagai **administrator** channel.
4. Saat memberi permission admin, aktifkan **Invite Users via Link**
   (`can_invite_users`) — permission ini dibutuhkan untuk milestone
   berikutnya (invite link berbayar).
5. Untuk memakai `chat_join_request` (di milestone berikutnya),
   aktifkan pengaturan **"Request to join"** / persetujuan approval
   di private channel tersebut (Channel → Settings → Channel Type
   → *Approve New Members*), sehingga user yang klik invite link
   masuk sebagai join request, bukan langsung menjadi member.

> Catatan: jika target sebenarnya berupa private **group/supergroup**
> biasa (bukan channel), langkahnya identik — cukup ganti "channel"
> dengan "grup" di atas. Script verifikasi (`npm run telegram:check`)
> menerima ketiga tipe chat ini: `group`, `supergroup`, `channel`.

## 4. Mendapatkan numeric chat ID (grup atau channel)

Cara paling aman untuk mendapatkan `chat.id` tanpa mengekspos data
pribadi anggota lain:

1. Tambahkan bot ke grup/channel (langkah di atas) sehingga bot
   menerima update `my_chat_member` ketika status keanggotaannya
   berubah.
2. Pasang webhook (lihat bagian 6) lalu lihat log server (Vercel logs)
   untuk baris `Bot membership status updated` — baris ini mencetak
   `chatId` dan `chatType`, tanpa nama chat atau data anggota lain.
3. Alternatif tanpa webhook aktif: gunakan method Telegram
   `getUpdates` secara manual (misalnya lewat `curl`) setelah mengirim
   pesan/post apa pun ke chat tersebut. **Catatan penting**:
   `getUpdates` tidak bisa dipakai bersamaan dengan webhook yang
   aktif. Jika webhook sudah dipasang, hapus dulu webhook dengan
   method `deleteWebhook` secara sadar/manual sebelum memanggil
   `getUpdates`, lalu pasang ulang webhook
   (`npm run telegram:webhook:set`) setelah selesai. Jangan
   menghapus webhook otomatis dari script — ini harus tindakan manual
   yang disengaja.
4. Setelah `chat.id` didapat, simpan ke `TELEGRAM_GROUP_ID`.

Project ini tidak menambahkan helper script terpisah untuk mengambil
group ID karena `getChat`/`my_chat_member` log di atas sudah cukup;
helper tambahan hanya perlu dibuat jika langkah manual ini terasa
tidak praktis, dan jika dibuat, helper tersebut hanya boleh mencetak
`chat.id`, `chat.type`, dan `chat.title` — tidak pernah mencetak isi
pesan, username, nomor telepon, atau payload update lengkap.

## 5. Konfigurasi Vercel

Project → Settings → Environment Variables, tambahkan:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_GROUP_ID=
TELEGRAM_WEBHOOK_SECRET=
APP_URL=
```

- Gunakan domain production yang stabil untuk `APP_URL`
  (contoh: `https://nama-project.vercel.app`), bukan URL preview
  deployment yang berubah setiap commit.
- Jika project mengaktifkan **Vercel Deployment Protection**,
  pastikan endpoint `POST /api/webhooks/telegram` di deployment
  production dapat diakses Telegram tanpa login (protection bypass
  untuk path ini, atau protection dinonaktifkan khusus production).
  Tanpa ini, Telegram akan menerima response non-2xx dan terus
  melakukan retry.
- Setelah environment variables ditambahkan/diubah, lakukan redeploy
  agar runtime membaca nilai baru.

## 6. Memasang webhook

Setelah deploy ke Vercel dan environment variables terisi:

```bash
npm run telegram:webhook:set
```

Script `scripts/setup-telegram-webhook.mjs` akan:

- Memvalidasi `APP_URL` menggunakan HTTPS.
- Menghapus trailing slash dari `APP_URL`.
- Memanggil Telegram `setWebhook` dengan URL
  `{APP_URL}/api/webhooks/telegram`, `secret_token` dari
  `TELEGRAM_WEBHOOK_SECRET`, dan `allowed_updates`:
  `["message", "my_chat_member", "chat_join_request"]`.
- Mencetak hasil aman (webhook URL, daftar allowed update types) —
  tidak pernah mencetak token atau webhook secret.

## 7. Menjalankan verification script

```bash
npm run telegram:check
```

Script `scripts/check-telegram-bot.mjs` akan:

- Memanggil `getMe` — memverifikasi token valid, bot aktif, dan
  mencetak bot ID, username, display name (tanpa token).
- Memanggil `getWebhookInfo` — mencetak webhook URL, pending update
  count, last error date/message, allowed updates (tanpa webhook
  secret).
- Jika `TELEGRAM_GROUP_ID` diset: memanggil `getChat` untuk memastikan
  tipe chat `group`, `supergroup`, atau `channel`, lalu
  `getChatMember` untuk memastikan bot berstatus `administrator`
  (atau `creator`) dan permission `can_invite_users` aktif. Jika
  belum, script mencetak instruksi: *"Tambahkan bot sebagai
  administrator dan aktifkan permission Invite Users pada chat
  tersebut."* Script ini tidak pernah mempromosikan bot secara
  otomatis.

## 8. Update Telegram yang didukung milestone ini

- `message` — hanya diproses jika chat privat dan teks diawali
  `/start`.
  - `/start` tanpa parameter → bot membalas pesan welcome.
  - `/start SOME_TOKEN` → bot membalas bahwa fitur linking akan
    tersedia di tahap berikutnya. Parameter token tidak pernah dicatat
    ke log.
- `my_chat_member` — diterima, response `200`. Server-side log hanya
  mencatat `chatType`, `chatId`, dan `status` baru — tidak pernah
  mencatat username atau isi pesan.
- `chat_join_request` — diterima, response `200`, tapi **tidak
  diproses sama sekali** (tidak approve, tidak decline, tidak query
  Order, tidak menyimpan user ID). Ini disengaja untuk milestone
  berikutnya.
- Update lain yang valid tapi tidak dikenali → tetap direspons `200`
  supaya Telegram tidak melakukan retry berulang.

## 9. Manual testing checklist

1. `npm run telegram:check` → pastikan `getMe` berhasil.
2. Pastikan bot terdeteksi sebagai admin grup dan `can_invite_users`
   aktif (jika `TELEGRAM_GROUP_ID` sudah diset).
3. Deploy ke Vercel dengan environment variables sudah diisi.
4. `npm run telegram:webhook:set`.
5. `npm run telegram:check` lagi → periksa `getWebhookInfo`
   (`pending_update_count` idealnya 0, `last_error_message` kosong).
6. Kirim `/start` ke bot dari chat privat → pastikan bot membalas
   pesan welcome.
7. Kirim update lain yang tidak didukung (misalnya pesan biasa tanpa
   `/start`, atau reaction) → pastikan webhook tetap merespons `200`
   (bisa dicek dari Vercel logs, tidak ada retry berulang dari
   Telegram).
8. Periksa Vercel logs → pastikan tidak ada bot token, webhook secret,
   atau data pribadi (nama, username, nomor telepon, isi pesan) yang
   tercetak.

## 10. Retry policy untuk `sendMessage`

Webhook tidak melakukan retry internal ketika `sendTelegramMessage`
gagal (misalnya user memblokir bot, atau rate limit sesaat). Kegagalan
hanya dicatat via `console.error` dengan pesan aman, lalu handler tetap
melanjutkan dan endpoint tetap mengembalikan `200` ke Telegram. Alasan:

- Update `message` dari Telegram tidak di-retry oleh Telegram
  berdasarkan gagal/berhasilnya `sendMessage` kita — retry Telegram
  hanya terjadi jika endpoint webhook ini sendiri tidak membalas
  `2xx`. Karena itu, mengembalikan `200` meski `sendMessage` gagal
  sudah tepat: mencegah Telegram mengirim ulang update yang sama
  berulang kali (yang berpotensi memicu percobaan kirim pesan
  berulang / spam ke user yang sama).
- Retry manual di sisi kita (misal loop coba ulang) sengaja tidak
  diimplementasikan di milestone ini untuk menghindari kompleksitas
  dan risiko flooding user dengan pesan duplikat.
