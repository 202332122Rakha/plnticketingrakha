# Windows PowerShell 5.1 compatible. No global PATH/policy or server firewall changes.
Set-StrictMode -Version 2.0
$script:NodeExe = $null
$script:NpmCli = $null
$script:OwnedTunnel = $null
$script:OwnedApp = $null
$script:DependenciesReady = $false

function Read-Default([string]$Prompt, [string]$Default) {
    $answer = Read-Host "$Prompt [$Default]"
    if ([string]::IsNullOrWhiteSpace($answer)) { return $Default }
    return $answer.Trim()
}
function Read-Secret([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secure.Dispose() }
}
function Invoke-Node([string[]]$CommandArgs) {
    & $script:NodeExe @CommandArgs
    if ($LASTEXITCODE -ne 0) { throw "Langkah Node.js gagal (exit $LASTEXITCODE). Lihat pesan tepat di atas. Langkah berikutnya tidak dijalankan." }
}
function Invoke-Npm([string[]]$CommandArgs) {
    # Invoke npm's JS entrypoint, never npm.ps1: avoids PowerShell script-policy conflicts.
    & $script:NodeExe $script:NpmCli @CommandArgs
    if ($LASTEXITCODE -ne 0) { throw "npm $($CommandArgs -join ' ') gagal (exit $LASTEXITCODE). Tidak melanjutkan perubahan database/start aplikasi." }
}
function Initialize-TicketingTools([string]$RequestedLaragonRoot) {
    $candidates = New-Object 'System.Collections.Generic.List[string]'
    $roots = New-Object 'System.Collections.Generic.List[string]'
    foreach ($root in @($RequestedLaragonRoot, $env:LARAGON_ROOT, 'C:\laragon', 'D:\laragon')) {
        if (-not [string]::IsNullOrWhiteSpace($root) -and (Test-Path -LiteralPath $root -PathType Container)) { $roots.Add($root) }
    }
    # Detect a portable Laragon containing this project's directory.
    $parent = Get-Item -LiteralPath $script:ProjectRoot
    for ($i = 0; $i -lt 8 -and $null -ne $parent; $i++) {
        if (Test-Path -LiteralPath (Join-Path $parent.FullName 'laragon.exe')) { $roots.Add($parent.FullName) }
        $parent = $parent.Parent
    }
    foreach ($root in @($roots | Select-Object -Unique)) {
        $nodeRoot = Join-Path $root 'bin\nodejs'
        if (Test-Path -LiteralPath $nodeRoot) {
            foreach ($file in @(Get-ChildItem -LiteralPath $nodeRoot -Filter node.exe -File -Recurse -ErrorAction SilentlyContinue | Sort-Object FullName -Descending)) { $candidates.Add($file.FullName) }
        }
    }
    $onPath = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $onPath) { $candidates.Add($onPath.Source) }
    foreach ($candidate in @($candidates | Select-Object -Unique)) {
        try {
            $versionText = (& $candidate -p 'process.versions.node' | Out-String).Trim()
            if ($LASTEXITCODE -ne 0 -or [Version]$versionText -lt [Version]'22.12.0') { continue }
            $runtime = Split-Path -Parent $candidate
            $npm = Join-Path $runtime 'node_modules\npm\bin\npm-cli.js'
            if (-not (Test-Path -LiteralPath $npm -PathType Leaf)) { continue }
            $script:NodeExe = $candidate; $script:NpmCli = $npm
            $env:PATH = $runtime + [IO.Path]::PathSeparator + $env:PATH
            Write-Host "Node.js $versionText : $candidate"
            return
        } catch { continue }
    }
    throw 'Node.js minimal 22.12.0 + npm belum ditemukan. Di Laragon gunakan Tools > Quick add > Node.js, atau pasang Node LTS yang disetujui IT. Untuk Laragon portable: tambahkan -LaragonRoot "D:\lokasi laragon".'
}
function Assert-SafeProjectLocation {
    # Source includes credentials: it must not be a Laragon auto-virtual-host document root.
    if ($script:ProjectRoot -match '(?i)[\\/]www([\\/]|$)') {
        throw 'Folder sumber berada di dalam www. Pindahkan ke C:\laragon\projects\PLN_Ticketing_PostgreSQL_Laragon atau Downloads agar .env dan kode backend tidak dilayani Apache/Nginx.'
    }
}
function Test-TcpPort([string]$Computer, [int]$Port, [int]$TimeoutMs = 4000) {
    $client = New-Object Net.Sockets.TcpClient
    $handle = $null
    try {
        $async = $client.BeginConnect($Computer, $Port, $null, $null)
        $handle = $async.AsyncWaitHandle
        if (-not $handle.WaitOne($TimeoutMs)) { return $false }
        $client.EndConnect($async)
        return $true
    } catch { return $false }
    finally { if ($null -ne $handle) { $handle.Close() }; $client.Close() }
}
function Assert-FreeLocalPort([int]$Port, [string]$Purpose) {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
    try { $listener.Start() }
    catch { throw "Port lokal $Port untuk $Purpose sudah dipakai. Tutup launcher/tunnel lama, atau gunakan -Action Configure untuk memilih port lain. Proses lain tidak dihentikan otomatis." }
    finally { $listener.Stop() }
}
function Install-ProjectDependencies([switch]$Force) {
    if ($script:DependenciesReady -and -not $Force) { return }
    Write-Host 'Memasang dependensi untuk Windows. Internet/proxy npm resmi diperlukan pada pemasangan pertama.'
    if (Test-Path -LiteralPath (Join-Path $script:ProjectRoot 'package-lock.json')) { Invoke-Npm -CommandArgs @('ci','--no-fund') }
    else { Invoke-Npm -CommandArgs @('install','--no-fund') }
    $script:DependenciesReady = $true
}
function Ensure-CheckedBuild([switch]$Force) {
    if (-not $Force) {
        & $script:NodeExe 'scripts/build-state.mjs' 'check'
        if ($LASTEXITCODE -eq 0) { return }
    }
    Install-ProjectDependencies -Force:$Force
    & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $script:ProjectRoot 'scripts\Test-PowerShell.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Tes PowerShell tidak lulus. Database tidak diubah.' }
    Invoke-Npm -CommandArgs @('run','check')
    Invoke-Npm -CommandArgs @('run','build')
    Invoke-Node -CommandArgs @('scripts/build-state.mjs','write')
}
function Get-LaunchSettings {
    $json = & $script:NodeExe 'server/launch-config.js'
    if ($LASTEXITCODE -ne 0) { throw 'Konfigurasi koneksi belum valid. Jalankan -Action Configure, kemudian -Action Setup.' }
    return (($json -join [Environment]::NewLine) | ConvertFrom-Json)
}
function Invoke-Configure([string]$DefaultMode = 'Tunnel') {
    if (-not (Test-Path -LiteralPath 'node_modules\dotenv\package.json')) { Install-ProjectDependencies }
    $replace = (Test-Path -LiteralPath '.env') -or (Test-Path -LiteralPath '.connection.json')
    if ($replace) {
        Write-Host 'Konfigurasi lama akan dicadangkan di .config-backups. Database dan akun tidak dihapus.'
        if ((Read-Host 'Ketik GANTI untuk mengganti konfigurasi') -cne 'GANTI') { throw 'Penggantian konfigurasi dibatalkan.' }
    }
    Write-Host ''
    Write-Host 'Tunnel = PostgreSQL server melalui SSH (disarankan untuk 10.10.23.26).'
    Write-Host 'Local = PostgreSQL di komputer/Laragon ini. Direct = PostgreSQL jaringan memakai TLS.'
    $mode = Read-Default 'Mode: Tunnel / Local / Direct' $DefaultMode
    if ($mode -notin @('Tunnel','Local','Direct')) { throw 'Pilih Tunnel, Local, atau Direct.' }
    # Canonical capitalization is required by the Node validation contract.
    if ($mode -ieq 'Tunnel') { $mode = 'Tunnel' } elseif ($mode -ieq 'Local') { $mode = 'Local' } else { $mode = 'Direct' }
    $connectionProfile = @{ version=1; mode=$mode; sshHost='10.10.23.26'; sshUser='webadmin2'; sshPort=22; localPort=15432; remoteDbHost='127.0.0.1'; remoteDbPort=5432; appPort=4000 }
    if ($mode -eq 'Tunnel') {
        $connectionProfile.sshHost = Read-Default 'IP/nama server SSH' '10.10.23.26'
        $connectionProfile.sshUser = Read-Default 'Username SSH (bukan akun database)' 'webadmin2'
        $connectionProfile.sshPort = [int](Read-Default 'Port SSH' '22')
        $connectionProfile.remoteDbHost = Read-Default 'Host PostgreSQL dilihat DARI server SSH (jika satu server: 127.0.0.1)' '127.0.0.1'
        $connectionProfile.remoteDbPort = [int](Read-Default 'Port PostgreSQL pada server' '5432')
        $connectionProfile.localPort = [int](Read-Default 'Port tunnel pada laptop (berbeda dari port PostgreSQL Laragon)' '15432')
        $dbHost = '127.0.0.1'; $dbPort = [string]$connectionProfile.localPort
    } else {
        $defaultHost = '127.0.0.1'; if ($mode -eq 'Direct') { $defaultHost = '10.10.23.26' }
        $dbHost = Read-Default 'Host PostgreSQL' $defaultHost
        $dbPort = Read-Default 'Port PostgreSQL' '5432'
    }
    $connectionProfile.appPort = [int](Read-Default 'Port HTTP aplikasi pada laptop' '4000')
    $env:TICKETING_SETUP_PROFILE = $connectionProfile | ConvertTo-Json -Compress
    $env:TICKETING_SETUP_HOST = $dbHost; $env:TICKETING_SETUP_PORT = $dbPort
    $env:TICKETING_SETUP_DATABASE = Read-Default 'Nama database khusus aplikasi yang sudah dibuat DBA' 'pln_ticketing'
    $env:TICKETING_SETUP_USER = Read-Default 'Username PostgreSQL dari DBA' 'ticketing_app'
    $env:TICKETING_SETUP_PASSWORD = Read-Secret 'Password PostgreSQL (tidak ditampilkan)'
    if ([string]::IsNullOrEmpty($env:TICKETING_SETUP_PASSWORD)) { throw 'Password database tidak boleh kosong. Jangan mengisi password SSH sebagai password database kecuali DBA menyatakan sama.' }
    $tlsDefault = 'N'; if ($mode -eq 'Direct') { $tlsDefault = 'Y' }
    $tls = Read-Default 'TLS database? Y/N (tunnel SSH sudah mengenkripsi jalur jaringan)' $tlsDefault
    if ($tls -notin @('Y','N')) { throw 'Jawaban TLS harus Y atau N.' }
    $env:TICKETING_SETUP_SSL = 'false'; $env:TICKETING_SETUP_CA = ''; $env:TICKETING_SETUP_SSL_SERVERNAME = ''
    if ($tls -ieq 'Y') { $env:TICKETING_SETUP_SSL = 'true'; $env:TICKETING_SETUP_CA = Read-Host 'Path sertifikat CA dari IT; kosong bila CA sistem sudah mempercayainya'; $env:TICKETING_SETUP_SSL_SERVERNAME = Read-Host 'Nama DNS pada sertifikat TLS (opsional; isi bila koneksi tunnel memakai TLS)' }
    try {
        if ($replace) { Invoke-Node -CommandArgs @('server/save-setup.js','--replace') }
        else { Invoke-Node -CommandArgs @('server/save-setup.js') }
        Protect-PrivateConfiguration
    } finally {
        Remove-Item Env:TICKETING_SETUP_PASSWORD -ErrorAction SilentlyContinue
        Remove-Item Env:TICKETING_SETUP_PROFILE -ErrorAction SilentlyContinue
    }
}
function Start-OwnedTunnel($Settings) {
    if ($Settings.profile.mode -ne 'Tunnel') { return }
    if ($null -ne $script:OwnedTunnel -and -not $script:OwnedTunnel.HasExited) { return }
    $p = $Settings.profile
    Assert-FreeLocalPort -Port $p.localPort -Purpose 'SSH tunnel'
    $ssh = Get-Command ssh.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $ssh) { throw 'OpenSSH Client Windows belum tersedia. Pasang melalui Optional Features dengan persetujuan IT; lalu jalankan kembali.' }
    Write-Host "Menguji akses SSH $($p.sshHost):$($p.sshPort)..."
    if (-not (Test-TcpPort -Computer $p.sshHost -Port $p.sshPort)) { throw 'Server SSH belum terjangkau. Hubungkan jaringan/VPN kantor dan minta IT memeriksa port SSH. Password atau kode aplikasi belum diuji pada tahap ini.' }
    Write-Host 'Jendela SSH akan terbuka. Verifikasi fingerprint kepada IT saat pertama kali, lalu isi password SSH di jendela itu.'
    Write-Host 'Password SSH tidak disimpan oleh aplikasi. Jangan menutup jendela SSH selama aplikasi berjalan.'
    $script:OwnedTunnel = Start-Process -FilePath $ssh.Source -ArgumentList @($Settings.sshArguments) -PassThru -WorkingDirectory $script:ProjectRoot
    $deadline = [DateTime]::UtcNow.AddSeconds(180)
    $ready = $false
    while ([DateTime]::UtcNow -lt $deadline) {
        $script:OwnedTunnel.Refresh()
        if ($script:OwnedTunnel.HasExited) { throw "SSH berhenti (exit $($script:OwnedTunnel.ExitCode)). Periksa password/key, fingerprint, izin TCP forwarding, atau alamat PostgreSQL dari server." }
        if (Test-TcpPort -Computer '127.0.0.1' -Port $p.localPort -TimeoutMs 400) { $ready = $true; break }
        Start-Sleep -Milliseconds 350
    }
    if (-not $ready) { throw 'Tunnel belum terbuka. Selesaikan login SSH lalu ulangi launcher; proses tunnel milik launcher ini akan ditutup.' }
    Start-Sleep -Milliseconds 400
    $script:OwnedTunnel.Refresh()
    if ($script:OwnedTunnel.HasExited) { throw 'SSH berhenti sebelum tunnel siap. Tidak akan memakai port milik proses lain.' }
    Write-Host 'Tunnel lokal terbuka. Berikutnya login PostgreSQL diperiksa terpisah.'
}
function Show-ConnectionSummary($Settings) {
    Write-Host ''
    Write-Host "Mode            : $($Settings.profile.mode)"
    Write-Host "Database        : $($Settings.database.database)"
    Write-Host "Akun PostgreSQL : $($Settings.database.user)"
    Write-Host "Endpoint lokal  : $($Settings.database.host):$($Settings.database.port)"
    Write-Host "TLS PostgreSQL  : $($Settings.database.tls)"
    Write-Host "Aplikasi        : http://127.0.0.1:$($Settings.database.appPort)"
    Write-Host 'Tidak ada password yang ditampilkan.'
}
function Ensure-InitialAdmin {
    & $script:NodeExe 'server/admin-status.js'
    $status = $LASTEXITCODE
    if ($status -eq 0) { return }
    if ($status -ne 2) { throw 'Pemeriksaan admin gagal. Tidak membuat/mengubah akun.' }
    Write-Host 'Belum ada admin aktif. Buat admin pertama; tidak ada password demo bawaan.'
    $env:INITIAL_ADMIN_USERNAME = Read-Default 'Username admin' 'admin'
    $env:INITIAL_ADMIN_EMPLOYEE_ID = Read-Host 'NIP/ID pegawai admin'
    $env:INITIAL_ADMIN_NAME = Read-Host 'Nama lengkap admin'
    $env:INITIAL_ADMIN_EMAIL = Read-Host 'Email admin'
    $env:INITIAL_ADMIN_UNIT = Read-Default 'Kode unit admin' 'PLN_CORPU'
    try {
        do {
            $first = Read-Secret 'Password admin: minimal 12 karakter, maksimal 72 byte UTF-8'
            $second = Read-Secret 'Ulangi password admin'
            $valid = $first.Length -ge 12 -and [Text.Encoding]::UTF8.GetByteCount($first) -le 72 -and $first -ceq $second
            if (-not $valid) { Write-Host 'Password tidak memenuhi panjang yang diminta atau konfirmasi berbeda. Ulangi.' }
        } while (-not $valid)
        $env:INITIAL_ADMIN_PASSWORD = $first
        Invoke-Npm -CommandArgs @('run','admin:create')
    } finally {
        $first = $null; $second = $null
        Remove-Item Env:INITIAL_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    }
}
function Invoke-TicketingSetup([string]$DefaultMode, [switch]$ForceInstall) {
    # Compile/test BEFORE making changes to a database.
    Ensure-CheckedBuild -Force:$ForceInstall
    if (-not (Test-Path -LiteralPath '.env') -or -not (Test-Path -LiteralPath '.connection.json')) { Invoke-Configure -DefaultMode $DefaultMode }
    $settings = Get-LaunchSettings
    Show-ConnectionSummary $settings
    Assert-FreeLocalPort -Port $settings.profile.appPort -Purpose 'HTTP aplikasi'
    Start-OwnedTunnel $settings
    Invoke-Npm -CommandArgs @('run','db:status')
    Write-Host 'Setup akan menerapkan migrasi dan menambah master awal yang belum ada. Database/akun lama tidak dihapus atau direset.'
    if ((Read-Host 'Pastikan database benar. Ketik SIAPKAN untuk melanjutkan') -cne 'SIAPKAN') { throw 'Penyiapan database dibatalkan; tidak ada migrasi/seed yang dijalankan.' }
    Invoke-Npm -CommandArgs @('run','db:migrate')
    Invoke-Npm -CommandArgs @('run','db:seed')
    Ensure-InitialAdmin
    Invoke-Npm -CommandArgs @('run','db:ready')
    @{ verifiedAt=[DateTime]::UtcNow.ToString('o'); database=$settings.database.database; appPort=$settings.profile.appPort } | ConvertTo-Json | Set-Content -LiteralPath '.setup-state.json' -Encoding UTF8
    Protect-PrivateConfiguration
    Write-Host 'Setup komputer ini lulus: build, skema, akun admin, dan uji baca/tulis PostgreSQL sementara.'
    Write-Host 'Lakukan uji login/tiket sesuai panduan sebelum dipakai untuk data operasional.'
}
function Start-TicketingApplication([switch]$NoBrowser) {
    $settings = Get-LaunchSettings
    Show-ConnectionSummary $settings
    Assert-FreeLocalPort -Port $settings.profile.appPort -Purpose 'HTTP aplikasi'
    Start-OwnedTunnel $settings
    Invoke-Npm -CommandArgs @('run','db:ready')
    $url = "http://127.0.0.1:$($settings.profile.appPort)"
    Write-Host 'Menjalankan hasil build. Jendela PowerShell ini harus tetap terbuka; Ctrl+C untuk berhenti.'
    $script:OwnedApp = Start-Process -FilePath $script:NodeExe -ArgumentList @('server/index.js') -WorkingDirectory $script:ProjectRoot -NoNewWindow -PassThru
    $ready = $false
    for ($i=0; $i -lt 50; $i++) {
        $script:OwnedApp.Refresh()
        if ($script:OwnedApp.HasExited) { throw "Aplikasi berhenti sebelum siap (exit $($script:OwnedApp.ExitCode))." }
        try {
            $health = Invoke-RestMethod -Uri ($url + '/api/health') -TimeoutSec 2
            if ($health.ok -eq $true -and $health.engine -eq 'PostgreSQL' -and $health.database -eq 'connected') {
                $page = Invoke-WebRequest -Uri ($url + '/') -UseBasicParsing -TimeoutSec 2
                if ($page.StatusCode -eq 200) { $ready = $true; break }
            }
        } catch { }
        Start-Sleep -Milliseconds 400
    }
    if (-not $ready) { throw 'Health API/halaman aplikasi belum siap. Aplikasi tidak dinyatakan berhasil.' }
    Write-Host "APLIKASI TERHUBUNG KE POSTGRESQL: $url"
    if (-not $NoBrowser) { try { Start-Process $url | Out-Null } catch { Write-Host "Buka browser secara manual: $url" } }
    while (-not $script:OwnedApp.WaitForExit(1000)) {
        if ($null -ne $script:OwnedTunnel -and $script:OwnedTunnel.HasExited) { throw 'Tunnel SSH terputus. Aplikasi dihentikan; jalankan kembali setelah jaringan pulih. Data yang sudah tersimpan tetap di PostgreSQL.' }
    }
    if ($script:OwnedApp.ExitCode -ne 0) { throw "Aplikasi berhenti dengan exit $($script:OwnedApp.ExitCode)." }
}
function Stop-OwnedProcesses {
    foreach ($process in @($script:OwnedApp,$script:OwnedTunnel)) {
        if ($null -ne $process) {
            try { $process.Refresh(); if (-not $process.HasExited) { Stop-Process -Id $process.Id -ErrorAction SilentlyContinue } }
            catch { }
        }
    }
}

function Protect-PrivateConfiguration {
    # Windows ignores POSIX mode 0600. Apply real NTFS ACLs to credential files/backups.
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $system = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
    foreach ($name in @('.env','.connection.json','.setup-state.json','.config-backups')) {
        $target = Join-Path $script:ProjectRoot $name
        if (-not (Test-Path -LiteralPath $target)) { continue }
        try {
            $item = Get-Item -LiteralPath $target -Force
            $acl = Get-Acl -LiteralPath $target
            $acl.SetAccessRuleProtection($true,$false)
            foreach ($rule in @($acl.Access)) { [void]$acl.RemoveAccessRuleSpecific($rule) }
            foreach ($identity in @($sid,$system)) {
                if ($item.PSIsContainer) {
                    $rule = [Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
                } else {
                    $rule = [Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','Allow')
                }
                $acl.AddAccessRule($rule)
            }
            Set-Acl -LiteralPath $target -AclObject $acl
        } catch { throw 'Tidak dapat membatasi akses file konfigurasi. Gunakan folder milik Anda pada NTFS dan minta IT memeriksa hak akses; jangan simpan kredensial pada folder publik/USB tanpa ACL.' }
    }
}
