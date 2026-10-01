# Security & Reliability (Milestone 15)

Ringkasan implementasi Milestone 15, sebagai lanjutan Milestone 11–14
yang didokumentasikan di [`docs/telegram-setup.md`](./telegram-setup.md).
Dokumen ini mencakup: environment variables baru, security controls,
cara menjalankan migration & reconciliation, konfigurasi Telegram
webhook secret (ringkas — detail lengkap tetap di
`docs/telegram-setup.md`), penanganan incident/error monitoring,
backup & restore, privacy consent, serta keterbatasan desain yang
disengaja.

## 1. Environment variables baru

Semua environment variable divalidasi lewat [`lib/env.ts`](../lib/env.ts)
(Zod). Lihat [`.env.example`](../.env.example) untuk daftar lengkap
dengan placeholder. Yang baru di Milestone 15:

| Variable | Default | Keterangan |
| --- | --- | --- |
| `ADMIN_API_SECRET` | — (wajib di production) | Bearer secret untuk endpoint admin (`POST /api/admin/reconciliation`). Minimum 32 karakter. |
| `OUTBOUND_REQUEST_TIMEOUT_MS` | `10000` | Timeout (ms) untuk seluruh outbound request ke Midtrans/Telegram. |
| `OUTBOUND_MAX_RETRIES` | `2` | Jumlah retry tambahan (di luar percobaan pertama) untuk operasi yang aman diulang. |
| `OUTBOUND_RETRY_BASE_DELAY_MS` | `300` | Basis exponential backoff (dengan jitter) antar retry. |
| `RATE_LIMIT_ENABLED` | `true` | Set `false` untuk menonaktifkan rate limiting (mis. saat load testing lokal). |
| `RECONCILIATION_PENDING_AGE_MINUTES` | `30` | Order `PENDING` baru dianggap kandidat reconciliation setelah tidak berubah selama ini. |
| `RECONCILIATION_BATCH_SIZE` | `50` | Jumlah maksimum Order yang diproses per run. |
| `RECONCILIATION_CONCURRENCY` | `5` | Jumlah Order yang diproses paralel dalam satu batch. |
| `RECONCILIATION_CRON` | — | Dokumentasi saja — dibaca oleh scheduler eksternal kamu, bukan oleh script ini sendiri (lihat bagian 4). |
| `ERROR_MONITORING_ENABLED` | `false` | Set `true` + isi `ERROR_MONITORING_DSN` untuk mengaktifkan pelaporan error. No-op selama `false`. |
| `ERROR_MONITORING_DSN` | — | URL endpoint JSON-ingest untuk error monitoring (lihat bagian 6). |

Variable dari milestone sebelumnya (`DATABASE_URL`, `MIDTRANS_SERVER_KEY`,
`TELEGRAM_BOT_TOKEN`, dll.) tidak berubah — lihat `.env.example` dan
`docs/telegram-setup.md` §1.

**Fail-fast di production**: [`instrumentation.ts`](../instrumentation.ts)
memanggil `assertRequiredSecurityEnv()` saat server start. Jika salah
satu dari `DATABASE_URL`, `MIDTRANS_SERVER_KEY`, `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_BOT_USERNAME`, `TELEGRAM_CHANNEL_ID`, `TELEGRAM_WEBHOOK_SECRET`,
`ADMIN_API_SECRET` belum diset di production, proses akan throw saat
boot (bukan diam-diam berjalan dengan keamanan yang berkurang). Di
development/test, ini hanya mencetak warning agar setup lokal parsial
tetap bisa berjalan.

## 2. Security controls yang diterapkan

