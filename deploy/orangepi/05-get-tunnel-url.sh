#!/bin/bash
# ==============================================================================
# 05-get-tunnel-url.sh - Tampilkan URL Cloudflare Tunnel yang sedang aktif
# Tidak memerlukan root
# ==============================================================================

# --- Warna Output ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

OPT_DIR="/opt/pln-ticketing"
URL_FILE="${OPT_DIR}/tunnel-url.txt"

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║   PLN Ticketing - URL Tunnel Aktif               ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""

TUNNEL_URL=""

# Coba dari file tunnel-url.txt
if [[ -f "${URL_FILE}" ]] && [[ -s "${URL_FILE}" ]]; then
  TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' "${URL_FILE}" | tail -1 || true)
fi

# Coba dari journal log (lebih fresh)
JOURNAL_URL=$(journalctl -u pln-tunnel --no-pager --since "1 hour ago" 2>/dev/null \
  | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)

if [[ -n "${JOURNAL_URL}" ]]; then
  TUNNEL_URL="${JOURNAL_URL}"
fi

# Coba dari file log cloudflared
if [[ -z "${TUNNEL_URL}" ]] && [[ -f "${OPT_DIR}/tunnel.log" ]]; then
  TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' "${OPT_DIR}/tunnel.log" | tail -1 || true)
fi

echo -e "=== ${BOLD}URL Tunnel Aktif${NC} ==="
echo ""

if [[ -n "${TUNNEL_URL}" ]]; then
  echo -e "  ${GREEN}${BOLD}${TUNNEL_URL}${NC}"
  echo ""
  echo -e "  ${BOLD}Status service:${NC}"
  systemctl is-active pln-tunnel 2>/dev/null && \
    echo -e "    ${GREEN}✔${NC} pln-tunnel : AKTIF" || \
    echo -e "    ${YELLOW}⚠${NC} pln-tunnel : tidak aktif"
  systemctl is-active pln-ticketing 2>/dev/null && \
    echo -e "    ${GREEN}✔${NC} pln-ticketing : AKTIF" || \
    echo -e "    ${YELLOW}⚠${NC} pln-ticketing : tidak aktif"
else
  echo -e "  ${YELLOW}⚠  URL tunnel belum terdeteksi.${NC}"
  echo ""
  echo -e "  Kemungkinan penyebab:"
  echo -e "    - Tunnel belum selesai terhubung (tunggu 30-60 detik)"
  echo -e "    - Service pln-tunnel belum jalan: ${CYAN}sudo systemctl start pln-tunnel${NC}"
  echo -e "    - Cek log: ${CYAN}journalctl -u pln-tunnel -n 50 --no-pager${NC}"
fi

echo ""
echo -e "  ${BOLD}Set ini sebagai VITE_API_BASE_URL di:${NC}"
echo -e "  ${CYAN}Cloudflare Pages → Settings → Environment Variables${NC}"
echo ""
echo -e "  ${YELLOW}⚠  CATATAN: URL Quick Tunnel berubah setiap kali cloudflared restart!${NC}"
echo -e "     Setelah restart, jalankan script ini lagi dan update Cloudflare Pages."
echo ""
