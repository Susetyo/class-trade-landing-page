#!/usr/bin/env bash
#
# Restores a Postgres backup created by scripts/backup-db.sh. Requires
# explicit confirmation and an explicit target-environment declaration
# to make an accidental production restore hard to trigger by mistake.
# See docs/security-reliability.md "Backup dan restore" for the full
# runbook, including the pre/post-restore checklist and restore-drill
# cadence.
#
# Usage:
#   DATABASE_URL="postgresql://..." \
#   RESTORE_TARGET_ENV="local" \
#     ./scripts/restore-db.sh path/to/backup.dump[.gpg]
#
# RESTORE_TARGET_ENV must be "local" or "staging". Restoring into
# "production" requires the extra --allow-production flag AND typing
# the literal word "production" at the interactive confirmation
# prompt — this script refuses to proceed non-interactively for a
# production target.

set -euo pipefail

BACKUP_FILE="${1:-}"
ALLOW_PRODUCTION=false

for arg in "$@"; do
    if [[ "$arg" == "--allow-production" ]]; then
        ALLOW_PRODUCTION=true
    fi
done

if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
    echo "Error: berikan path file backup yang valid sebagai argumen pertama." >&2
    exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "Error: DATABASE_URL wajib diset (target restore)." >&2
    exit 1
fi

if [[ -z "${RESTORE_TARGET_ENV:-}" ]]; then
    echo "Error: RESTORE_TARGET_ENV wajib diset ke 'local', 'staging', atau 'production'." >&2
    exit 1
fi

if [[ "$RESTORE_TARGET_ENV" != "local" && "$RESTORE_TARGET_ENV" != "staging" && "$RESTORE_TARGET_ENV" != "production" ]]; then
    echo "Error: RESTORE_TARGET_ENV harus 'local', 'staging', atau 'production'." >&2
    exit 1
fi

if [[ "$RESTORE_TARGET_ENV" == "production" && "$ALLOW_PRODUCTION" != "true" ]]; then
    echo "Error: restore ke production memerlukan flag --allow-production secara eksplisit." >&2
    exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
    echo "Error: pg_restore tidak ditemukan di PATH." >&2
    exit 1
fi

echo "=== KONFIRMASI RESTORE ==="
echo "Target environment : ${RESTORE_TARGET_ENV}"
echo "Backup file         : ${BACKUP_FILE}"
echo "DATABASE_URL host   : $(echo "$DATABASE_URL" | sed -E 's#.*://[^@]*@#<redacted>@#' | sed -E 's#\?.*##')"
echo ""
echo "Tindakan ini akan MENIMPA data pada database target di atas."
echo "Ketik nama environment target ('${RESTORE_TARGET_ENV}') untuk melanjutkan:"
read -r CONFIRMATION

if [[ "$CONFIRMATION" != "$RESTORE_TARGET_ENV" ]]; then
    echo "Konfirmasi tidak cocok. Restore dibatalkan." >&2
    exit 1
fi

WORKING_FILE="$BACKUP_FILE"
CLEANUP_DECRYPTED=false

if [[ "$BACKUP_FILE" == *.gpg ]]; then
    if ! command -v gpg >/dev/null 2>&1; then
        echo "Error: gpg tidak ditemukan, tidak bisa mendekripsi backup." >&2
        exit 1
    fi

    echo "Backup terenkripsi terdeteksi — masukkan passphrase saat diminta."
    WORKING_FILE="$(mktemp)"
    gpg --batch --yes --decrypt --output "$WORKING_FILE" "$BACKUP_FILE"
    CLEANUP_DECRYPTED=true
fi

echo "Memulai restore ke ${RESTORE_TARGET_ENV}..."
pg_restore --clean --if-exists --no-owner --no-privileges \
    --dbname="${DATABASE_URL}" "${WORKING_FILE}"

if [[ "$CLEANUP_DECRYPTED" == "true" ]]; then
    shred -u "$WORKING_FILE" 2>/dev/null || rm -f "$WORKING_FILE"
fi

echo "Restore selesai."
echo "Langkah setelah restore (wajib, lihat docs/security-reliability.md):"
echo "  1. Jalankan 'npx prisma migrate deploy' untuk memastikan schema sinkron."
echo "  2. Verifikasi integritas data (jumlah baris tabel kunci, spot-check beberapa Order/Registration)."
echo "  3. Jika target adalah production: verifikasi webhook Midtrans/Telegram masih terkonfigurasi benar."
