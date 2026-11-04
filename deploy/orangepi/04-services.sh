#!/bin/bash
set -e

# ==============================================================================
# 04-services.sh - Setup systemd services untuk PLN Ticketing
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
  echo "    Gunakan: sudo bash 04-services.sh"
  exit 1
fi

echo -e "\n${BLUE}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║   PLN Ticketing - Setup Systemd Services          ║${NC}"
echo -e "${BLUE}${BOLD}╚══════════════════════════════════════════════════╝${NC}\n"

OPT_DIR="/opt/pln-ticketing"
APP_DIR="${OPT_DIR}/app"
CLOUDFLARED_BIN="/usr/bin/cloudflared"

# Cek apakah cloudflared ada
if [[ ! -x "${CLOUDFLARED_BIN}" ]]; then
  if [[ -x "/usr/local/bin/cloudflared" ]]; then
    CLOUDFLARED_BIN="/usr/local/bin/cloudflared"
  else
    print_err "cloudflared tidak ditemukan. Jalankan dulu: sudo bash 01-install.sh"
    exit 1
  fi
fi

# Cek apakah node.js ada
NODE_BIN=$(command -v node 2>/dev/null || echo "/usr/bin/node")
if [[ ! -x "${NODE_BIN}" ]]; then
  print_err "node tidak ditemukan. Jalankan dulu: sudo bash 01-install.sh"
  exit 1
fi

# --- 1. Buat pln-ticketing.service ---
print_step "Membuat /etc/systemd/system/pln-ticketing.service..."

cat > /etc/systemd/system/pln-ticketing.service <<EOF
[Unit]
Description=PLN Ticketing PostgreSQL API
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=ticketing
Group=ticketing
WorkingDirectory=${APP_DIR}
ExecStart=${NODE_BIN} server/index.js
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true
UMask=0077
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pln-ticketing

[Install]
WantedBy=multi-user.target
EOF

print_ok "pln-ticketing.service dibuat."

# --- 2. Buat script start-tunnel.sh ---
print_step "Membuat ${OPT_DIR}/start-tunnel.sh..."

cat > "${OPT_DIR}/start-tunnel.sh" <<'TUNNEL_SCRIPT'
#!/bin/bash
# start-tunnel.sh - Jalankan cloudflared tunnel dan capture URL-nya
set -e

OPT_DIR="/opt/pln-ticketing"
LOG_FILE="${OPT_DIR}/tunnel.log"
URL_FILE="${OPT_DIR}/tunnel-url.txt"
CLOUDFLARED_BIN=$(command -v cloudflared 2>/dev/null || echo "/usr/local/bin/cloudflared")

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Memulai Cloudflare Quick Tunnel..." >> "${LOG_FILE}"

