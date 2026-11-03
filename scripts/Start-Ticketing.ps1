#Requires -Version 5.1
[CmdletBinding()]
param([string]$LaragonRoot='',[switch]$NoBrowser,[switch]$Built)
# Built is retained for compatibility; the launcher always serves the checked build.
& (Join-Path (Split-Path -Parent $PSScriptRoot) 'JALANKAN-TICKETING.ps1') -Action Start -LaragonRoot $LaragonRoot -NoBrowser:$NoBrowser
exit $LASTEXITCODE
