#!/usr/bin/env bash
# ==============================================================================
# SCRIPT RESET TOTAL & BUILD ULANG DATABASE DI SERVER LINUX / ORANGE PI
# ==============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${RED}===============================================================${NC}"
echo -e "${RED}       PERINGATAN: RESET TOTAL DATABASE PLN TICKETING          ${NC}"
echo -e "${RED}===============================================================${NC}"
echo -e "Tindakan ini akan menghapus database ${YELLOW}pln_ticketing_v12${NC},"
echo -e "membuat ulang skema dari nol, mengisikan 11 Unit UPDL & CorpU,"
echo -e "dan membuat akun admin yang baru."
echo ""

read -p "Ketik 'HAPUS' (huruf besar) untuk melanjutkan: " CONFIRM
if [ "$CONFIRM" != "HAPUS" ]; then
    echo -e "${GREEN}[BATAL] Proses reset dibatalkan.${NC}"
    exit 0
fi

# 1. Stop service backend sementara agar koneksi ke database tertutup
echo -e "\n${YELLOW}[1/5] Menghentikan service pln-ticketing-v12...${NC}"
sudo systemctl stop pln-ticketing-v12 || true

# 2. Reset database via PostgreSQL psql
echo -e "\n${YELLOW}[2/5] Menghapus dan membuat ulang database...${NC}"
DB_NAME="pln_ticketing_v12"
DB_USER="ticketing_app"

sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" || true
sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${DB_NAME};"
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER} ENCODING 'UTF8';"

echo -e "${GREEN}[OK] Database ${DB_NAME} berhasil dibuat ulang bersih.${NC}"

# 3. Jalankan Migrasi Skema
APP_DIR="/opt/pln-ticketing/app"
if [ ! -d "$APP_DIR" ]; then
    APP_DIR="$(pwd)"
fi

cd "$APP_DIR"

echo -e "\n${YELLOW}[3/5] Menjalankan migrasi tabel skema...${NC}"
npm run db:migrate

echo -e "\n${YELLOW}[4/5] Memasukkan master data resmi (UPDL, Kategori, SLA)...${NC}"
npm run db:seed

# 4. Buat Akun Admin Baru
echo -e "\n${CYAN}--- Buat Akun Administrator Baru ---${NC}"
read -p "Masukkan Email Admin (contoh: admin@corpu.pln.co.id): " ADMIN_EMAIL
read -s -p "Masukkan Password Admin (minimal 8 karakter): " ADMIN_PASS
echo ""

if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASS" ]; then
    INITIAL_ADMIN_EMAIL="$ADMIN_EMAIL" \
    INITIAL_ADMIN_PASSWORD="$ADMIN_PASS" \
    INITIAL_ADMIN_USERNAME="admin" \
    INITIAL_ADMIN_NAME="Administrator Ticketing" \
    INITIAL_ADMIN_UNIT="PLN_CORPU" \
    node server/create-admin.js
fi

# 5. Build Frontend dan Nyalakan Service
echo -e "\n${YELLOW}[5/5] Membangun frontend dan menyalakan kembali service...${NC}"
npm run build
sudo systemctl start pln-ticketing-v12
sudo systemctl status pln-ticketing-v12 --no-pager

echo -e "\n${GREEN}===============================================================${NC}"
echo -e "${GREEN}[SELESAI] Database dan Backend berhasil di-build ulang bersih!${NC}"
echo -e "${GREEN}===============================================================${NC}"

