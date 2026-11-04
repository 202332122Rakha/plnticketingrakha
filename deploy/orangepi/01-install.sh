#!/bin/bash
set -e

# ==============================================================================
# 01-install.sh - Install semua dependencies di Orange Pi (ARM64)
# PLN Ticketing System - Deployment Script
# ==============================================================================

# --- Warna Output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

print_step() { echo -e "\n${CYAN}${BOLD}==>${NC} ${BOLD}$1${NC}"; }
print_ok()   { echo -e "  ${GREEN}✔${NC}  $1"; }
print_warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
print_err()  { echo -e "  ${RED}✘${NC}  $1"; }

# --- Cek Root ---
if [[ "$EUID" -ne 0 ]]; then
  print_err "Script ini harus dijalankan sebagai root."
  echo "    Gunakan: sudo bash 01-install.sh"
  exit 1
fi

echo -e "\n${BLUE}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║   PLN Ticketing - Orange Pi Installer (ARM64)    ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════╝${NC}\n"

# --- 1. Update APT ---
print_step "Memperbarui daftar paket APT..."
apt-get update -y
apt-get upgrade -y
print_ok "APT diperbarui."

# --- 2. Install dependencies dasar ---
print_step "Menginstall dependencies dasar..."
apt-get install -y curl wget gnupg2 ca-certificates lsb-release \
  apt-transport-https software-properties-common \
  build-essential git unzip jq
print_ok "Dependencies dasar terinstall."

# --- 3. Install Node.js 22.x via NodeSource ---
print_step "Menginstall Node.js 22.x via NodeSource..."
if command -v node &>/dev/null && [[ "$(node -v)" == v22* ]]; then
  print_warn "Node.js 22.x sudah terinstall: $(node -v). Melewati."
else
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  print_ok "Node.js terinstall: $(node -v)"
fi

# --- 4. Install PostgreSQL 16 ---
print_step "Menginstall PostgreSQL 16..."
if command -v psql &>/dev/null; then
  print_warn "PostgreSQL sudah terinstall: $(psql --version). Melewati."
else
  # Coba install dari postgresql.org
  DISTRO=$(lsb_release -cs 2>/dev/null || echo "jammy")
  ARCH=$(dpkg --print-architecture)

  # Tambahkan repo postgresql.org
  if ! grep -q "apt.postgresql.org" /etc/apt/sources.list.d/pgdg.list 2>/dev/null; then
    echo "deb [arch=${ARCH}] https://apt.postgresql.org/pub/repos/apt ${DISTRO}-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
    apt-get update -y
  fi

  # Install PostgreSQL 16 (fallback ke versi tersedia jika 16 gagal)
  if apt-get install -y postgresql-16 postgresql-client-16 2>/dev/null; then
    print_ok "PostgreSQL 16 terinstall."
  else
    print_warn "PostgreSQL 16 tidak tersedia di repo, mencoba versi terbaru..."
    apt-get install -y postgresql postgresql-client
    print_ok "PostgreSQL terinstall: $(psql --version)"
  fi
fi

# Pastikan PostgreSQL berjalan
systemctl enable postgresql
systemctl start postgresql
print_ok "PostgreSQL service aktif."

# --- 5. Install cloudflared ARM64 ---
print_step "Menginstall cloudflared (ARM64)..."
if command -v cloudflared &>/dev/null; then
  print_warn "cloudflared sudah terinstall: $(cloudflared --version). Melewati."
else
  CLOUDFLARED_URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
  wget -q --show-progress -O /usr/local/bin/cloudflared "${CLOUDFLARED_URL}"
  chmod +x /usr/local/bin/cloudflared
  # Buat symlink agar ada di /usr/bin juga
  ln -sf /usr/local/bin/cloudflared /usr/bin/cloudflared 2>/dev/null || true
  print_ok "cloudflared terinstall: $(cloudflared --version)"
fi

# --- 6. Buat user system 'ticketing' ---
print_step "Membuat user sistem 'ticketing'..."
if id "ticketing" &>/dev/null; then
  print_warn "User 'ticketing' sudah ada. Melewati."
else
  useradd -r -m -s /bin/bash ticketing
  print_ok "User 'ticketing' berhasil dibuat."
fi

# --- 7. Buat direktori /opt/pln-ticketing ---
print_step "Membuat direktori /opt/pln-ticketing..."
mkdir -p /opt/pln-ticketing/app
chown -R ticketing:ticketing /opt/pln-ticketing
chmod 750 /opt/pln-ticketing
print_ok "Direktori /opt/pln-ticketing siap."

# --- 8. Print versi yang terinstall ---
print_step "Versi yang terinstall:"
echo ""
echo -e "  ${BOLD}Node.js :${NC} $(node -v)"
echo -e "  ${BOLD}npm     :${NC} $(npm -v)"
echo -e "  ${BOLD}psql    :${NC} $(psql --version)"
echo -e "  ${BOLD}cloudflared:${NC} $(cloudflared --version 2>&1 | head -1)"
echo ""

echo -e "${GREEN}${BOLD}✔ Instalasi selesai!${NC}"
echo -e "  Lanjutkan dengan: ${YELLOW}sudo bash 02-database.sh${NC}\n"
