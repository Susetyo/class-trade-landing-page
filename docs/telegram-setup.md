# Telegram Bot Setup & Account Linking (Milestone 11 + 12)

Target Telegram project ini adalah **private Telegram channel** —
bukan group, supergroup, atau discussion group. Istilah "channel"
dipakai konsisten di seluruh environment variable, kode, dokumentasi,
dan pesan bot.

Milestone 11 menyiapkan infrastruktur dasar: client API, webhook, dan
verifikasi bot/channel. Milestone 12 menambahkan account linking:
setelah Order `PAID`, pengguna menghubungkan akun Telegram-nya lewat
deep link `/start TOKEN` di private chat dengan bot.

**Belum tersedia** sampai Milestone 13: channel invite link, auto-approve
`chat_join_request`, penambahan subscriber ke channel, atau pencabutan
akses channel setelah refund. Linking (Milestone 12) hanya mencatat
numeric Telegram user ID — belum memberi akses apa pun ke channel.

## 1. Environment variables

| Variable | Keterangan |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Token rahasia dari BotFather. Hanya dipakai di backend (server-side), tidak pernah dikirim ke client. |
| `TELEGRAM_BOT_USERNAME` | Username bot tanpa karakter `@` (contoh: `synextrade_bot`). Dipakai untuk membangun deep link `https://t.me/USERNAME?start=TOKEN`. |
| `TELEGRAM_CHANNEL_ID` | Numeric ID private Telegram channel tujuan, biasanya bernilai negatif dan dapat diawali `-100`. Dibaca sebagai string dari environment variable. |
| `TELEGRAM_WEBHOOK_SECRET` | Random secret untuk memverifikasi request webhook Telegram (header `X-Telegram-Bot-Api-Secret-Token`). |
| `APP_URL` | Domain HTTPS production yang stabil, misalnya `https://nama-project.vercel.app`. Jangan pakai URL preview deployment yang berubah setiap commit. |

> **Perubahan dari Milestone 11**: variable sebelumnya bernama
> `TELEGRAM_GROUP_ID`. Project ini menargetkan private channel (bukan
> group/supergroup), jadi variable tersebut diganti menjadi
> `TELEGRAM_CHANNEL_ID` di seluruh kode, script, dan dokumentasi —
> **tanpa fallback** ke nama lama, karena project belum pernah deploy
> dengan nama variable lama tersebut ke production.

Aturan:

- Tidak ada prefix `NEXT_PUBLIC_` pada variable di atas — semuanya
  server-only.
- `TELEGRAM_BOT_TOKEN` tidak pernah dikembalikan oleh API, tidak
  pernah ditulis ke log.
- `.env` dan `.env.local` sudah masuk `.gitignore` project ini —
  jangan commit.

Untuk pengembangan lokal, `scripts/setup-telegram-webhook.mjs` dan
`scripts/check-telegram-bot.mjs` dijalankan dengan
`node --env-file=.env.local`, jadi isi kelima variable di atas pada
`.env.local`.

## 2. Membuat bot lewat BotFather

1. Buka chat `@BotFather` di Telegram.
2. Jalankan perintah `/newbot`.
3. Tentukan nama tampilan bot (bebas, misalnya "Kafeinmatcha Academy Bot").
4. Tentukan username bot — harus unik dan berakhiran `bot`
   (misalnya `kafeinmatcha_academy_bot`). Simpan username ini (tanpa
   `@`) ke `TELEGRAM_BOT_USERNAME`.
5. BotFather akan membalas dengan token API. Simpan token tersebut ke
   `TELEGRAM_BOT_TOKEN` di environment variable (Vercel / `.env.local`),
   **jangan** ditempel ke chat lain, issue, commit, atau log manapun.
6. Jika token pernah terekspos (misalnya tidak sengaja ter-commit atau
   terlihat orang lain), buka lagi `@BotFather` → pilih bot → gunakan
   opsi *Revoke current token* / *API Token* untuk generate ulang
   token, lalu update environment variable dengan token baru.

## 3. Membuat private channel dan menjadikan bot admin

1. Buat channel Telegram baru, set sebagai **private channel**.
2. Tambahkan bot yang baru dibuat ke channel tersebut.
3. Jadikan bot sebagai **administrator** channel.
4. Saat memberi permission admin, aktifkan **Invite Users via Link**
   (`can_invite_users`) — permission ini dibutuhkan untuk Milestone 13
   (invite link berbayar). Milestone ini (12) tidak membuat atau
   mengirim invite link apa pun.
5. Untuk Milestone 13 (`chat_join_request`), rencanakan mengaktifkan
   pengaturan **"Request to join"** / persetujuan approval pada
   private channel (Channel → Settings → Channel Type → *Approve New
   Members*), sehingga user yang klik invite link masuk sebagai join
   request, bukan langsung menjadi member. Belum perlu diaktifkan pada
   Milestone 12.

## 4. Mendapatkan numeric channel ID

Cara paling aman untuk mendapatkan `chat.id` tanpa mengekspos data
pribadi anggota lain:

