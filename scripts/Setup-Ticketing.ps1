#Requires -Version 5.1
[CmdletBinding()]
param([ValidateSet('Tunnel','Direct','Local')][string]$ConnectionMode='Tunnel',[string]$LaragonRoot='',[switch]$Reinstall)
& (Join-Path (Split-Path -Parent $PSScriptRoot) 'JALANKAN-TICKETING.ps1') -Action Setup -ConnectionMode $ConnectionMode -LaragonRoot $LaragonRoot -Reinstall:$Reinstall
exit $LASTEXITCODE
