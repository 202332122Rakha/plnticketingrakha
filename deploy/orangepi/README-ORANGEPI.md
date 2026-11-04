# Panduan Deploy PLN Ticketing di Orange Pi
## dengan Cloudflare Quick Tunnel + Cloudflare Pages

---

## Daftar Isi
1. [Prasyarat](#1-prasyarat)
2. [Diagram Arsitektur](#2-diagram-arsitektur)
3. [Urutan Langkah Deploy](#3-urutan-langkah-deploy)
4. [Cara SSH ke Orange Pi dari Windows](#4-cara-ssh-ke-orange-pi-dari-windows)
5. [Cara Copy File Project ke Orange Pi](#5-cara-copy-file-project-ke-orange-pi)
6. [Monitoring Service](#6-monitoring-service)
7. [Cara Update VITE_API_BASE_URL di Cloudflare Pages](#7-cara-update-vite_api_base_url-di-cloudflare-pages)
8. [Cara Update Kode Aplikasi](#8-cara-update-kode-aplikasi)
9. [Troubleshooting](#9-troubleshooting)
10. [Catatan Penting](#10-catatan-penting)

---

## 1. Prasyarat

### Spesifikasi Orange Pi Minimal
| Komponen | Minimum | Rekomendasi |
|---|---|---|
| SoC | ARM64 (aarch64) | ARM64 Cortex-A55+ |
| RAM | 1 GB | 2 GB atau lebih |
| Storage | 8 GB (microSD/eMMC) | 16 GB atau lebih |
| OS | Ubuntu 22.04 / Debian 12 / Armbian | Armbian terbaru |
| Koneksi | Ethernet / WiFi | Ethernet (lebih stabil) |

### Kebutuhan Lain
- ✅ Koneksi internet aktif di Orange Pi
- ✅ Akun Cloudflare (gratis) di https://cloudflare.com
- ✅ Repository GitHub/GitLab untuk frontend (Cloudflare Pages)
- ✅ SSH aktif di Orange Pi
- ✅ Akses `sudo` di Orange Pi

---

## 2. Diagram Arsitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET                                  │
│                                                                  │
│   ┌──────────────────┐         ┌──────────────────────────┐     │
│   │  Browser / User  │◄───────►│   Cloudflare Pages       │     │
│   │  (Mana saja)     │         │   (React Static Build)   │     │
│   └────────┬─────────┘         │   pln-ticketing.pages.dev│     │
│            │                   └──────────┬───────────────┘     │
│            │ API Calls                    │ VITE_API_BASE_URL    │
│            │                             ▼                       │
│            │                ┌────────────────────────────┐       │
│            └───────────────►│  Cloudflare Quick Tunnel   │       │
│                             │  xxxx.trycloudflare.com    │       │
│                             └──────────┬─────────────────┘       │
└──────────────────────────────────────┬─┘                         │
                                       │ Tunnel (outbound only)    │
                    ┌──────────────────▼──────────────────────┐   
                    │            ORANGE PI (LAN)               │
                    │                                          │
                    │  ┌─────────────────────────────────┐    │
                    │  │   cloudflared (pln-tunnel)       │    │
                    │  │   Port: outbound ke Cloudflare   │    │
                    │  └──────────────┬──────────────────┘    │
                    │                 │ localhost:4000          │
                    │  ┌─────────────▼──────────────────┐     │
                    │  │   Node.js Backend (pln-ticketing)│    │
                    │  │   Port 4000 (hanya localhost)    │    │
                    │  └──────────────┬──────────────────┘    │
                    │                 │                         │
                    │  ┌─────────────▼──────────────────┐     │
                    │  │   PostgreSQL 16                  │    │
                    │  │   Port 5432 (hanya localhost)    │    │
                    │  └────────────────────────────────┘     │
                    │                                          │
                    └──────────────────────────────────────────┘
```

> **Keamanan:** Orange Pi tidak memerlukan port forwarding atau IP publik.
> Semua koneksi keluar melalui Cloudflare Tunnel (outbound only).

---

## 3. Urutan Langkah Deploy

### Langkah 1 — Install Dependencies
```bash
# Di Orange Pi, jalankan sebagai root atau dengan sudo:
sudo bash 01-install.sh
```
Script ini menginstall: Node.js 22.x, PostgreSQL 16, cloudflared, membuat user `ticketing`.

---

### Langkah 2 — Setup Database
```bash
sudo bash 02-database.sh
```
Script ini membuat database `pln_ticketing` dan user `ticketing_app` dengan password random.

---

### Langkah 3 — Copy File Project ke Orange Pi
*(Lihat [Bagian 5](#5-cara-copy-file-project-ke-orange-pi) untuk perintah lengkap)*

```bash
# Dari Windows PowerShell:
scp -r "C:\Users\VICTUS\Downloads\PLN_Ticketing_PostgreSQL_Laragon_v1.2\PLN_Ticketing_PostgreSQL_Laragon" orangepi@192.168.x.x:/opt/pln-ticketing/app
```

---

### Langkah 4 — Deploy Backend
```bash
sudo bash 03-deploy-backend.sh
```
Script ini membuat `.env`, menjalankan `npm install`, `db:migrate`, dan `db:seed`.

---

### Langkah 5 — Setup dan Jalankan Services
```bash
sudo bash 04-services.sh
```
Script ini membuat systemd services dan menjalankan backend + tunnel Cloudflare.
Di akhir script, URL tunnel akan ditampilkan.

---

### Langkah 6 — Dapatkan URL Tunnel
```bash
bash 05-get-tunnel-url.sh
```
Salin URL yang ditampilkan (format: `https://xxxx-xxxx.trycloudflare.com`).

---

### Langkah 7 — Set Environment Variable di Cloudflare Pages
1. Buka https://dash.cloudflare.com → **Pages**
2. Pilih proyek frontend Anda
3. **Settings** → **Environment variables** → **Add variable**
4. Isi:
   - **Name:** `VITE_API_BASE_URL`
   - **Value:** `https://xxxx-xxxx.trycloudflare.com` (URL dari langkah 6)
5. Klik **Save** → Trigger rebuild deployment

---

### Langkah 8 — Update CLIENT_URL di Backend
Setelah Cloudflare Pages ter-deploy dan Anda punya URL Pages-nya:
```bash
sudo nano /opt/pln-ticketing/app/.env
# Ubah baris CLIENT_URL menjadi URL Cloudflare Pages Anda:
# CLIENT_URL=https://pln-ticketing.pages.dev
sudo systemctl restart pln-ticketing
```

---

## 4. Cara SSH ke Orange Pi dari Windows

### Menggunakan PowerShell / Command Prompt
```powershell
# Ganti <IP_ORANGEPI> dengan IP lokal Orange Pi Anda
# (cek dengan perintah: ip addr show | grep "inet " di Orange Pi)
ssh orangepi@192.168.1.xxx

# Jika menggunakan port SSH kustom (misal 2222):
ssh -p 2222 orangepi@192.168.1.xxx

# Jika menggunakan SSH key:
ssh -i C:\Users\VICTUS\.ssh\id_rsa orangepi@192.168.1.xxx
```

### Cara Menemukan IP Orange Pi
```powershell
# Di Windows, scan jaringan lokal:
# Cek ARP table setelah Orange Pi terhubung:
arp -a

# Atau ping broadcast (kadang tidak berfungsi di semua router):
ping 192.168.1.255
```

```bash
# Di Orange Pi (jika ada monitor/keyboard):
ip addr show
# atau
hostname -I
```

---

## 5. Cara Copy File Project ke Orange Pi

### Dari Windows — Menggunakan SCP
```powershell
# Copy seluruh folder project (dari PowerShell):
scp -r "C:\Users\VICTUS\Downloads\PLN_Ticketing_PostgreSQL_Laragon_v1.2\PLN_Ticketing_PostgreSQL_Laragon" `
  orangepi@192.168.1.xxx:/opt/pln-ticketing/app

# Copy hanya folder tertentu (misal hanya server dan client):
scp -r "C:\...\server" orangepi@192.168.1.xxx:/opt/pln-ticketing/app/server
scp -r "C:\...\client" orangepi@192.168.1.xxx:/opt/pln-ticketing/app/client
scp "C:\...\package.json" orangepi@192.168.1.xxx:/opt/pln-ticketing/app/
```

### Dari Windows — Menggunakan WinSCP (GUI)
1. Download [WinSCP](https://winscp.net)
2. Buat koneksi baru: Protocol=SFTP, Host=IP Orange Pi, User=orangepi
3. Drag & drop folder ke `/opt/pln-ticketing/app/`

### Dari Linux/WSL/Mac — Menggunakan rsync (Lebih Efisien)
```bash
# Hanya upload file yang berubah, skip node_modules dan .env:
rsync -avz \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='*.log' \
  --exclude='.git' \
  ./PLN_Ticketing_PostgreSQL_Laragon/ \
  orangepi@192.168.1.xxx:/opt/pln-ticketing/app/
```

> **Tip:** Jika tidak ada folder `/opt/pln-ticketing/app` atau permission denied,
> jalankan dulu di Orange Pi: `sudo mkdir -p /opt/pln-ticketing/app && sudo chown orangepi:orangepi /opt/pln-ticketing/app`

---

## 6. Monitoring Service

### Cek Status Services
```bash
# Status ringkas:
systemctl status pln-ticketing pln-tunnel

# Status detail dengan log terbaru:
systemctl status pln-ticketing -l
```

### Melihat Log Real-time
```bash
# Log backend (Node.js):
journalctl -fu pln-ticketing

# Log tunnel (Cloudflare):
journalctl -fu pln-tunnel

# Log keduanya sekaligus:
journalctl -fu pln-ticketing -fu pln-tunnel

# Log sejak 1 jam terakhir:
journalctl -u pln-ticketing --since "1 hour ago" --no-pager
```

### Restart Services
```bash
sudo systemctl restart pln-ticketing
sudo systemctl restart pln-tunnel
# atau keduanya:
sudo systemctl restart pln-ticketing pln-tunnel
```

### Cek URL Tunnel Aktif
```bash
bash /opt/pln-ticketing/deploy/05-get-tunnel-url.sh
# atau langsung:
journalctl -u pln-tunnel --no-pager | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1
```

---

## 7. Cara Update VITE_API_BASE_URL di Cloudflare Pages

> ⚠️ **PENTING:** Quick Tunnel mendapat URL baru setiap kali `cloudflared` di-restart atau Orange Pi reboot!
> Setiap kali URL berubah, Anda **wajib** memperbarui Cloudflare Pages.

### Langkah-langkah:
1. Jalankan di Orange Pi:
   ```bash
   bash 05-get-tunnel-url.sh
   ```
   Salin URL yang ditampilkan.

2. Buka [Cloudflare Dashboard](https://dash.cloudflare.com)

3. **Pages** → Pilih proyek Anda → **Settings** → **Environment variables**

4. Klik ikon pensil (edit) di sebelah `VITE_API_BASE_URL`

5. Paste URL baru → **Save**

6. Pergi ke tab **Deployments** → Klik **"..."** pada deployment terbaru → **"Retry deployment"**
   *(Atau push commit baru ke repository untuk trigger build otomatis)*

7. Tunggu build selesai (~1-2 menit), lalu refresh halaman frontend.

---

## 8. Cara Update Kode Aplikasi

Ketika ada perubahan kode, gunakan script update:
```bash
sudo bash 06-update.sh
```

Script ini otomatis:
1. Menghentikan services
2. Backup `.env`
3. Meminta Anda upload kode baru
4. Menjalankan `npm install` dan `db:migrate`
5. Memulai ulang services
6. Menampilkan status

---

## 9. Troubleshooting

### ❌ PostgreSQL tidak bisa start
```bash
# Cek status
sudo systemctl status postgresql

# Cek log PostgreSQL
sudo journalctl -u postgresql -n 50 --no-pager

# Coba start manual
sudo systemctl start postgresql

# Jika error "port already in use":
sudo ss -tlnp | grep 5432
# Kill proses yang menempati port 5432
```

### ❌ Backend Node.js gagal start
```bash
# Cek log
journalctl -u pln-ticketing -n 50 --no-pager

# Cek apakah .env ada dan benar
cat /opt/pln-ticketing/app/.env

# Test jalankan manual:
sudo -u ticketing node /opt/pln-ticketing/app/server/index.js

# Cek apakah port 4000 sudah dipakai:
sudo ss -tlnp | grep 4000
```

### ❌ Tunnel tidak konek / URL tidak muncul
```bash
# Cek log tunnel
journalctl -u pln-tunnel -n 50 --no-pager

# Cek koneksi internet
ping -c 3 cloudflare.com

# Test cloudflared manual:
cloudflared tunnel --url http://localhost:4000

# Pastikan backend jalan dulu sebelum tunnel:
curl http://localhost:4000/health
```

### ❌ Frontend tidak bisa konek ke backend (CORS error)
1. Pastikan `CLIENT_URL` di `/opt/pln-ticketing/app/.env` sudah diisi dengan URL Cloudflare Pages yang benar
2. Restart backend: `sudo systemctl restart pln-ticketing`
3. Pastikan `VITE_API_BASE_URL` di Cloudflare Pages sudah diisi dengan URL tunnel yang aktif

### ❌ Error "permission denied" saat jalankan script
```bash
# Beri permission execute:
chmod +x 01-install.sh 02-database.sh 03-deploy-backend.sh 04-services.sh 05-get-tunnel-url.sh 06-update.sh
# Kemudian jalankan dengan sudo
```

### ❌ npm install gagal (EACCES / permission error)
```bash
# Pastikan folder dimiliki user ticketing:
sudo chown -R ticketing:ticketing /opt/pln-ticketing
# Jalankan npm install sebagai user ticketing:
sudo -u ticketing bash -c "cd /opt/pln-ticketing/app && npm install --omit=dev"
```

### ❌ Database migration gagal
```bash
# Cek apakah database bisa diakses:
DB_PASS=$(sudo cat /opt/pln-ticketing/.db-password)
PGPASSWORD="${DB_PASS}" psql -h 127.0.0.1 -U ticketing_app -d pln_ticketing -c '\l'

# Jalankan migration manual:
cd /opt/pln-ticketing/app
sudo -u ticketing npm run db:migrate
```

---

## 10. Catatan Penting

> ⚠️ **Quick Tunnel URL Berubah Saat Restart**
>
> Cloudflare **Quick Tunnel** (tanpa domain sendiri) memberikan URL acak yang berbeda setiap kali `cloudflared` di-restart. Ini terjadi karena:
> - Orange Pi reboot
> - `systemctl restart pln-tunnel`
> - Koneksi internet terputus dan reconnect
>
> **Solusi jangka pendek:** Setiap kali URL berubah, jalankan `bash 05-get-tunnel-url.sh` dan update `VITE_API_BASE_URL` di Cloudflare Pages.
>
> **Solusi jangka panjang:** Daftar domain di Cloudflare dan gunakan **Named Tunnel** (bukan Quick Tunnel) untuk mendapatkan URL permanen. Ini memerlukan akun Cloudflare dengan domain.

---

> 📋 **Referensi File Penting di Orange Pi**
>
> | File | Keterangan |
> |------|-----------|
> | `/opt/pln-ticketing/app/.env` | Konfigurasi backend |
> | `/opt/pln-ticketing/.db-password` | Password database (rahasia!) |
> | `/opt/pln-ticketing/tunnel.log` | Log cloudflared |
> | `/opt/pln-ticketing/tunnel-url.txt` | URL tunnel terakhir |
> | `/etc/systemd/system/pln-ticketing.service` | Systemd service backend |
> | `/etc/systemd/system/pln-tunnel.service` | Systemd service tunnel |

---

*Dibuat untuk PLN Ticketing System — Deployment Orange Pi + Cloudflare*
