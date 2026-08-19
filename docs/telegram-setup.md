# Telegram Bot Setup, Account Linking, Channel Access & Revocation (Milestone 11–14)

Target Telegram project ini adalah **private Telegram channel** —
bukan group, supergroup, atau discussion group. Istilah "channel"
dipakai konsisten di seluruh environment variable, kode, dokumentasi,
dan pesan bot.

- Milestone 11 menyiapkan infrastruktur dasar: client API, webhook,
  dan verifikasi bot/channel.
- Milestone 12 menambahkan account linking: setelah Order `PAID`,
  pengguna menghubungkan akun Telegram-nya lewat deep link
  `/start TOKEN` di private chat dengan bot.
- Milestone 13 menambahkan pemberian akses channel: setelah akun
  Telegram ter-link, sistem membuat invite link join-request-only ke
  private channel, dan bot menyetujui permintaan bergabung itu secara
  otomatis setelah verifikasi.
- Milestone 14 (bagian ini) menambahkan **pencabutan** akses channel:
  saat pembayaran tidak lagi memenuhi syarat (full refund atau
  chargeback), sistem mencabut invite link aktif dan mengeluarkan
  pengguna dari private channel — lihat bagian 13.

## 1. Environment variables

| Variable | Keterangan |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Token rahasia dari BotFather. Hanya dipakai di backend (server-side), tidak pernah dikirim ke client. |
| `TELEGRAM_BOT_USERNAME` | Username bot tanpa karakter `@` (contoh: `synextrade_bot`). Dipakai untuk membangun deep link `https://t.me/USERNAME?start=TOKEN`. |
| `TELEGRAM_CHANNEL_ID` | Numeric ID private Telegram channel tujuan, biasanya bernilai negatif dan dapat diawali `-100`. Dibaca dan diperlakukan sebagai **string** — tidak pernah sebagai JavaScript `number`, karena Telegram chat ID bisa melebihi batas aman `number`. |
| `TELEGRAM_CHANNEL_INVITE_TTL_MINUTES` | Masa berlaku invite link (menit) sebelum harus dibuat ulang. Default `30` jika tidak diset. |
| `TELEGRAM_WEBHOOK_SECRET` | Random secret untuk memverifikasi request webhook Telegram (header `X-Telegram-Bot-Api-Secret-Token`). |
| `APP_URL` | Domain HTTPS production yang stabil, misalnya `https://nama-project.vercel.app`. Jangan pakai URL preview deployment yang berubah setiap commit. |

Private channel **sebaiknya tidak memiliki public username** (jangan
diset sebagai public channel) — public channel dapat diakses siapa
pun lewat link `t.me/username` tanpa melalui alur pembayaran dan
join-request ini sama sekali.

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
`node --env-file=.env.local`, jadi isi keenam variable di atas pada
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

1. Buat channel Telegram baru, set sebagai **private channel** —
   jangan set username publik (lihat catatan di bagian 1).
2. Tambahkan bot yang baru dibuat ke channel tersebut.
3. Jadikan bot sebagai **administrator** channel.
4. Saat memberi permission admin, aktifkan **Invite Users via Link**
   (`can_invite_users`) — dibutuhkan agar bot dapat memanggil
   `createChatInviteLink`/`revokeChatInviteLink`.
5. Aktifkan pengaturan **"Request to join"** / persetujuan approval
   pada private channel (Channel → Settings → Channel Type →
   *Approve New Members*). Ini wajib untuk Milestone 13: tanpa ini,
   invite link dengan `creates_join_request: true` tidak akan memicu
   update `chat_join_request` ke webhook, dan bot tidak akan pernah
   menyetujui siapa pun secara otomatis.

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
TELEGRAM_CHANNEL_INVITE_TTL_MINUTES=30
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

