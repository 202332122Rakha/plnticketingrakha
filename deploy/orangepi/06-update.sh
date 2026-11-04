#!/bin/bash
set -e

# ==============================================================================
# 06-update.sh - Update aplikasi PLN Ticketing di Orange Pi
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
  echo "    Gunakan: sudo bash 06-update.sh"
  exit 1
fi

echo -e "\n${BLUE}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║   PLN Ticketing - Update Aplikasi                 ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════╝${NC}\n"

APP_DIR="/opt/pln-ticketing/app"
OPT_DIR="/opt/pln-ticketing"
ENV_FILE="${APP_DIR}/.env"
ENV_BACKUP="/opt/pln-ticketing/.env.backup"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

# --- 1. Stop services ---
print_step "Menghentikan services..."
systemctl stop pln-ticketing || print_warn "pln-ticketing tidak sedang berjalan."
systemctl stop pln-tunnel    || print_warn "pln-tunnel tidak sedang berjalan."
sleep 2
print_ok "Services dihentikan."

# --- 2. Backup .env ---
print_step "Backup file .env..."
if [[ -f "${ENV_FILE}" ]]; then
  cp "${ENV_FILE}" "${ENV_BACKUP}.${TIMESTAMP}"
  cp "${ENV_FILE}" "${ENV_BACKUP}"  # Juga simpan sebagai backup terbaru tanpa timestamp
  print_ok "Backup .env disimpan ke ${ENV_BACKUP}.${TIMESTAMP}"
else
  print_warn "File .env tidak ditemukan. Akan dibuat dari backup setelah update."
fi

# --- 3. Instruksi sync file baru ---
print_step "Sinkronisasi file baru"
echo ""
echo -e "  ${BOLD}Cara mengupload kode baru dari Windows (jalankan di PowerShell):${NC}"
echo ""
echo -e "  ${CYAN}# Menggunakan SCP (copy seluruh folder):${NC}"
echo -e "  ${YELLOW}scp -r C:\\path\\to\\PLN_Ticketing_PostgreSQL_Laragon\\* orangepi@<IP>:/opt/pln-ticketing/app/${NC}"
echo ""
echo -e "  ${CYAN}# Menggunakan rsync dari Linux/WSL (lebih efisien, hanya upload yang berubah):${NC}"
echo -e "  ${YELLOW}rsync -avz --exclude='node_modules' --exclude='.env' --exclude='*.log' \\"
echo -e "    ./PLN_Ticketing_PostgreSQL_Laragon/ orangepi@<IP>:/opt/pln-ticketing/app/${NC}"
echo ""

# Tunggu konfirmasi user bahwa file sudah diupload
read -p "  Apakah file baru sudah diupload ke ${APP_DIR}? [y/N]: " FILES_READY
if [[ "${FILES_READY}" != "y" && "${FILES_READY}" != "Y" ]]; then
  print_warn "Upload file dulu, kemudian jalankan ulang script ini."
  # Start services kembali agar tidak down terlalu lama
  print_step "Menjalankan ulang services dengan kode lama..."
  systemctl start pln-ticketing || true
  systemctl start pln-tunnel    || true
  exit 0
fi

# --- 4. Restore .env jika hilang setelah upload ---
print_step "Memverifikasi file .env..."
if [[ ! -f "${ENV_FILE}" ]]; then
  if [[ -f "${ENV_BACKUP}" ]]; then
    cp "${ENV_BACKUP}" "${ENV_FILE}"
    chmod 600 "${ENV_FILE}"
    print_ok ".env dipulihkan dari backup."
  else
    print_err "File .env hilang dan tidak ada backup! Buat ulang dengan script 03-deploy-backend.sh"
    exit 1
  fi
else
  print_ok "File .env ada."
fi

# --- 5. npm install ---
print_step "Menginstall dependencies (npm install --omit=dev)..."
cd "${APP_DIR}"
npm install --omit=dev
print_ok "npm install selesai."

# --- 6. npm run db:migrate (idempotent) ---
print_step "Menjalankan database migration (idempotent)..."
if npm run db:migrate; then
  print_ok "Migration selesai."
else
  print_warn "Migration gagal atau tidak ada perubahan schema. Melanjutkan..."
fi

# --- 7. Atur kepemilikan file ---
print_step "Mengatur kepemilikan file..."
chown -R ticketing:ticketing "${OPT_DIR}"
chmod 600 "${ENV_FILE}"
print_ok "Kepemilikan file diatur."

# --- 8. Start services ---
print_step "Menjalankan ulang services..."
systemctl start pln-ticketing
sleep 3
systemctl start pln-tunnel

# --- 9. Print status ---
print_step "Status services:"
echo ""

if systemctl is-active --quiet pln-ticketing; then
  echo -e "  ${GREEN}✔${NC}  pln-ticketing : ${GREEN}AKTIF${NC}"
else
  echo -e "  ${RED}✘${NC}  pln-ticketing : ${RED}GAGAL${NC}"
  echo -e "       Cek log: ${CYAN}journalctl -u pln-ticketing -n 30 --no-pager${NC}"
fi

if systemctl is-active --quiet pln-tunnel; then
  echo -e "  ${GREEN}✔${NC}  pln-tunnel    : ${GREEN}AKTIF${NC}"
else
  echo -e "  ${YELLOW}⚠${NC}  pln-tunnel    : masih memulai..."
fi

echo ""
echo -e "  ${YELLOW}⚠  PENTING: Quick Tunnel mendapat URL baru setelah restart!${NC}"
echo -e "     Tunggu 30 detik, lalu jalankan: ${CYAN}bash 05-get-tunnel-url.sh${NC}"
echo -e "     Kemudian update VITE_API_BASE_URL di Cloudflare Pages."
echo ""
echo -e "${GREEN}${BOLD}✔ Update selesai!${NC}"
echo -e "  Waktu: $(date '+%Y-%m-%d %H:%M:%S')\n"
