#Requires -Version 5.1
[CmdletBinding()]
param(
    [ValidateSet('Start','Setup','Configure','Check')][string]$Action = 'Start',
    [ValidateSet('Tunnel','Direct','Local')][string]$ConnectionMode = 'Tunnel',
    [string]$LaragonRoot = '',
    [switch]$NoBrowser,
    [switch]$Reinstall
)
$ErrorActionPreference = 'Stop'
$script:ProjectRoot = $PSScriptRoot
. (Join-Path $PSScriptRoot 'scripts\Ticketing.Common.ps1')
$oldLocation = Get-Location
$variables = @('PATH','DATABASE_URL','DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASSWORD','DB_SSL','DB_SSL_CA','DB_SSL_SERVERNAME','DB_POOL_MAX','DB_CONNECT_TIMEOUT_MS','DB_STATEMENT_TIMEOUT_MS','HOST','PORT','NODE_ENV','CLIENT_URL','SESSION_SECRET','TRUST_PROXY',
'TICKETING_SETUP_PROFILE','TICKETING_SETUP_HOST','TICKETING_SETUP_PORT','TICKETING_SETUP_DATABASE','TICKETING_SETUP_USER','TICKETING_SETUP_PASSWORD','TICKETING_SETUP_SSL','TICKETING_SETUP_CA','TICKETING_SETUP_SSL_SERVERNAME',
'INITIAL_ADMIN_USERNAME','INITIAL_ADMIN_EMPLOYEE_ID','INITIAL_ADMIN_NAME','INITIAL_ADMIN_EMAIL','INITIAL_ADMIN_UNIT','INITIAL_ADMIN_PASSWORD')
$previous = @{}
foreach ($name in $variables) { $previous[$name] = [Environment]::GetEnvironmentVariable($name,'Process') }
$exitCode = 0
try {
    if ($env:OS -ne 'Windows_NT') { throw 'Launcher ini untuk Windows/Laragon. Untuk server Linux baca DEPLOYMENT_POSTGRESQL.md.' }
    Set-Location -LiteralPath $script:ProjectRoot
    Assert-SafeProjectLocation
    # The project's .env is authoritative. Stale shell variables must not select another DB.
    foreach ($name in $variables) { if ($name -ne 'PATH') { [Environment]::SetEnvironmentVariable($name,$null,'Process') } }
    Initialize-TicketingTools -RequestedLaragonRoot $LaragonRoot
    Protect-PrivateConfiguration
    Write-Host 'PLN TICKETING - POSTGRESQL / LARAGON'
    switch ($Action) {
        'Configure' {
            Invoke-Configure -DefaultMode $ConnectionMode
            Write-Host 'Konfigurasi disimpan. Berikutnya jalankan launcher dengan -Action Setup atau -Action Start.'
        }
        'Setup' { Invoke-TicketingSetup -DefaultMode $ConnectionMode -ForceInstall:$Reinstall }
        'Check' {
            if (-not (Test-Path -LiteralPath 'node_modules\pg\package.json')) { throw 'Dependensi belum lengkap. Jalankan launcher -Action Setup terlebih dahulu.' }
            $settings = Get-LaunchSettings
            Show-ConnectionSummary $settings
            Start-OwnedTunnel $settings
            Invoke-Npm -CommandArgs @('run','db:ready','--','--read-only')
            & $script:NodeExe 'scripts/build-state.mjs' 'check'
            if ($LASTEXITCODE -ne 0) { throw 'Database dapat diperiksa, tetapi build belum siap. Jalankan -Action Setup.' }
            Write-Host 'Pemeriksaan baca-saja selesai. Tidak mengubah data aplikasi.'
        }
        'Start' {
            if (-not (Test-Path -LiteralPath '.env') -or -not (Test-Path -LiteralPath '.connection.json') -or -not (Test-Path -LiteralPath '.setup-state.json')) {
                Invoke-TicketingSetup -DefaultMode $ConnectionMode -ForceInstall:$Reinstall
            } else { Ensure-CheckedBuild -Force:$Reinstall }
            Start-TicketingApplication -NoBrowser:$NoBrowser
        }
    }
} catch {
    $exitCode = 1
    Write-Host ''
    Write-Host ('BELUM BERHASIL: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Tidak ada reset database otomatis. Jangan kirim .env, password, atau private key saat meminta bantuan.'
    Write-Host 'Petunjuk: MULAI-DI-SINI.txt dan README.md. Salah konfigurasi: jalankan -Action Configure.'
} finally {
    Stop-OwnedProcesses
    foreach ($name in $variables) { [Environment]::SetEnvironmentVariable($name,$previous[$name],'Process') }
    Set-Location -LiteralPath $oldLocation.Path
}
exit $exitCode