`allowed_updates` sudah mencakup `chat_join_request` sejak Milestone
11, jadi Milestone 13 **tidak mengharuskan** menjalankan ulang script
ini. Jalankan ulang hanya jika `APP_URL` atau
`TELEGRAM_WEBHOOK_SECRET` berubah.

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
- `chat_join_request` — sejak Milestone 13, diproses penuh (lihat
  bagian 11). Berbeda dari update lain: kegagalan **transient**
  selama proses approve mengembalikan HTTP `503` (bukan `200`) supaya
  Telegram mengirim ulang update tersebut — request join yang belum
  sempat disetujui tidak boleh hilang begitu saja.
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
ini — itu terjadi di langkah berikutnya (bagian 10).

## 10. Channel access (Milestone 13)

Flow:

```text
Order PAID + Telegram sudah di-link
→ POST /api/telegram/channel-access (buat invite link join-request)
→ tombol "Ajukan Bergabung ke Private Channel" di /payment/[orderId]
→ user membuka invite link, menekan Request to Join di Telegram
→ Telegram mengirim update chat_join_request ke webhook
→ webhook memverifikasi channel, akun Telegram, Order PAID, & invite link
→ bot memanggil approveChatJoinRequest, akses ditandai GRANTED
→ invite link dicabut, GET /api/telegram/channel-access dipoll sampai GRANTED
```

**Invite link:**

- Dibuat dengan `createChatInviteLink({ creates_join_request: true })`
  — **tidak pernah** `member_limit` bersamaan dengan
  `creates_join_request` (Telegram menolak kombinasi ini).
- `expire_date` dihitung dari `TELEGRAM_CHANNEL_INVITE_TTL_MINUTES`
  (default 30 menit).
- `name` invite link adalah string hex opaque 16 karakter
  (`crypto.randomBytes(8)`), jauh di bawah batas 32 karakter Telegram,
  dan tidak mengandung email/nama/order number apa pun.
- Invite link mentah disimpan sementara di `TelegramAccess.inviteLink`
  (diperlukan untuk `revokeChatInviteLink`), diperlakukan sebagai
  bearer secret: tidak pernah di-log, tidak pernah dikembalikan lewat
  `GET /api/telegram/channel-access` (endpoint status hanya
  mengembalikan `accessStatus`/`inviteExpiresAt`/`grantedAt`), dan
  dikosongkan begitu status menjadi `GRANTED` atau invite baru dibuat.
- `TelegramAccess.inviteLinkHash` (SHA-256, unique) dipakai untuk
  mencocokkan `chat_join_request.invite_link.invite_link` dari
  Telegram tanpa perlu membandingkan string mentah di tempat lain.

**Ownership & sumber kebenaran:** `POST`/`GET /api/telegram/channel-access`
memakai capability model yang sama (`lib/order-access.ts`). Endpoint
tidak pernah menerima `telegramUserId` dari browser — status
pembayaran dan identitas akun Telegram selalu diambil ulang dari
database (hasil webhook Midtrans & webhook Telegram yang sudah
terverifikasi), bukan dari input request.

**Kompensasi saat invite link dibuat:**

1. Reservasi/`upsert` baris `TelegramAccess` (tanpa transaction, di
   luar pemanggilan Telegram).
2. Panggil `createChatInviteLink` ke Telegram.
3. Simpan hasil (`inviteLink`, hash, `expiresAt`, status `INVITED`) ke
   baris yang sama.
4. Jika langkah 3 gagal, coba `revokeChatInviteLink` atas link yang
   baru dibuat (compensating action) dan jangan pernah mengembalikan
   link tersebut ke client.

Transaksi database tidak pernah dibuka sambil menunggu network call ke
Telegram — setiap langkah di atas adalah write tunggal, bukan
`$transaction` yang menahan koneksi selama request HTTP ke Telegram.

**Rekonsiliasi:** setiap kali `POST /api/telegram/channel-access`
dipanggil dan akses belum `GRANTED`, backend memanggil `getChatMember`
untuk cek keanggotaan channel yang sebenarnya. Jika pengguna ternyata
sudah menjadi member/administrator/creator (misalnya disetujui manual
oleh admin), akses langsung direkonsiliasi menjadi `GRANTED` tanpa
membuat invite baru.

**Validasi webhook `chat_join_request`** (di luar verifikasi secret
header yang tetap berjalan seperti biasa):

