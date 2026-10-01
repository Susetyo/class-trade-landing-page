#!/usr/bin/env bash
#
# Creates a Postgres backup using pg_dump's custom format (compressed,
# supports selective restore). See docs/security-reliability.md
# "Backup dan restore" for the full runbook: storage location,
# encryption, retention, and access policy.
#
# Usage:
#   DATABASE_URL="postgresql://..." ./scripts/backup-db.sh [output-dir]
#
# Optional: set BACKUP_ENCRYPTION_PASSPHRASE to encrypt the dump with
# gpg (AES256 symmetric) immediately after creating it.
#
# Never commit the resulting .dump/.dump.gpg file to the repository —
# backups/ is gitignored for exactly this reason.

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "Error: DATABASE_URL wajib diset (jangan hardcode di script ini)." >&2
    exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
    echo "Error: pg_dump tidak ditemukan di PATH." >&2
    exit 1
fi

OUTPUT_DIR="${1:-backups}"
mkdir -p "$OUTPUT_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_FILE="${OUTPUT_DIR}/backup-${TIMESTAMP}.dump"

echo "Membuat backup ke: ${DUMP_FILE}"
pg_dump --format=custom --no-owner --no-privileges --file="${DUMP_FILE}" "${DATABASE_URL}"

if [[ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]]; then
    if ! command -v gpg >/dev/null 2>&1; then
        echo "Error: gpg tidak ditemukan, tidak bisa mengenkripsi backup." >&2
        exit 1
    fi

    ENCRYPTED_FILE="${DUMP_FILE}.gpg"
    echo "Mengenkripsi backup ke: ${ENCRYPTED_FILE}"
    gpg --batch --yes --passphrase "${BACKUP_ENCRYPTION_PASSPHRASE}" \
        --symmetric --cipher-algo AES256 --output "${ENCRYPTED_FILE}" "${DUMP_FILE}"

    shred -u "${DUMP_FILE}" 2>/dev/null || rm -f "${DUMP_FILE}"
    echo "Backup terenkripsi selesai: ${ENCRYPTED_FILE}"
else
    echo "Peringatan: BACKUP_ENCRYPTION_PASSPHRASE tidak diset — backup TIDAK terenkripsi."
    echo "Backup selesai (tidak terenkripsi): ${DUMP_FILE}"
fi

echo "Pindahkan file ini ke penyimpanan backup yang aman (lihat docs/security-reliability.md) — jangan biarkan di direktori kerja lebih lama dari yang diperlukan."
