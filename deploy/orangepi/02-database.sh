#!/bin/bash
set -e

# ==============================================================================
# 02-database.sh - Setup PostgreSQL untuk PLN Ticketing
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

# --- Cek Root ---
if [[ "$EUID" -ne 0 ]]; then
  print_err "Script ini harus dijalankan sebagai root."
  echo "    Gunakan: sudo bash 02-database.sh"
  exit 1
fi

echo -e "\n${BLUE}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║   PLN Ticketing - Setup Database PostgreSQL       ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════╝${NC}\n"

DB_USER="ticketing_app"
DB_NAME="pln_ticketing"
PASSWORD_FILE="/opt/pln-ticketing/.db-password"
OPT_DIR="/opt/pln-ticketing"

# --- Pastikan PostgreSQL berjalan ---
print_step "Memastikan PostgreSQL berjalan..."
if ! systemctl is-active --quiet postgresql; then
  systemctl start postgresql
  sleep 2
fi
print_ok "PostgreSQL aktif."

# --- Generate password random 32 karakter ---
print_step "Membuat password database random (32 karakter)..."
if [[ -f "${PASSWORD_FILE}" ]]; then
  print_warn "File password sudah ada di ${PASSWORD_FILE}."
  DB_PASSWORD=$(cat "${PASSWORD_FILE}")
  print_warn "Menggunakan password yang sudah ada."
else
  DB_PASSWORD=$(tr -dc 'A-Za-z0-9!@#%^&*()-_=+' </dev/urandom | head -c 32)
  mkdir -p "${OPT_DIR}"
  echo "${DB_PASSWORD}" > "${PASSWORD_FILE}"
  chmod 600 "${PASSWORD_FILE}"
  chown ticketing:ticketing "${PASSWORD_FILE}" 2>/dev/null || chown root:root "${PASSWORD_FILE}"
  print_ok "Password disimpan ke ${PASSWORD_FILE}"
fi

# --- Buat user PostgreSQL 'ticketing_app' ---
print_step "Membuat user PostgreSQL '${DB_USER}'..."
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  print_warn "User PostgreSQL '${DB_USER}' sudah ada."
  # Update password agar sinkron dengan file
  sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" \
    && print_ok "Password user '${DB_USER}' diperbarui."
else
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
  print_ok "User '${DB_USER}' berhasil dibuat."
fi

# --- Buat database 'pln_ticketing' ---
print_step "Membuat database '${DB_NAME}'..."
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  print_warn "Database '${DB_NAME}' sudah ada. Melewati pembuatan."
else
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER} ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8' TEMPLATE template0;" \
    || sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
  print_ok "Database '${DB_NAME}' berhasil dibuat."
fi

# --- Berikan privileges ---
print_step "Memberikan privileges..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" 2>/dev/null || true
print_ok "Privileges diberikan."

# --- Verifikasi koneksi ---
print_step "Memverifikasi koneksi database..."
if PGPASSWORD="${DB_PASSWORD}" psql -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" -c '\q' 2>/dev/null; then
  print_ok "Koneksi database berhasil diverifikasi."
else
  print_warn "Tidak bisa verifikasi koneksi langsung. Pastikan pg_hba.conf mengizinkan koneksi md5/scram."
  # Patch pg_hba.conf untuk izinkan koneksi lokal dengan password
  PG_HBA=$(sudo -u postgres psql -tAc "SHOW hba_file;" 2>/dev/null)
  if [[ -n "${PG_HBA}" ]] && [[ -f "${PG_HBA}" ]]; then
    # Tambahkan aturan di awal file hba
    if ! grep -q "${DB_USER}" "${PG_HBA}"; then
      sed -i "1s;^;# PLN Ticketing\nhost    ${DB_NAME}    ${DB_USER}    127.0.0.1/32    scram-sha-256\n;" "${PG_HBA}"
      systemctl reload postgresql
      print_ok "pg_hba.conf diperbarui dan PostgreSQL di-reload."
    fi
  fi
fi

echo ""
echo -e "${GREEN}${BOLD}✔ Setup database selesai!${NC}"
echo ""
echo -e "  ${BOLD}Detail Database:${NC}"
echo -e "    Host     : 127.0.0.1"
echo -e "    Port     : 5432"
echo -e "    Database : ${DB_NAME}"
echo -e "    User     : ${DB_USER}"
echo -e "    Password : ${YELLOW}(tersimpan di ${PASSWORD_FILE})${NC}"
echo ""
echo -e "  ${BOLD}Langkah berikutnya:${NC}"
echo -e "    1. Copy folder project ke Orange Pi (lihat README-ORANGEPI.md)"
echo -e "    2. Jalankan: ${YELLOW}sudo bash 03-deploy-backend.sh${NC}"
echo ""
echo -e "  ${YELLOW}⚠  JANGAN bagikan file ${PASSWORD_FILE} ke siapapun!${NC}\n"