1. `chat.id` harus persis sama dengan `TELEGRAM_CHANNEL_ID` (perbandingan
   string, bukan `number`).
2. `chat.type` harus `"channel"`.
3. `from.id` harus tersedia.
4. `invite_link.invite_link` harus tersedia — hash-nya dicari di
   `TelegramAccess.inviteLinkHash` (unique lookup, bukan pencarian
   berdasarkan Telegram user ID lebih dulu).
5. Akun Telegram pada `TelegramAccess` yang ditemukan harus persis
   sama dengan `from.id` (dibandingkan sebagai string) — kalau beda,
   request didecline tanpa membocorkan alasan.
6. `Order` terkait harus masih `PAID`.
7. Status akses harus `INVITED` dan `inviteExpiresAt` belum lewat.
8. Klaim status dilakukan atomic (`updateMany` bersyarat
   `status: "INVITED" → "REQUESTED"`) — kalau count-nya bukan 1,
   berarti ada delivery lain yang sudah memproses, request ini
   berhenti tanpa approve kedua kalinya.

Jika semua valid → `approveChatJoinRequest`, tandai `GRANTED`, cabut
invite link, kosongkan field invite mentah, kirim pesan konfirmasi
pribadi. Jika ada satu saja yang tidak valid → `declineChatJoinRequest`
(best-effort) + pesan generik yang sama untuk semua alasan penolakan
(tidak membocorkan yang mana yang salah):

```text
Permintaan bergabung tidak dapat diproses. Silakan ambil tautan baru
dari website.
```

**Idempotency & recovery:**

- `TelegramWebhookEvent.updateId` (unique) dipakai sebagai fast-path:
  kalau `update_id` yang sama sudah tercatat berstatus `"done"`,
  webhook langsung berhenti tanpa memproses ulang.
- Mekanisme utama anti-double-approve tetap `updateMany` bersyarat di
  atas (per baris `TelegramAccess`, bukan per `update_id`) — lebih
  presisi karena Telegram bisa mengirim update dengan `update_id`
  berbeda untuk kejadian yang secara bisnis sama.
- Jika `approveChatJoinRequest` gagal karena error transient
  (timeout/network) → status dikembalikan ke `INVITED`, webhook
  membalas HTTP `503` supaya Telegram mengirim ulang update.
- Jika `approveChatJoinRequest` gagal dengan respons Telegram (bukan
  transient — misalnya request sudah tidak ada lagi) → backend
  mencoba rekonsiliasi lewat `getChatMember` sebelum menyerah.
- Jika approve **berhasil** di Telegram tapi update database ke
  `GRANTED` gagal → status tetap `REQUESTED`, webhook membalas `503`.
  Percobaan berikutnya (baik retry Telegram maupun rekonsiliasi dari
  `POST /api/telegram/channel-access`) akan mendeteksi user sudah jadi
  member lewat `getChatMember` dan menyelesaikan `GRANTED` tanpa
  approve kedua kalinya.

## 11. Manual testing checklist

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
13. Setelah linking, klik **Dapatkan Akses Channel** → pastikan invite
    link terbuka di Telegram, dengan tombol berubah menjadi **Ajukan
    Bergabung ke Private Channel**.
14. Di channel Telegram (private, dengan "Approve New Members"
    aktif), tekan **Request to Join** menggunakan invite link
    tersebut → pastikan bot langsung menyetujui, halaman web berubah
    menjadi *Akses private channel sudah diberikan*, dan invite link
    lama tidak bisa dipakai lagi (sudah dicabut).
15. Pastikan pesan pribadi konfirmasi dari bot muncul di chat privat.
16. Coba pakai invite link yang sama sekali lagi (link baru/kadaluwarsa,
    atau dari akun Telegram lain) → pastikan permintaan didecline dan
    bot membalas pesan generik, tanpa membocorkan alasan spesifik.
17. Uji Order yang berubah menjadi non-`PAID` (misalnya refund) sebelum
    join request diproses → pastikan join request baru tetap didecline
    meskipun akses sebelumnya sempat `INVITED`.