1. Tambahkan bot ke channel (langkah di atas) sehingga bot menerima
   update `my_chat_member` ketika status keanggotaannya berubah.
2. Pasang webhook (lihat bagian 6) lalu lihat log server (Vercel logs)
   untuk baris `Bot membership status updated` — baris ini mencetak
   `chatId` dan `chatType`, tanpa nama channel atau data anggota lain.
3. Alternatif tanpa webhook aktif: gunakan method Telegram
   `getUpdates` secara manual (misalnya lewat `curl`) setelah mem-post
   apa pun ke channel tersebut. **Catatan penting**: `getUpdates`
   tidak bisa dipakai bersamaan dengan webhook yang aktif. Jika
   webhook sudah dipasang, hapus dulu webhook dengan method
   `deleteWebhook` secara sadar/manual sebelum memanggil `getUpdates`,
   lalu pasang ulang webhook (`npm run telegram:webhook:set`) setelah
   selesai. Jangan menghapus webhook otomatis dari script — ini harus
   tindakan manual yang disengaja.
4. Setelah `chat.id` didapat, simpan ke `TELEGRAM_CHANNEL_ID`.

Project ini tidak menambahkan helper script terpisah untuk mengambil
channel ID karena `getChat`/`my_chat_member` log di atas sudah cukup;
helper tambahan hanya perlu dibuat jika langkah manual ini terasa
tidak praktis, dan jika dibuat, helper tersebut hanya boleh mencetak
`chat.id`, `chat.type`, dan `chat.title` — tidak pernah mencetak isi
pesan, username, nomor telepon, atau payload update lengkap.

## 5. Konfigurasi Vercel

