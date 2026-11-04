#!/usr/bin/env bash
# ==============================================================================
# Script Backup & Restore PostgreSQL untuk PLN Ticketing
# Menggunakan pg_dump dan psql standar
# ==============================================================================
set -euo pipefail

BACKUP_DIR="/opt/pln-ticketing/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="${DB_NAME:-pln_ticketing_v12}"
DB_USER="${DB_USER:-ticketing_app}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

mkdir -p "$BACKUP_DIR"

usage() {
  echo "Penggunaan: $0 {backup|restore <file_backup.sql>}"
  exit 1
}

do_backup() {
  local target_file="$BACKUP_DIR/backup_${DB_NAME}_${TIMESTAMP}.sql"
  echo "[INFO] Memulai backup database $DB_NAME..."
  
  if [ -n "${DATABASE_URL:-}" ]; then
    pg_dump "$DATABASE_URL" --format=plain --no-owner --no-acl > "$target_file"
  else
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --format=plain --no-owner --no-acl > "$target_file"
  fi

  gzip "$target_file"
  echo "[OK] Backup berhasil: ${target_file}.gz ($(du -h "${target_file}.gz" | cut -f1))"
}

do_restore() {
  local backup_file="$1"
  if [ ! -f "$backup_file" ]; then
    echo "[ERROR] File backup tidak ditemukan: $backup_file"
    exit 1
  fi

  echo "[PERINGATAN] Anda akan me-restore database $DB_NAME dari file $backup_file"
  read -p "Lanjutkan? (ketik 'yes' untuk konfirmasi): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "[BATAL] Restore dibatalkan oleh user."
    exit 0
  fi

  echo "[INFO] Menjalankan restore..."
  if [[ "$backup_file" == *.gz ]]; then
    if [ -n "${DATABASE_URL:-}" ]; then
      gunzip -c "$backup_file" | psql "$DATABASE_URL"
    else
      gunzip -c "$backup_file" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
    fi
  else
    if [ -n "${DATABASE_URL:-}" ]; then
      psql "$DATABASE_URL" < "$backup_file"
    else
      psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$backup_file"
    fi
  fi
  echo "[OK] Restore selesai!"
}

case "${1:-}" in
  backup)
    do_backup
    ;;
  restore)
    if [ -z "${2:-}" ]; then
      echo "[ERROR] Sebutkan path file backup yang akan di-restore."
      usage
    fi
    do_restore "$2"
    ;;
  *)
    usage
    ;;
esac
