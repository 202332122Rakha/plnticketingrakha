#!/bin/bash
set -e

# ==============================================================================
# 03-deploy-backend.sh - Deploy backend PLN Ticketing ke Orange Pi
# ==============================================================================

# --- Warna Output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_step() { echo -e "\n${CYAN}${BOLD}==>${NC} ${BOLD}$1${NC}"; }
print_ok()   { echo -e "  ${GREEN}✔${NC}  $1"; }
print_warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
print_err()  { echo -e "  ${RED}✘${NC}  $1"; }
print_info() { echo -e "  ${BLUE}ℹ${NC}  $1"; }

# --- Cek Root ---
if [[ "$EUID" -ne 0 ]]; then
  print_err "Script ini harus dijalankan sebagai root."
  echo "    Gunakan: sudo bash 03-deploy-backend.sh"
  exit 1
fi

echo -e "\n${BLUE}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║   PLN Ticketing - Deploy Backend                  ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════╝${NC}\n"

APP_DIR="/opt/pln-ticketing/app"
OPT_DIR="/opt/pln-ticketing"
PASSWORD_FILE="${OPT_DIR}/.db-password"
ENV_FILE="${APP_DIR}/.env"
DB_USER="ticketing_app"
DB_NAME="pln_ticketing"

# --- Instruksi copy file ---
print_step "Persiapan: Copy folder project ke Orange Pi"
echo ""
echo -e "  ${BOLD}Sebelum melanjutkan, pastikan folder project sudah ada di:${NC}"
echo -e "  ${YELLOW}${APP_DIR}${NC}"
echo ""
echo -e "  ${BOLD}Cara copy dari Windows (jalankan di PowerShell/CMD):${NC}"
echo -e "  ${CYAN}scp -r C:\\path\\to\\PLN_Ticketing_PostgreSQL_Laragon orangepi@<IP_ORANGEPI>:/opt/pln-ticketing/app${NC}"
echo ""
echo -e "  ${BOLD}Atau gunakan rsync dari Linux/Mac:${NC}"
echo -e "  ${CYAN}rsync -avz --exclude='node_modules' --exclude='.env' ./PLN_Ticketing_PostgreSQL_Laragon/ orangepi@<IP_ORANGEPI>:/opt/pln-ticketing/app/${NC}"
echo ""

# Cek apakah folder app sudah ada dan tidak kosong
if [[ ! -d "${APP_DIR}" ]] || [[ -z "$(ls -A ${APP_DIR} 2>/dev/null)" ]]; then
  print_err "Folder ${APP_DIR} kosong atau tidak ada!"
  echo ""
  echo -e "  ${YELLOW}Copy dulu project ke ${APP_DIR}, kemudian jalankan ulang script ini.${NC}"
  echo ""
  # Tanya apakah ingin lanjut meski folder kosong (untuk testing)
  read -p "  Lanjutkan meski folder kosong? (hanya untuk testing) [y/N]: " FORCE_CONTINUE
  if [[ "${FORCE_CONTINUE}" != "y" && "${FORCE_CONTINUE}" != "Y" ]]; then
    exit 1
  fi
fi

# --- Cek file password DB ---
print_step "Membaca password database..."
if [[ ! -f "${PASSWORD_FILE}" ]]; then
  print_err "File password database tidak ditemukan: ${PASSWORD_FILE}"
  echo "  Jalankan dulu: sudo bash 02-database.sh"
  exit 1
fi
DB_PASSWORD=$(cat "${PASSWORD_FILE}")
print_ok "Password database berhasil dibaca."

# --- Generate SESSION_SECRET ---
print_step "Membuat SESSION_SECRET (64 karakter random)..."
SESSION_SECRET=$(tr -dc 'A-Za-z0-9!@#%^&*()-_=+' </dev/urandom | head -c 64)
print_ok "SESSION_SECRET berhasil dibuat."

# --- Generate file .env ---
print_step "Membuat file .env di ${ENV_FILE}..."

# Backup .env lama jika ada
if [[ -f "${ENV_FILE}" ]]; then
  BACKUP_FILE="${ENV_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
  cp "${ENV_FILE}" "${BACKUP_FILE}"
  print_warn "Backup .env lama ke: ${BACKUP_FILE}"
fi

cat > "${ENV_FILE}" <<EOF
# ============================================================
# PLN Ticketing - Konfigurasi Backend (Production)
# Dibuat otomatis oleh 03-deploy-backend.sh
# Tanggal: $(date '+%Y-%m-%d %H:%M:%S')
# ============================================================

# Server
HOST=127.0.0.1
PORT=4000
NODE_ENV=production

# Database PostgreSQL
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_SSL=false

# Session
SESSION_SECRET=${SESSION_SECRET}

# Frontend URL (update setelah mendapat URL Cloudflare Pages)
CLIENT_URL=https://PLACEHOLDER_CLOUDFLARE_PAGES_URL
EOF

chmod 600 "${ENV_FILE}"
print_ok "File .env berhasil dibuat di ${ENV_FILE}"

# --- npm install ---
print_step "Menginstall dependencies Node.js (production only)..."
cd "${APP_DIR}"
npm install --omit=dev
print_ok "npm install selesai."

# --- npm run db:migrate ---
print_step "Menjalankan database migration..."
if npm run db:migrate; then
  print_ok "Database migration berhasil."
else
  print_warn "Migration gagal atau tidak ada script migrate. Periksa package.json."
fi

# --- npm run db:seed ---
print_step "Menjalankan database seed (data awal)..."
if npm run db:seed; then
  print_ok "Database seed berhasil."
else
  print_warn "Seed gagal atau tidak ada script seed. Mungkin data sudah ada."
fi

# --- Chown semua ke user ticketing ---
print_step "Mengatur kepemilikan file ke user 'ticketing'..."
chown -R ticketing:ticketing "${OPT_DIR}"
# .env tetap hanya bisa dibaca oleh pemilik
chmod 600 "${ENV_FILE}"
print_ok "Kepemilikan file diatur."

echo ""
echo -e "${GREEN}${BOLD}✔ Deploy backend selesai!${NC}"
echo ""
echo -e "  ${BOLD}Langkah berikutnya:${NC}"
echo -e "    1. Jalankan: ${YELLOW}sudo bash 04-services.sh${NC}"
echo -e "    2. Setelah tunnel aktif, catat URL tunnel dari script ${YELLOW}bash 05-get-tunnel-url.sh${NC}"
echo -e "    3. Update ${BOLD}CLIENT_URL${NC} di ${ENV_FILE} dengan URL Cloudflare Pages Anda:"
echo -e "       ${CYAN}sudo nano ${ENV_FILE}${NC}"
echo -e "    4. Restart service: ${CYAN}sudo systemctl restart pln-ticketing${NC}"
echo ""
echo -e "  ${YELLOW}⚠  Ingat untuk update CLIENT_URL di .env setelah Cloudflare Pages deploy!${NC}\n"
