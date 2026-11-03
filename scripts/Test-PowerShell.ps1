#Requires -Version 5.1
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$script:ProjectRoot = Split-Path -Parent $PSScriptRoot
try {
    $paths = @((Join-Path $script:ProjectRoot 'JALANKAN-TICKETING.ps1')) + @(Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.ps1' -File | ForEach-Object { $_.FullName })
    $count = 0
    foreach ($path in $paths) {
        $parseErrors = $null; $tokens = $null
        [void][System.Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$parseErrors)
        if ($null -ne $parseErrors -and $parseErrors.Count -gt 0) {
            throw ('Sintaks PowerShell tidak valid: ' + [IO.Path]::GetFileName($path) + ': ' + (($parseErrors | ForEach-Object { $_.Message }) -join '; '))
        }
        $count++
    }
    Write-Host "PASS parser PowerShell: $count file"
    . (Join-Path $PSScriptRoot 'Ticketing.Common.ps1')
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
    try {
        $listener.Start(); $port = $listener.LocalEndpoint.Port
        if (-not (Test-TcpPort -Computer '127.0.0.1' -Port $port)) { throw 'Uji helper TCP pada listener lokal gagal.' }
        Write-Host 'PASS helper koneksi TCP lokal'
        $refused = $false
        try { Assert-FreeLocalPort -Port $port -Purpose 'pengujian' } catch { $refused = $true }
        if (-not $refused) { throw 'Port yang sedang digunakan tidak ditolak.' }
        Write-Host 'PASS penolakan port terpakai (tidak mematikan proses lain)'
    } finally { $listener.Stop() }
    Write-Host 'Tes PowerShell lokal selesai; ini bukan tes SSH atau database kantor.'
    exit 0
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
