@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0JALANKAN-TICKETING.ps1" -Action Check
set "rc=%ERRORLEVEL%"
pause
exit /b %rc%