18. Periksa Vercel logs → pastikan tidak ada bot token, webhook
    secret, invite URL mentah, atau Telegram user ID lengkap yang
    tercetak.

## 12. Retry policy untuk `sendMessage` dan `chat_join_request`

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

**`chat_join_request` adalah pengecualian yang disengaja** dari
kebijakan "selalu 200" di atas. Kegagalan transient selama
`approveChatJoinRequest` (timeout, network error, atau kegagalan
menulis status `GRANTED` setelah approve sukses) membuat webhook
membalas HTTP `503`, bukan `200` — supaya Telegram mengirim ulang
update dan permintaan bergabung yang sah tidak hilang begitu saja
hanya karena gangguan sesaat. Semua path lain untuk update ini
(channel salah, akun belum di-link, invite tidak cocok/kedaluwarsa,
Order tidak lagi `PAID`, atau duplicate update yang sudah `GRANTED`)
tetap membalas `200` seperti biasa, karena itu adalah keputusan
final (decline/no-op), bukan kegagalan yang perlu diulang.

## 13. Pencabutan akses channel (Milestone 14)

Saat pembayaran suatu Order tidak lagi memenuhi syarat (full refund
atau chargeback), sistem mencabut akses private channel-nya secara
otomatis. Implementasi ada di
[`lib/telegram-access-revocation.ts`](../lib/telegram-access-revocation.ts),
dipicu dari
[`app/api/webhooks/midtrans/route.ts`](../app/api/webhooks/midtrans/route.ts)
setelah database commit.

### Kebijakan eligibility

Sumber kebenaran tunggal:
[`lib/telegram-entitlement.ts`](../lib/telegram-entitlement.ts),
fungsi `getTelegramEntitlementDecision(order)` — dipanggil baik oleh
webhook (untuk memutuskan apakah perlu memicu revocation) maupun oleh
service revocation itu sendiri (untuk memverifikasi ulang sebelum
bertindak). Keputusan selalu dibaca dari `Order.status` +
`Order.amount` + `Order.refundedAmount` yang tersimpan di database,
bukan dari payload webhook mentah.

| `Order.status` | Keputusan |
| --- | --- |
| `PAID` | `ELIGIBLE` |
| `REFUNDED` | `INELIGIBLE` (`FULL_REFUND`) |
| `CHARGEBACK` | `INELIGIBLE` (`CHARGEBACK`) |
| `PARTIAL_CHARGEBACK` | `REVIEW_REQUIRED` — project belum punya kebijakan pencabutan otomatis untuk partial chargeback, jadi selalu masuk manual review, tidak pernah otomatis mencabut. |
| `PARTIALLY_REFUNDED` | `INELIGIBLE` jika `refundedAmount >= amount` (diperlakukan sebagai full refund by value, walau butuh beberapa kali partial refund); selain itu `UNCHANGED` (akses dipertahankan, dianggap kondisi yang perlu diaudit manual). |
| `PENDING` / `EXPIRED` / `CANCELLED` / `FAILED` | `UNCHANGED` — status ini tidak pernah mencabut akses yang sebelumnya `PAID`. |

`PARTIAL_CHARGEBACK` adalah nilai `PaymentStatus` baru, sengaja
dipisah dari `CHARGEBACK` (full) — kalau digabung, keputusan "review,
jangan cabut otomatis" untuk partial chargeback tidak bisa dibedakan
dari full chargeback yang harus dicabut.

`Order.refundedAmount` (integer, Rupiah) diisi dari field
`refund_amount` pada respons Midtrans GET Status API (cumulative
refund), bukan dari payload webhook browser-facing manapun.

### Guard anti-downgrade & anti out-of-order

`app/api/webhooks/midtrans/route.ts` memanggil Midtrans GET Status API
untuk setiap notification (perilaku sejak Milestone sebelumnya — jadi
status yang diproses selalu status terkini menurut Midtrans, bukan
sekadar isi payload webhook). Di atas itu, `shouldPersistStatusChange`
menambahkan guard eksplisit:

- Begitu `Order.status` mencapai `REFUNDED` atau `CHARGEBACK`, status
  tersebut **beku** — notification apa pun setelahnya tidak lagi
  mengubah `status` (hanya `midtransTransactionId`/`refundedAmount`
  yang masih boleh tercatat untuk audit).
- Selain itu, begitu `Order.status` sudah `PAID` atau statusnya
  merupakan turunan refund/chargeback, notification yang memetakan ke
  status non-payment (`PENDING`/`EXPIRED`/`CANCELLED`/`FAILED`) selalu
  ditolak — mencegah webhook lama/out-of-order mencabut akses yang
  sah.
- `transaction_id` yang sudah tercatat pada Order (`
  midtransTransactionId`) juga dicocokkan dengan setiap notification
  baru — kalau tidak cocok, notification ditolak (400) sebelum
  mempengaruhi Order sama sekali.

### Alur revocation

1. Webhook Midtrans commit perubahan `Order.status` +
   `refundedAmount` dalam satu `$transaction` (seperti sebelumnya).
2. Setelah commit (di luar transaction, sehingga tidak pernah menahan
   koneksi DB sambil menunggu Telegram), jika status final Order
   termasuk kategori yang relevan untuk entitlement (`REFUNDED`,
   `PARTIALLY_REFUNDED`, `CHARGEBACK`, `PARTIAL_CHARGEBACK`),
   `reconcileTelegramAccessForOrder(orderId)` dipanggil — best-effort,
   tidak pernah membuat response webhook gagal.
3. Service membaca ulang Order + `TelegramAccess` dari database dan
   memanggil `getTelegramEntitlementDecision` lagi (defense in depth —
   tidak pernah percaya keputusan yang dibuat sebelumnya di webhook).
4. Kalau `REVIEW_REQUIRED` → akses langsung ditandai `MANUAL_REVIEW`
   tanpa panggilan Telegram apa pun (tidak ada invite yang dicabut,
   tidak ada user yang dikeluarkan) — menunggu tindakan manual.
5. Kalau `INELIGIBLE` → klaim akses secara atomic ke
   `REVOCATION_PENDING` (lihat "Concurrency" di bawah), lalu:
   - Cabut invite link aktif milik Order ini (`revokeChatInviteLink`)
     dan kosongkan field invite mentah.
   - Cari `TelegramAccess` lain untuk `telegramAccountId` yang sama
     dengan `order.status === "PAID"` dan `status !== "REVOKED"`. Kalau
     ada → **jangan** keluarkan user dari channel; akses Order ini saja
     yang ditandai `REVOKED` dengan outcome
     `SKIPPED_OTHER_ENTITLEMENT`.
   - Kalau tidak ada entitlement lain → `getChatMember` untuk
     memeriksa status keanggotaan sebenarnya:
     - `administrator`/`creator` → **tidak** dicopot otomatis, akses
       ditandai `MANUAL_REVIEW` dengan outcome
       `MANUAL_REVIEW_REQUIRED`.
     - `left` → sudah bukan member, ditandai `REVOKED` dengan outcome
       `ALREADY_NOT_MEMBER` (idempotent success).
     - `kicked` → jalankan `unbanChatMember` (mencegah blacklist
       permanen), lalu ditandai `REVOKED` / `ALREADY_NOT_MEMBER`.
     - `member`/`restricted` → `banChatMember` lalu langsung
       `unbanChatMember`, diverifikasi ulang lewat `getChatMember`
       (harus tidak lagi `member`/`administrator`/`creator`), baru
       ditandai `REVOKED` dengan outcome `REMOVED`.
   - Setelah `REVOKED` dengan outcome `REMOVED` atau
     `ALREADY_NOT_MEMBER` (bukan `SKIPPED_OTHER_ENTITLEMENT`), bot
     mengirim pesan pribadi aman ke user (gagal kirim tidak pernah
     membatalkan status `REVOKED` yang sudah tersimpan):
     ```text
     Akses ke private channel telah dinonaktifkan karena pembayaran
     tidak lagi memenuhi persyaratan akses.

     Jika menurut Anda ini tidak sesuai, silakan hubungi administrator.
     ```