# Jalankan cloudflared dan tee output ke log
"${CLOUDFLARED_BIN}" tunnel --url http://localhost:4000 2>&1 | tee -a "${LOG_FILE}" | \
  while IFS= read -r line; do
    # Cari URL tunnel dari output cloudflared
    if echo "${line}" | grep -qoP 'https://[a-z0-9-]+\.trycloudflare\.com'; then
      URL=$(echo "${line}" | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com')
      echo "${URL}" > "${URL_FILE}"
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Tunnel URL: ${URL}" >> "${LOG_FILE}"
    fi
  done
TUNNEL_SCRIPT

chmod +x "${OPT_DIR}/start-tunnel.sh"
chown ticketing:ticketing "${OPT_DIR}/start-tunnel.sh"
print_ok "start-tunnel.sh dibuat."

# --- 3. Buat pln-tunnel.service ---
print_step "Membuat /etc/systemd/system/pln-tunnel.service..."

cat > /etc/systemd/system/pln-tunnel.service <<EOF
[Unit]
Description=PLN Ticketing Cloudflare Quick Tunnel
After=network-online.target pln-ticketing.service
Wants=network-online.target
After=pln-ticketing.service

[Service]
Type=simple
User=ticketing
WorkingDirectory=${OPT_DIR}
ExecStart=${CLOUDFLARED_BIN} tunnel --url http://localhost:4000 --logfile ${OPT_DIR}/tunnel.log
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pln-tunnel

[Install]
WantedBy=multi-user.target
EOF

print_ok "pln-tunnel.service dibuat."

# --- 4. Pastikan log files ada dan dimiliki ticketing ---
print_step "Menyiapkan file log..."
touch "${OPT_DIR}/tunnel.log" "${OPT_DIR}/tunnel-url.txt"
chown -R ticketing:ticketing "${OPT_DIR}"
print_ok "File log siap."

# --- 5. Reload systemd dan enable services ---
print_step "Melakukan systemd daemon-reload..."
systemctl daemon-reload
print_ok "daemon-reload selesai."

print_step "Mengaktifkan services (enable)..."
systemctl enable pln-ticketing pln-tunnel
print_ok "Services diaktifkan untuk auto-start saat boot."

# --- 6. Start services ---
print_step "Menjalankan pln-ticketing.service..."
systemctl restart pln-ticketing
sleep 3

if systemctl is-active --quiet pln-ticketing; then
  print_ok "pln-ticketing.service AKTIF ✓"
else
  print_err "pln-ticketing.service GAGAL! Cek log: journalctl -u pln-ticketing -n 30"
  journalctl -u pln-ticketing -n 20 --no-pager 2>/dev/null || true
fi

print_step "Menjalankan pln-tunnel.service..."
systemctl restart pln-tunnel
print_ok "pln-tunnel.service dimulai (tunggu beberapa detik untuk koneksi)..."

# --- 7. Tunggu 8 detik lalu ambil URL tunnel ---
print_step "Menunggu tunnel terbentuk (8 detik)..."
sleep 8

TUNNEL_URL=""

# Coba dari file tunnel-url.txt
if [[ -f "${OPT_DIR}/tunnel-url.txt" ]] && [[ -s "${OPT_DIR}/tunnel-url.txt" ]]; then
  TUNNEL_URL=$(cat "${OPT_DIR}/tunnel-url.txt" | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)
fi

# Coba dari journal jika file masih kosong
if [[ -z "${TUNNEL_URL}" ]]; then
  TUNNEL_URL=$(journalctl -u pln-tunnel --no-pager --since "30 seconds ago" 2>/dev/null \
    | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)
fi

# Coba dari log file
if [[ -z "${TUNNEL_URL}" ]] && [[ -f "${OPT_DIR}/tunnel.log" ]]; then
  TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' "${OPT_DIR}/tunnel.log" | tail -1 || true)
fi

echo ""
echo -e "${BLUE}${BOLD}═══════════════════════════════════════════════════${NC}"
if [[ -n "${TUNNEL_URL}" ]]; then
  echo -e "${GREEN}${BOLD}  ✔ URL Tunnel Cloudflare:${NC}"
  echo -e "    ${YELLOW}${BOLD}${TUNNEL_URL}${NC}"
  echo "${TUNNEL_URL}" > "${OPT_DIR}/tunnel-url.txt"
else
  echo -e "${YELLOW}  ⚠ URL tunnel belum terdeteksi (mungkin masih loading).${NC}"
  echo -e "    Tunggu 30 detik lalu jalankan: ${CYAN}bash 05-get-tunnel-url.sh${NC}"
fi
echo -e "${BLUE}${BOLD}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}PENTING: Salin URL tunnel tersebut, lalu:${NC}"
echo -e "  1. Buka ${CYAN}Cloudflare Pages → Proyek Anda → Settings → Environment Variables${NC}"
echo -e "  2. Set: ${YELLOW}VITE_API_BASE_URL = ${TUNNEL_URL:-<URL_TUNNEL_ANDA>}${NC}"
echo -e "  3. Trigger rebuild Cloudflare Pages"
echo ""
echo -e "  ${BOLD}Monitoring:${NC}"
echo -e "    ${CYAN}systemctl status pln-ticketing pln-tunnel${NC}"
echo -e "    ${CYAN}journalctl -fu pln-ticketing${NC}"
echo -e "    ${CYAN}journalctl -fu pln-tunnel${NC}"
echo ""
echo -e "${GREEN}${BOLD}✔ Setup services selesai!${NC}\n"
