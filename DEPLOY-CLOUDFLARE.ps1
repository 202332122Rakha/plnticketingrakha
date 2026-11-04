# ==============================================================================
# PLN TICKETING - PANDUAN DEPLOYMENT CLOUDFLARE WORKERS + ORANGE PI / POSTGRESQL
# ==============================================================================
# Jalankan langkah-langkah berikut di PowerShell pada Windows.

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "       PANDUAN DEPLOYMENT CLOUDFLARE WORKERS & POSTGRESQL        " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------------------
# 1. PERIKSA PRASYARAT
# ------------------------------------------------------------------------------
Write-Host "[1/5] Memeriksa dependensi lokal..." -ForegroundColor Yellow
npx wrangler --version
npm --version

# ------------------------------------------------------------------------------
# 2. BUILD FRONTEND ASSETS
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "[2/5] Menjalankan Vite Build (menghasilkan folder dist/)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Build frontend gagal. Periksa error di atas." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "[OK] dist/ berhasil dibuat." -ForegroundColor Green

# ------------------------------------------------------------------------------
# 3. SETUP CLOUDFLARE TUNNEL KE ORANGE PI (Port 4100)
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "[3/5] Setup Koneksi Backend Orange Pi (10.10.23.26:4100)" -ForegroundColor Yellow
Write-Host "Pilih metode ekspos backend:"
Write-Host "A. Cloudflare Named Tunnel (Direkomendasikan - domain permanen):"
Write-Host "   Di Orange Pi: cloudflared tunnel run --url http://127.0.0.1:4100"
Write-Host "   Contoh hostname yang dihasilkan: https://api-ticketing.domain-anda.com"
Write-Host "B. Cloudflare Quick Tunnel (Untuk staging cepat):"
Write-Host "   Di Orange Pi: cloudflared tunnel --url http://127.0.0.1:4100"
Write-Host "   Catat URL https://xxxx.trycloudflare.com yang muncul."

# ------------------------------------------------------------------------------
# 4. SET SECRET BACKEND_ORIGIN DI CLOUDFLARE WORKER
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "[4/5] Memasukkan secret BACKEND_ORIGIN ke Cloudflare Workers..." -ForegroundColor Yellow
Write-Host "Jalankan perintah ini di PowerShell (ganti URL sesuai tunnel Anda):"
Write-Host "   npx wrangler secret put BACKEND_ORIGIN" -ForegroundColor White
Write-Host "   Masukkan nilai: https://URL-TUNNEL-ORANGEPI-ANDA" -ForegroundColor Gray

# ------------------------------------------------------------------------------
# 5. DEPLOY CLOUDFLARE WORKER
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "[5/5] Melakukan Deployment ke Cloudflare Workers..." -ForegroundColor Yellow
Write-Host "Jalankan perintah deploy:"
Write-Host "   npx wrangler deploy" -ForegroundColor White
Write-Host ""
Write-Host "Setelah ter-deploy, Worker akan menyajikan:" -ForegroundColor Green
Write-Host "1. Frontend Single Page Application (SPA) pada seluruh path biasa"
Write-Host "2. Reverse Proxy untuk semua path /api/* langsung ke backend Orange Pi"
Write-Host "=================================================================" -ForegroundColor Cyan