### Kenapa ban lalu unban, bukan ban saja

`banChatMember` mengeluarkan user dari channel, tapi kalau dibiarkan
begitu saja Telegram akan memblokir user itu bergabung lagi
selamanya. Karena project ini tidak punya kebijakan blacklist
permanen, setiap `banChatMember` yang berhasil selalu segera diikuti
`unbanChatMember` (`only_if_banned: true`, sehingga idempotent kalau
dipanggil ulang). Setelah unban, user **tidak otomatis** kembali ke
channel — mereka hanya bisa bergabung lagi lewat invite link
join-request baru (Milestone 13), yang hanya bisa dibuat kalau
Order/akses mereka kembali `ELIGIBLE` di kemudian hari (lihat bagian
15 di bawah).

### Administrator & creator

`isPrivilegedChannelMember` (di `lib/telegram-channel.ts`) menandai
status `administrator`/`creator` sebagai tidak boleh dicopot otomatis.
Kasus ini selalu berhenti di `MANUAL_REVIEW` — perlu tindakan manual
seorang admin lewat Telegram langsung (menurunkan/mengeluarkan
administrator/creator secara sengaja), bukan sesuatu yang dilakukan
kode ini.

### Multiple entitlement & race condition

Pemeriksaan entitlement lain dilakukan berdasarkan `telegramAccountId`
+ `Order.status === "PAID"` di database (bukan hanya berdasarkan
`orderId` saat ini), sesaat sebelum operasi Telegram apa pun
dijalankan — jadi Order B yang `PAID` selalu mencegah user dikeluarkan
walau Order A untuk akun Telegram yang sama sedang direvoke.

Concurrency dijaga dengan `TelegramAccess.operationVersion`
(optimistic concurrency): setiap transisi status memakai
`updateMany` bersyarat `WHERE id = ... AND operationVersion = ... AND
status = ...`, jadi hanya satu worker yang bisa mengklaim satu
transisi. Worker yang kalah race memperlakukan hasilnya sebagai
idempotent no-op — bukan error. Tidak ada database transaction yang
dibuka selama menunggu Telegram API; setiap langkah adalah write
tunggal.

### Retry & reconciliation

Kegagalan Telegram API pada langkah mana pun (lookup member, revoke
invite, ban, unban, verifikasi ulang) memindahkan akses ke
`REVOCATION_FAILED` dengan kode error internal aman (`TELEGRAM_TIMEOUT`,
`TELEGRAM_HTTP_ERROR`, `TELEGRAM_PERMISSION_DENIED`,
`TELEGRAM_MEMBER_LOOKUP_FAILED`, `TELEGRAM_BAN_FAILED`,
`TELEGRAM_UNBAN_FAILED`, `TELEGRAM_VERIFICATION_FAILED`,
`INVITE_REVOCATION_FAILED`) — tidak pernah pesan error Telegram
mentah. `revocationAttemptCount` naik, dan `nextRevocationAttemptAt`
dihitung dengan exponential backoff (basis 1 menit, maksimum 60
menit). Sebuah `REVOCATION_PENDING` yang tidak selesai lebih dari 2
menit (proses yang mati di tengah jalan) dianggap abandoned dan boleh
diklaim ulang oleh percobaan berikutnya.

Project ini belum punya infrastruktur cron/queue, jadi retry
dijalankan lewat script manual:

```bash
npm run telegram:reconcile
```

Script [`scripts/reconcile-telegram-access.ts`](../scripts/reconcile-telegram-access.ts)
memproses batch kecil (20) `TelegramAccess` yang `REVOCATION_FAILED`
dan sudah lewat `nextRevocationAttemptAt`, atau `REVOCATION_PENDING`
yang abandoned — lewat service yang sama persis dengan webhook
(`reconcileTelegramAccessForOrder`, yang selalu memverifikasi ulang
eligibility dari database sebelum bertindak). Script ini tidak pernah
mencetak Telegram user ID atau secret, hanya jumlah kandidat yang
diproses. Jalankan dari environment server yang aman (server lokal
dengan akses `.env.local`, atau shell Vercel/CI yang terpercaya) —
endpoint retry publik sengaja tidak dibuat.

