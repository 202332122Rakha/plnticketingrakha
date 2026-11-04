@echo off
setlocal
cd /d "%~dp0"
echo ===============================================================
echo        HAPUS DAN BUILD ULANG TOTAL DATABASE PLN TICKETING
echo ===============================================================
echo.
echo Tindakan ini akan menghapus database PostgreSQL saat ini,
echo kemudian membuat database baru, menjalankan migrasi skema lengkap,
echo mengisikan master data UPDL/kategori, dan membuat ulang akun Admin.
echo.

:: 1. Jalankan script reset database
node server/reset-db.js
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Reset database dibatalkan atau gagal!
    pause
    exit /b %ERRORLEVEL%
)

:: 2. Jalankan Migrasi Skema
echo.
echo [1/3] Menjalankan migrasi skema tabel...
node server/run-migrations.js
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Migrasi gagal!
    pause
    exit /b %ERRORLEVEL%
)

:: 3. Seed Master Data Awal (Unit UPDL, PLN CorpU, Kategori, SLA)
echo.
echo [2/3] Memasukkan master data resmi...
node server/seed.js
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Seeding master data gagal!
    pause
    exit /b %ERRORLEVEL%
)

:: 4. Buat Akun Admin Awal Baru
echo.
echo [3/3] Menyiapkan Akun Administrator Baru...
set /p ADMIN_EMAIL="Masukkan Email Admin (contoh: admin@corpu.pln.co.id): "
set /p ADMIN_PASS="Masukkan Password Admin (minimal 8 karakter): "

if "%ADMIN_EMAIL%"=="" (
    echo [PERINGATAN] Email kosong. Melewati pembuatan admin. Anda bisa jalankan 'npm run admin:create' nanti.
) else (
    set "INITIAL_ADMIN_EMAIL=%ADMIN_EMAIL%"
    set "INITIAL_ADMIN_PASSWORD=%ADMIN_PASS%"
    set "INITIAL_ADMIN_USERNAME=admin"
    set "INITIAL_ADMIN_NAME=Administrator Ticketing"
    set "INITIAL_ADMIN_UNIT=PLN_CORPU"
    node server/create-admin.js
)

:: 5. Re-build Frontend agar sinkron
echo.
echo [4/4] Membangun ulang Frontend (npm run build)...
call npm run build

echo.
echo ===============================================================
echo [SELESAI] Database dan Sistem berhasil dibangun ulang dengan rapi!
echo ===============================================================
pause

