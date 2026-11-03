@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0JALANKAN-TICKETING.ps1" -Action Start
set "rc=%ERRORLEVEL%"
if not "%rc%"=="0" echo Aplikasi belum siap. Baca pesan kesalahan dan MULAI-DI-SINI.txt.
pause
exit /b %rc%
