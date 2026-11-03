#Requires -Version 5.1
[CmdletBinding()]
param([string]$LaragonRoot='')
& (Join-Path (Split-Path -Parent $PSScriptRoot) 'JALANKAN-TICKETING.ps1') -Action Check -LaragonRoot $LaragonRoot
exit $LASTEXITCODE