| Kontrol | Implementasi |
| --- | --- |
| Input validation | Zod schema di [`lib/schemas.ts`](../lib/schemas.ts), dipakai di semua endpoint API, webhook, dan action admin. |
| Rate limiting | [`lib/rate-limit.ts`](../lib/rate-limit.ts) — lihat bagian 3. |
| Verifikasi signature Midtrans | [`lib/midtrans-signature.ts`](../lib/midtrans-signature.ts), dipanggil dari webhook sebelum data apa pun diproses. |
| Verifikasi secret Telegram | [`lib/telegram-webhook-auth.ts`](../lib/telegram-webhook-auth.ts), constant-time comparison. |
| Idempotency (order/payment/admin action) | [`lib/idempotency.ts`](../lib/idempotency.ts) + tabel `IdempotencyKey` (unique `[scope, key]`). |
| Idempotency (webhook Midtrans) | `PaymentWebhookEvent.eventKey` (unique) — sudah ada sejak Milestone sebelumnya. |
| Idempotency (webhook Telegram) | [`lib/telegram-webhook-ledger.ts`](../lib/telegram-webhook-ledger.ts) + `TelegramWebhookEvent.updateId` (unique), sekarang mencakup semua tipe update, bukan hanya `chat_join_request`. |
| Request timeout outbound | [`lib/http-client.ts`](../lib/http-client.ts) (`fetchWithTimeout`), dipakai oleh `lib/midtrans.ts` dan `lib/telegram.ts`. |
| Retry terbatas | [`lib/retry.ts`](../lib/retry.ts) — exponential backoff + jitter, hanya untuk operasi yang aman diulang (lihat bagian 5). |
| Logging & PII masking | [`lib/logger.ts`](../lib/logger.ts) — redaksi rekursif, lihat bagian 7. |
| Error monitoring | [`lib/error-monitoring.ts`](../lib/error-monitoring.ts) — lihat bagian 6. |
| Privacy consent | [`lib/consent.ts`](../lib/consent.ts) + tabel `ConsentRecord` — lihat bagian 8. |
| Admin auth | [`lib/admin-auth.ts`](../lib/admin-auth.ts) — lihat bagian 9. |
| Audit log | [`lib/audit-log.ts`](../lib/audit-log.ts) + tabel `AdminAuditLog`. |

## 3. Rate limiting

[`lib/rate-limit.ts`](../lib/rate-limit.ts) menyediakan
`checkRateLimit({key, limit, windowMs})`, mengembalikan `allowed` +
`retryAfterSeconds`. Endpoint yang menolak melampaui limit membalas
`429` dengan header `Retry-After`, `X-RateLimit-Limit`,
`X-RateLimit-Remaining`.

Diterapkan pada: `POST /api/registrations`, `POST /api/payments`,
`POST /api/webhooks/midtrans`, `POST /api/webhooks/telegram`,
`POST /api/telegram/link`, `GET /api/telegram/link-status`,
`POST /api/telegram/channel-access`, `GET /api/telegram/channel-access`,
`GET /api/orders/[orderId]`, `GET /api/registrations` (admin), dan
`POST /api/admin/reconciliation`.

**Keterbatasan implementasi in-memory** (didokumentasikan juga sebagai
komentar di `lib/rate-limit.ts`): `InMemoryRateLimitStore` menyimpan
counter di memori satu proses. Ini akurat untuk satu instance/container
yang berjalan lama, tapi **tidak akurat lintas multiple
instance/serverless invocation** — tiap instance punya counter
sendiri, sehingga limit efektif menjadi `limit × jumlah instance`, dan
di lingkungan serverless murni (setiap request bisa dapat instance
baru) counter praktis nyaris tidak berguna.

**Migrasi ke shared store**: implementasikan interface
`RateLimitStore` (satu method: `increment(key, windowMs)`) terhadap
Redis (`INCR` + `PEXPIRE`, atau Lua script untuk atomicity), lalu
ganti instance yang dibuat di `getRateLimitStore()` pada
`lib/rate-limit.ts`. Tidak ada call site yang perlu berubah — semuanya
hanya bergantung pada `checkRateLimit`.

## 4. Payment reconciliation

Implementasi: [`lib/payment-reconciliation.ts`](../lib/payment-reconciliation.ts).

Alur: cari Order `PENDING` yang `updatedAt`-nya melewati
`RECONCILIATION_PENDING_AGE_MINUTES` → klaim tiap Order secara atomic
(`Order.reconciliationLockedAt`, conditional `updateMany`) → panggil
`GET /v2/{order_id}/status` Midtrans (timeout + retry bawaan
`lib/midtrans.ts`) → petakan & terapkan status lewat fungsi yang **sama
persis** dengan webhook (`lib/payment-status.ts` — satu sumber
kebenaran untuk mapping status dan guard anti-downgrade) → catat audit
event ke `AdminAuditLog` (tanpa PII/secret) → jika status akhir
termasuk kategori sensitif entitlement, panggil ulang
`reconcileTelegramAccessForOrder` (fungsi yang sama dengan webhook).
Kegagalan satu Order (`try/catch` per Order) tidak menghentikan Order
lain dalam batch yang sama.