Project → Settings → Environment Variables, tambahkan:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_CHANNEL_ID=
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
- Jika `TELEGRAM_CHANNEL_ID` diset: memanggil `getChat` dan **menolak**
  verifikasi jika `chat.type` bukan `channel` (error: *"TELEGRAM_CHANNEL_ID
  harus menunjuk ke Telegram channel, bukan group atau supergroup."*),
  lalu memanggil `getChatMember` untuk memastikan bot berstatus
  `administrator` (atau `creator`) dan permission `can_invite_users`
  aktif. Jika lolos semua, script mencetak:
  ```text
  Telegram channel terverifikasi
  Bot adalah administrator channel
  Permission Invite Users aktif
  ```
  Script ini tidak pernah mempromosikan bot secara otomatis, dan tidak
  memposting pesan test ke channel.

## 8. Update Telegram yang didukung

- `message` (hanya diproses pada **private chat** dengan bot — bukan
  channel, group, supergroup, atau discussion group):
  - `/start` tanpa parameter → bot membalas pesan welcome.
  - `/start TOKEN` atau `/start@BotUsername TOKEN` → bot memproses
    linking (lihat bagian 9). Parameter token tidak pernah dicatat ke
    log.
  - Pesan forwarded berisi `/start TOKEN` **tidak diproses** sebagai
    linking (dianggap invalid) — mencegah replay token lewat pesan
    yang diteruskan orang lain.
- `my_chat_member` — diterima, response `200`. Server-side log hanya
  mencatat `chatType`, `chatId`, dan `status` baru — tidak pernah
  mencatat username atau isi pesan.
- `chat_join_request` — diterima, response `200`, tapi **tidak
  diproses sama sekali** (tidak approve, tidak decline, tidak query
  Order, tidak menyimpan user ID, tidak membuat invite link). Ini
  disengaja untuk Milestone 13.
- Update lain yang valid tapi tidak dikenali → tetap direspons `200`
  supaya Telegram tidak melakukan retry berulang.

## 9. Telegram account linking (Milestone 12)

Flow:

```text
Order PAID
→ POST /api/telegram/link (buat linking token sekali pakai)
→ tampilkan tombol "Hubungkan Telegram" di /payment/[orderId]
→ deep link https://t.me/BOT_USERNAME?start=RAW_TOKEN dibuka
→ user menekan Start di private chat dengan bot
→ bot menerima /start TOKEN
→ backend memverifikasi token & menyimpan numeric Telegram user ID
→ GET /api/telegram/link-status dipoll dari browser sampai linked
```

**Cara kerja token:**

- Raw token: 32 byte random (`crypto.randomBytes`), di-encode
  base64url tanpa padding (~43 karakter, di bawah batas 64 karakter
  Telegram).
- Hanya `SHA-256` hash dari raw token yang disimpan ke database
  (`TelegramLinkToken.tokenHash`). Raw token tidak pernah disimpan,
  di-log, atau dimasukkan ke error reporting/analytics — hanya
  dikirim sekali ke browser lewat HTTPS response, lalu dipakai
  langsung sebagai parameter deep link.
- Token berlaku 30 menit (`expiresAt`), hanya bisa dipakai sekali
  (`usedAt`), dan bisa direvoke (`revokedAt`).
- Setiap kali token baru dibuat untuk Order yang sama, semua token
  lama yang belum dipakai untuk Order tersebut ikut direvoke dalam
  transaction yang sama — hanya token terbaru yang valid.

**Ownership Order dari browser:** endpoint `/api/telegram/link` dan
`/api/telegram/link-status` memakai mekanisme yang sama dengan
`GET /api/orders/[orderId]` yang sudah ada sejak awal: Order CUID
(`Order.id`, bukan `orderNumber`) berfungsi sebagai capability token —
siapa pun yang memegang CUID tersebut (dari link status pembayaran
miliknya sendiri) dianggap berhak mengakses Order itu. Ini didokumentasikan
di [`lib/order-access.ts`](../lib/order-access.ts). Endpoint ini tidak
menerima `telegramUserId`, status `PAID`, bot username, expiration,
harga, atau `registrationId` dari browser — semua nilai tersebut
ditentukan di server.

**Race condition:** konsumsi token di webhook dilakukan dalam satu
Prisma transaction, dengan `updateMany` bersyarat
(`id` + `usedAt: null` + `revokedAt: null` + `expiresAt` di masa
depan) untuk menandai token terpakai. Postgres mengunci baris token
tersebut saat `UPDATE`, sehingga request kedua yang mencoba token yang
sama akan menunggu lalu melihat `usedAt` sudah terisi — `updateMany`
mengembalikan 0 baris, dan diperlakukan sebagai token tidak valid.
Constraint unique pada `TelegramAccount.registrationId` dan
`TelegramAccount.telegramUserId` menjadi lapisan pertahanan kedua di
level database.

**Setelah linking berhasil**, bot membalas:

```text
Akun Telegram berhasil terhubung.

Silakan kembali ke website. Akses ke private channel akan diproses
pada langkah berikutnya.
```

Tidak ada invite link atau penambahan ke channel yang dikirim di titik
ini — itu Milestone 13.

## 10. Manual testing checklist

1. `npm run telegram:check` → pastikan `getMe` berhasil.
2. Pastikan channel terverifikasi (`chat.type === "channel"`), bot
   admin, dan `can_invite_users` aktif (jika `TELEGRAM_CHANNEL_ID`
   sudah diset).
3. Deploy ke Vercel dengan environment variables sudah diisi.
4. `npm run telegram:webhook:set`.
5. `npm run telegram:check` lagi → periksa `getWebhookInfo`
   (`pending_update_count` idealnya 0, `last_error_message` kosong).
6. Kirim `/start` (tanpa token) ke bot dari chat privat → pastikan bot
   membalas pesan welcome.
7. Buat Order `PAID`, buka `/payment/[orderId]`, klik **Hubungkan
   Telegram** → pastikan Telegram terbuka dengan deep link, tekan
   **Start** → pastikan bot membalas pesan sukses, dan halaman web
   berubah status menjadi *linked* (via polling atau saat kembali ke
   tab).
8. Gunakan token yang sama untuk kedua kalinya → pastikan bot membalas
   pesan generik "Tautan penghubung tidak valid atau sudah
   kedaluwarsa." (bukan pesan yang membocorkan Order/Registration).
9. Buat token baru, tunggu 30 menit hingga expired → pastikan ditolak
   dengan pesan yang sama.
10. Coba `/start TOKEN` dari akun Telegram lain (bukan yang membuka
    deep link pertama kali) setelah Registration lain sudah linked →
    pastikan pesan konflik yang sesuai muncul, dan tidak ada
    perpindahan otomatis.
11. Kirim `/start TOKEN` dari sebuah channel atau group (bukan private
    chat) → pastikan tidak diproses sebagai linking.
12. Periksa Vercel logs → pastikan tidak ada bot token, webhook
    secret, raw token, atau Telegram user ID yang tercetak.
13. Pastikan belum ada channel invite link yang dibuat dan belum ada
    `chat_join_request` yang di-approve — keduanya baru masuk
    Milestone 13.

## 11. Retry policy untuk `sendMessage`

Webhook tidak melakukan retry internal ketika `sendTelegramMessage`
gagal (misalnya user memblokir bot, atau rate limit sesaat) — termasuk
setelah linking transaction berhasil di database. Kegagalan hanya
dicatat via `console.error` dengan pesan aman (tanpa token atau
Telegram user ID), linking tidak pernah dibatalkan, dan endpoint tetap
mengembalikan `200` ke Telegram. Alasan:

- Update `message` dari Telegram tidak di-retry oleh Telegram
  berdasarkan gagal/berhasilnya `sendMessage` kita — retry Telegram
  hanya terjadi jika endpoint webhook ini sendiri tidak membalas
  `2xx`. Karena itu, mengembalikan `200` meski `sendMessage` gagal
  sudah tepat: mencegah Telegram mengirim ulang update yang sama
  berulang kali, yang bisa memicu percobaan linking ganda atau spam
  pesan ke user yang sama.
- Retry manual di sisi kita (misal loop coba ulang) sengaja tidak
  diimplementasikan untuk menghindari kompleksitas dan risiko flooding
  user dengan pesan duplikat.