### Endpoint & UI yang berubah

- `POST /api/telegram/channel-access` menolak membuat invite baru
  kalau akses sedang `REVOCATION_PENDING`, `REVOCATION_FAILED`,
  `REVOKED`, atau `MANUAL_REVIEW` — mengembalikan status tersebut apa
  adanya (bukan error) supaya UI bisa menampilkan state yang benar.
- `GET /api/telegram/channel-access` menambahkan field `revokedAt`
  (timestamp saja, bukan alasan pencabutan) pada response status.
- `/payment/[orderId]` menampilkan section akses channel untuk status
  Order `PAID`, `REFUNDED`, `PARTIALLY_REFUNDED`, `CHARGEBACK`, dan
  `PARTIAL_CHARGEBACK` (sebelumnya hanya `PAID`) — supaya user yang
  aksesnya sedang/sudah dicabut tetap melihat status yang jujur,
  bukan section yang hilang begitu saja. Empat state baru:
  - **Sedang dicabut** (`REVOCATION_PENDING`): "Akses private channel
    sedang dinonaktifkan." — polling tetap berjalan.
  - **Sudah dicabut** (`REVOKED`): "Akses private channel telah
    dinonaktifkan karena pembayaran tidak lagi memenuhi persyaratan
    akses." — polling berhenti (state terminal).
  - **Perlu pemeriksaan manual** (`MANUAL_REVIEW`): "Status akses
    sedang diperiksa. Silakan hubungi administrator jika status tidak
    berubah." — polling berhenti.
  - **Gagal sementara** (`REVOCATION_FAILED`): "Pembaruan akses sedang
    diproses. Silakan periksa kembali beberapa saat lagi." — tidak
    membocorkan kode error internal, polling tetap berjalan supaya
    retry di background otomatis tercermin di UI.

  Tidak ada satu pun state ini yang menampilkan tombol pembuatan
  invite baru.

### Pembelian ulang / restorasi akses

Milestone ini tidak pernah menambahkan user kembali ke channel secara
otomatis. Kalau Order yang sama kelak dikoreksi kembali menjadi
eligible (jarang — perlu keputusan manual di luar sistem ini), atau
Registration membuat Order baru yang `PAID`, user tetap harus melalui
flow invite join-request biasa (Milestone 13) dari awal; `unbanChatMember`
memastikan mereka tidak diblokir melakukannya, tapi invite link lama
yang sudah dicabut tidak pernah dipakai ulang.

### Environment variable & permission

Tidak ada environment variable baru untuk Milestone 14 — semua
variable di bagian 1 tetap dipakai. Permission Telegram bot yang
dibutuhkan bertambah satu:

- `can_invite_users` — sudah wajib sejak Milestone 13 (invite link).
- `can_restrict_members` — **baru**, wajib untuk `banChatMember` /
  `unbanChatMember`. Aktifkan lewat channel → Administrators → pilih
  bot → aktifkan **Restrict Members** (Ban Users).

`npm run telegram:check` sekarang juga memverifikasi
`can_restrict_members` (lihat bagian 7) dan akan menampilkan error
aman berikut kalau salah satu dari dua permission ini tidak aktif:

```text
Bot harus menjadi administrator channel dan memiliki permission
Restrict Members.
```

### Manual testing — pencabutan akses

Lanjutan dari checklist bagian 11, dijalankan di Midtrans sandbox:

1. Ulangi langkah 1–16 bagian 11 sampai `TelegramAccess` berstatus
   `GRANTED` untuk sebuah Order `PAID`.
2. Trigger full refund pada transaksi sandbox tersebut (Midtrans
   Simulator / dashboard sandbox).
3. Pastikan notification Midtrans diverifikasi (signature, nominal,
   transaction ID) sebelum diproses.
