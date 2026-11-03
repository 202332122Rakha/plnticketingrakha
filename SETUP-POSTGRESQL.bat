@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0JALANKAN-TICKETING.ps1" -Action Setup
set "rc=%ERRORLEVEL%"
pause
exit /b %rc%