**Lock overlapping run**: [`lib/job-lock.ts`](../lib/job-lock.ts)
menggunakan Postgres advisory lock (`pg_try_advisory_lock`) yang
dibungkus dalam satu `prisma.$transaction` — ini penting karena
`pg_advisory_lock`/`unlock` terikat ke *session* (koneksi fisik);
tanpa dibungkus transaction, lock dan unlock bisa jatuh di dua koneksi
pooled yang berbeda dan lock akan macet selamanya. Konsekuensinya: satu
koneksi pool dipegang selama durasi job (timeout diset besar,
`10 menit`, agar tidak terpotong di tengah batch besar) — dapat diterima
untuk background job yang jarang berjalan, tapi jangan tiru pola ini
untuk kode per-request.

### Menjalankan reconciliation secara manual (scheduled-job style)

```bash
npm run payments:reconcile
```

Aman dijalankan berulang kali (Order yang sudah tidak `PENDING` tidak
lagi jadi kandidat) dan aman dijalankan bersamaan dengan run lain
(yang kedua akan langsung berhenti dengan pesan "sudah ada proses lain
yang berjalan" berkat advisory lock).

### Menjalankan lewat admin action

```bash
curl -X POST https://your-app/api/admin/reconciliation \
  -H "Authorization: Bearer $ADMIN_API_SECRET" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{}'
```

Body opsional `{"maxOrders": 100}` untuk override batch size sekali
jalan. Dilindungi rate limit (`RATE_LIMITS.ADMIN_ACTION`), idempotency
key, dan audit log (`AdminAuditLog`, action
`PAYMENT_RECONCILIATION_TRIGGER`/`PAYMENT_RECONCILIATION_RUN`).

### Mengaktifkan scheduled reconciliation

Project ini **tidak** menambahkan infrastruktur cron sendiri (konsisten
dengan pendekatan `scripts/reconcile-telegram-access.ts` di Milestone
14). Pilih salah satu sesuai platform deploy:

- **Vercel Cron**: tambahkan `vercel.json` dengan `crons` yang
  memanggil endpoint terproteksi (buat route baru yang membaca header
  `Authorization: Bearer $CRON_SECRET` — Vercel Cron mengirim header
  ini secara otomatis jika dikonfigurasi) yang menjalankan
  `runPaymentReconciliation`. **Belum diimplementasikan di milestone
  ini** — lihat bagian 11 "Risiko/pekerjaan lanjutan".
- **Cron server sendiri / CI terjadwal**: jalankan
  `npm run payments:reconcile` langsung sesuai jadwal
  `RECONCILIATION_CRON` (dokumentasi saja, contoh: `*/15 * * * *`)
  dari server/CI yang punya akses aman ke `.env` production.

## 5. Retry & timeout outbound

`lib/http-client.ts` (`fetchWithTimeout`) membedakan timeout
(`HttpTimeoutError`) dari network error lain (`HttpNetworkError`).
`lib/retry.ts` (`withRetry`) hanya meng-retry ketika `isRetryable`
mengembalikan `true` — dikonfigurasi per klien:

- **Midtrans** (`lib/midtrans.ts`): `getMidtransTransactionStatus`
  (GET, read-only) di-retry. `createSnapTransaction` (POST, membuat
  transaksi baru) **tidak** di-retry otomatis di level klien — Midtrans
  tidak menjamin idempotency berbasis `order_id` di endpoint ini,
  sehingga retry buta setelah kegagalan ambigu (mis. timeout yang
  requestnya mungkin sudah diterima) berisiko terlihat seperti transaksi
  ganda. Perlindungan duplikasi untuk endpoint yang memanggilnya
  (`POST /api/payments`) datang dari `Idempotency-Key`, bukan dari retry
  di level Midtrans client.
- **Telegram** (`lib/telegram.ts`): default retryable, kecuali
  `sendMessage` (mengirim pesan dua kali ke user jika di-retry — sudah
  jadi keputusan desain sejak Milestone 12, lihat
  `docs/telegram-setup.md` §12) dan `createChatInviteLink` (membuat
  resource baru, bukan operasi idempotent).

Semua retry: exponential backoff + full jitter, dibatasi
`OUTBOUND_MAX_RETRIES`, menghormati `Retry-After` jika provider
mengirimkannya (429/503).

## 6. Error monitoring

[`lib/error-monitoring.ts`](../lib/error-monitoring.ts) — abstraction
provider-neutral. **Tidak ada SDK Sentry (atau sejenis) yang
diinstal** — menambahkan dependency + memilih provider adalah
keputusan produk (DSN, sampling, data residency) yang tidak diambil
sepihak di milestone ini. Yang tersedia:

- `NoopAdapter` (default) — aktif saat `ERROR_MONITORING_ENABLED`
  bukan `"true"` atau `ERROR_MONITORING_DSN` kosong. **Selalu no-op di
  local/test** kecuali diaktifkan eksplisit.
- `WebhookAdapter` — POST event JSON (sudah di-redact lewat
  `lib/logger.ts`'s `redact()`) ke `ERROR_MONITORING_DSN`, best-effort
  (fire-and-forget, tidak pernah melempar/menahan response).

`captureException(error, {operation, requestId, orderId, expected})`
dipanggil dari setiap route handler top-level catch, dari
`instrumentation.ts` (unhandled rejection/exception), dan dari
reconciliation per-Order failure yang tidak bisa dipulihkan.
`expected: true` menandai error operasional (validasi, business rule)
yang tidak perlu membangunkan siapa pun — dibedakan dari error yang
benar-benar tidak terduga.

**Mengintegrasikan Sentry (atau provider lain) nanti**: implementasikan
`ErrorMonitoringAdapter` (satu method: `captureException`) memakai SDK
pilihanmu, lalu ganti instance yang dibuat di `initErrorMonitoring()`.
Tidak ada call site `captureException` yang perlu berubah.

## 7. Logging & PII masking

[`lib/logger.ts`](../lib/logger.ts) mencetak satu baris JSON per log
(`timestamp`, `level`, `message`, `event`, `requestId`/`orderId`
opsional, `meta` yang sudah di-redact). `redact()` berjalan rekursif
(object/array bersarang, termasuk di dalam `Error.message`) dan
me-redact:

- Seluruh key yang cocok pola: `authorization`, `cookie`, `session`,
  `password`, `otp`, `token`, `secret`, `server_key`/`serverKey`,
  `client_key`/`clientKey`, `signature`, `api_key`, `name`, `email`,
  `phone`, `address`, `telegramUserId`, `telegramAccountId`,
  `inviteLink`, `customer`, `card`, `cvv`.
- Pola email yang tertanam di string bebas (mis. pesan error yang
  mengandung alamat email).

`chatId`/`chatType` pada log `my_chat_member` **sengaja tidak**
di-redact — itu adalah ID channel (bukan data pribadi individu) dan
dibutuhkan untuk setup awal, konsisten dengan keputusan Milestone 11
di `docs/telegram-setup.md` §4.

Setiap `console.error`/`console.log` lama yang berisiko (termasuk
`lib/midtrans.ts` yang sebelumnya mencetak seluruh response error
Midtrans — berpotensi memuat `customer_details` yang dikirim balik
oleh Midtrans di sebagian error) sudah diganti dengan `logger.*` yang
hanya mencetak field aman (status code, error name/code).

## 8. Privacy consent

Model `ConsentRecord` (append-only — setiap grant/revoke adalah baris
baru, bukan boolean tunggal) — lihat
[`lib/consent.ts`](../lib/consent.ts).

- Dicatat saat `POST /api/registrations` berhasil (`consentType:
  "privacy_policy"`, `consentVersion` dari
  `CURRENT_PRIVACY_POLICY_VERSION`, `source: "registration_form"`).
  Endpoint menolak (`400`) jika `privacyConsent !== true` pada body.
- Teks consent + link kebijakan privasi ditampilkan di
  [`RegistrationForm`](../app/components/registration-form.tsx) sebagai
  checkbox wajib sebelum submit.
- Halaman kebijakan privasi: [`/privasi`](../app/privasi/page.tsx) —
  mencakup jenis data yang diproses, tujuan, retensi, dan cara meminta
  penghapusan data.
- `hasActiveConsent(subjectType, subjectId, consentType, version?)`
  memeriksa baris terakhir untuk subject tersebut — status harus
  `GRANTED` (dan versi cocok, jika diminta).
- **Pencabutan**: `revokeConsent(...)` — belum ada endpoint publik
  untuk swadaya (self-service) di milestone ini; lihat bagian 11.

## 9. Admin authentication (keterbatasan yang disengaja)

Project ini **tidak punya sistem akun/role pengguna** sama sekali —
setiap endpoint lain bersifat publik atau capability-based (Order CUID
sebagai token akses, lihat `lib/order-access.ts`). Untuk aksi admin
yang ditambahkan di milestone ini (memicu reconciliation, melihat
daftar registrant), mekanisme sementara adalah satu shared bearer
secret `ADMIN_API_SECRET` (lihat
[`lib/admin-auth.ts`](../lib/admin-auth.ts)) — siapa pun yang
memegangnya diperlakukan sebagai "admin". Ini **cukup untuk satu
operator**, tapi harus diganti dengan autentikasi + role per-admin
sungguhan sebelum ada lebih dari satu operator atau sebelum
permukaan admin bertambah luas.

`GET /api/registrations` (mengembalikan nama/email/telepon seluruh
registrant, sebelumnya tanpa proteksi sama sekali) sekarang juga
memerlukan `ADMIN_API_SECRET` — endpoint ini tidak dipakai halaman mana
pun di codebase (`registration-form.tsx` hanya POST), jadi ini adalah
perbaikan keamanan murni, bukan perubahan perilaku yang terlihat
pengguna.

## 10. Menjalankan migration

```bash
npx prisma migrate deploy   # production/staging
npx prisma migrate dev      # local development (interaktif)
```

**Catatan penting untuk repo ini**: `prisma.config.ts` memuat `.env`
lewat `dotenv/config` — **bukan** `.env.local`. Next.js sendiri
memprioritaskan `.env.local` di atas `.env` saat runtime. Jika kedua
file berisi `DATABASE_URL` yang berbeda (seperti pada environment
development saat ini), migration yang dijalankan lewat
`npx prisma migrate dev`/`deploy` bisa mengenai database yang **berbeda**
dari yang benar-benar dipakai `npm run dev`. Selalu cek eksplisit
sebelum migrate:

```bash
# Terapkan ke database yang benar-benar dipakai runtime (.env.local):
env $(grep '^DATABASE_URL=' .env.local | xargs) npx prisma migrate deploy
```

Ini bukan masalah baru dari Milestone 15 — sudah ada sejak setup awal
project — tapi penting diketahui karena migration baru di milestone ini
(`IdempotencyKey`, `ConsentRecord`, `AdminAuditLog`,
`Order.reconciliationLockedAt`, index baru) harus diterapkan ke kedua
database jika kamu memakai keduanya.

## 11. Backup dan restore

Script: [`scripts/backup-db.sh`](../scripts/backup-db.sh) dan
[`scripts/restore-db.sh`](../scripts/restore-db.sh)
(`npm run db:backup` / `npm run db:restore`).

- **Cara backup**: `DATABASE_URL="..." npm run db:backup [output-dir]`
  — memakai `pg_dump --format=custom` (mendukung restore selektif).
  Set `BACKUP_ENCRYPTION_PASSPHRASE` untuk mengenkripsi hasil dump
  dengan `gpg --symmetric --cipher-algo AES256` — file mentah yang
  belum terenkripsi langsung dihapus (`shred`/`rm`) setelah
  terenkripsi.
- **Lokasi penyimpanan**: jangan simpan di direktori kerja repo lebih
  lama dari yang diperlukan (`backups/` sudah di-gitignore sebagai
  pengaman kedua, tapi jangan mengandalkan itu — pindahkan segera ke
  storage backup yang didedikasikan, terenkripsi, dan akses terbatas,
  mis. bucket privat dengan encryption-at-rest dan IAM terbatas ke tim
  operasi).
- **Enkripsi**: wajib untuk backup yang menyentuh production (lihat di
  atas). Simpan passphrase di secret manager, bukan di file/commit
  mana pun.
- **Retention policy**: rekomendasi — simpan backup harian selama 14
  hari, backup mingguan selama 3 bulan, hapus setelahnya. Sesuaikan
  dengan kebutuhan bisnis/regulasi.
- **Pembatasan akses**: hanya operator yang punya kebutuhan operasional
  langsung (on-call, DBA) yang memegang akses ke lokasi backup dan
  passphrase enkripsi.
- **Cara restore**: `DATABASE_URL="..." RESTORE_TARGET_ENV="local" npm run db:restore path/to/backup.dump[.gpg]`
  — meminta konfirmasi eksplisit (mengetik ulang nama environment),
  mendekripsi otomatis jika nama file berakhiran `.gpg`, restore ke
  `production` memerlukan flag `--allow-production` tambahan.
- **Verifikasi integritas backup**: setelah restore ke environment
  non-production, jalankan `npx prisma migrate status` (harus "up to
  date") dan spot-check jumlah baris tabel kunci (`Order`,
  `Registration`) dibanding sumber data terakhir yang diketahui.
- **Restore drill berkala**: lakukan restore penuh ke environment
  staging/lokal minimal setiap kuartal untuk memvalidasi backup benar-
  benar bisa dipulihkan, bukan hanya "berhasil dibuat".
- **RPO/RTO yang direkomendasikan**: RPO ≤ 24 jam (backup harian
  minimum; pertimbangkan lebih sering — mis. tiap 6 jam — jika volume
  transaksi tinggi), RTO ≤ 2 jam untuk restore ke environment yang
  sudah disiapkan (bukan termasuk waktu provisioning infrastruktur
  baru dari nol).
- **Sebelum restore**: ambil backup "titik aman" dari state saat ini
  (jaga-jaga), beri tahu tim bahwa aplikasi akan mengalami downtime
  singkat, dan pastikan tidak ada migration pending yang belum
  diterapkan ke backup yang akan direstore.
- **Setelah restore**: jalankan `prisma migrate deploy`, verifikasi
  integritas (lihat di atas), dan — khusus production — verifikasi
  ulang webhook Midtrans/Telegram masih terdaftar dengan benar (bisa
  saja restore membawa state lama yang berbeda dari konfigurasi
  webhook saat ini).
- **Larangan**: jangan pernah memasukkan file backup, dump, atau
  credential apa pun ke dalam repository — `backups/` sudah
  di-gitignore, tapi tetap periksa `git status` sebelum commit.

## 12. Testing

```bash
npm run test          # sekali jalan
npm run test:watch    # watch mode
```

Framework: Vitest ([`vitest.config.mts`](../vitest.config.mts)).
Sebagian besar test (`tests/idempotency.test.ts`,
`tests/consent.test.ts`, `tests/telegram-webhook-ledger.test.ts`,
`tests/payment-reconciliation.test.ts`) berjalan terhadap
`DATABASE_URL` yang sama dengan development lokal (dimuat dari
`.env.local` lewat `tests/setup.ts`) — bukan database produksi — dan
membersihkan data yang dibuatnya sendiri di `afterEach`. **Tidak ada
test yang memanggil Midtrans, Telegram, atau error monitoring
sungguhan** — semuanya di-mock lewat `vi.mock`.

## 13. Keputusan desain & keterbatasan penting

- **Rate limiting in-memory** — lihat bagian 3. Tidak akurat lintas
  multi-instance; abstraksi sudah siap untuk migrasi ke Redis.
- **Admin auth single shared secret** — lihat bagian 9. Cukup untuk
  satu operator, perlu diganti sebelum tim admin bertambah.
- **Retry Midtrans `createSnapTransaction` sengaja tidak otomatis** —
  lihat bagian 5. Perlindungan duplikasi datang dari
  `Idempotency-Key`, bukan retry.
- **`.env` vs `.env.local` DATABASE_URL berbeda** — lihat bagian 10.
  Bukan masalah baru, tapi berdampak langsung ke migration Milestone
  15.
- **Belum ada scheduled cron bawaan** — lihat bagian 4. Reconciliation
  bisa dipicu manual (`npm run payments:reconcile`) atau via admin
  endpoint; menyambungkannya ke scheduler (Vercel Cron/dll.) adalah
  langkah deploy-specific yang disengaja tidak diasumsikan di sini.
- **Error monitoring tanpa SDK provider sungguhan** — lihat bagian 6.
  Adapter generik siap pakai (webhook JSON), tapi belum terhubung ke
  Sentry/dll. karena itu keputusan yang butuh akun/DSN nyata.
- **Consent belum punya endpoint self-service untuk revoke** — lihat
  bagian 8 dan bagian "Risiko/pekerjaan lanjutan" di laporan akhir
  implementasi.