4. Pastikan `Order.status` berubah menjadi `REFUNDED` dan
   `TelegramAccess.status` sempat singgah di `REVOCATION_PENDING`.
5. Pastikan invite link Order tersebut tercabut (raw `inviteLink`
   kosong di database).
6. Pastikan user benar-benar keluar dari private channel Telegram.
7. Pastikan user **tidak** dibanned permanen — coba buat invite link
   baru secara manual dan pastikan user tetap bisa mengajukan join
   request kalau suatu saat eligible lagi.
8. Pastikan `TelegramAccess.status` akhirnya `REVOKED` dengan
   `removalOutcome: REMOVED`.
9. Kirim webhook refund yang identik dua kali (replay notification
   Midtrans yang sama) → pastikan tidak ada operasi Telegram kedua
   (tidak ada ban/unban ganda), dan hasil akhir tetap `REVOKED`.
10. Simulasikan kegagalan Telegram (matikan `TELEGRAM_BOT_TOKEN`
    sesaat, atau putus jaringan) tepat saat proses ban/unban →
    pastikan `TelegramAccess.status` menjadi `REVOCATION_FAILED`
    dengan `nextRevocationAttemptAt` terisi, bukan `REVOKED` palsu.
11. Jalankan `npm run telegram:reconcile` setelah kondisi normal →
    pastikan status akhirnya konsisten menjadi `REVOKED`.
12. Uji user yang sudah keluar dari channel sebelum refund diproses
    (misalnya leave manual) → pastikan diperlakukan sebagai idempotent
    success (`ALREADY_NOT_MEMBER`), tanpa error.
13. Hubungkan Telegram account yang sama ke dua Order `PAID` berbeda
    (dua Registration/Order dengan Telegram account yang sama tidak
    mungkin lewat flow normal satu Registration — uji ini paling
    relevan lewat dua Order dari Registration yang sama jika linking
    memperbolehkannya, atau lewat data seed manual di database
    development). Refund salah satu Order → pastikan user **tidak**
    dikeluarkan dari channel selama Order lain masih `PAID`, dan
    outcome tercatat `SKIPPED_OTHER_ENTITLEMENT`.
14. Refund/chargeback seluruh Order milik akun Telegram tersebut →
    pastikan user baru dikeluarkan setelah tidak ada entitlement valid
    tersisa.
15. Uji partial refund di bawah nilai transaksi → pastikan akses
    dipertahankan (`UNCHANGED`), tidak ada pencabutan.
16. Uji partial refund kumulatif yang mencapai/melebihi nilai
    transaksi (via beberapa kali partial refund) → pastikan
    diperlakukan sebagai full refund dan akses dicabut.
17. Trigger chargeback penuh → pastikan akses dicabut seperti full
    refund.
18. Trigger partial chargeback → pastikan `TelegramAccess.status`
    menjadi `MANUAL_REVIEW`, **tidak** ada invite yang dicabut dan
    **tidak** ada user yang dikeluarkan.
19. Uji dengan user yang berstatus `administrator` di channel → refund
    Order-nya → pastikan masuk `MANUAL_REVIEW` dengan outcome
    `MANUAL_REVIEW_REQUIRED`, dan role administrator tidak diturunkan
    otomatis.
20. Periksa Vercel logs (atau log lokal) → pastikan tidak ada bot
    token, webhook secret, Midtrans server key, invite URL, atau
    Telegram user ID lengkap yang tercetak.
21. Buka `/payment/[orderId]` untuk Order yang sudah `REVOKED` →
    pastikan tidak ada tombol pembuatan invite baru, dan pesan yang
    tampil sesuai state (`REVOKED`/`MANUAL_REVIEW`/`REVOCATION_FAILED`).
22. Setelah akses `REVOKED`, coba buat Order baru (pembelian ulang)
    dan bayar sampai `PAID` → pastikan user bisa mengajukan invite
    join-request baru dari awal (bukan otomatis ditambahkan kembali).

Jangan melakukan refund/chargeback atau mengeluarkan member pada
transaksi/channel **production** selama manual testing tanpa
konfirmasi eksplisit dari pemilik project.
