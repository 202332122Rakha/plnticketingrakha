# PLN Ticketing — PostgreSQL / Laragon

**Paket 1.2.0 · 2 November 2026.** Aplikasi React/TypeScript + Express yang menggunakan PostgreSQL untuk data operasional. Laragon membantu menyediakan Node.js pada Windows; aplikasi ini bukan aplikasi PHP/MySQL.

**Mulai dari `MULAI-DI-SINI.txt`.** Klik `MULAI-PLN-TICKETING.bat` untuk setup pertama sekaligus start, atau gunakan satu launcher PowerShell di bawah. Konfigurasi dilakukan melalui prompt tanpa mengedit kode sumber.

## Status yang dapat dipastikan

`npm run check` lulus di lingkungan penyusunan: 109 tes backend, 8 tes frontend, pemeriksaan TypeScript, dan sintaks 38 file JavaScript. Namun **Windows/PowerShell, Laragon, build Vite pada Windows, dan koneksi PostgreSQL/SSH sungguhan belum dapat diuji di lingkungan ini**. Build Linux menggunakan dependensi Windows dari unggahan gagal karena native binding Linux tidak tersedia; unduhan dependensi terblokir. ZIP tidak membawa `dist` atau `node_modules` yang belum terverifikasi. Instalasi, pemeriksaan PowerShell, build dan pemeriksaan PostgreSQL dijalankan di komputer tujuan, dan kegagalan menghentikan proses. Rincian: `HASIL_PENGUJIAN.md`.

Server `10.10.23.26` belum diakses atau diubah. Paket ini **tidak menjamin semua jaringan/OS bebas masalah**, tetapi menghindari kebutuhan mengedit source untuk pengaturan server, port dan kredensial.

## 1. Prasyarat

- Windows PowerShell 5.1 atau lebih baru; Node.js minimal 22.12.0 dengan npm. Launcher mencari Node.js pada Laragon di C:/D:, Laragon yang menaungi folder proyek, `LARAGON_ROOT`, atau PATH. Instalasi pertama memerlukan akses registry npm/proxy yang diizinkan IT.
- Server PostgreSQL minimal 14, database khusus aplikasi dan role aplikasi yang disiapkan DBA. Role tidak perlu superuser/CREATEDB. Untuk menjalankan migrasi, gunakan owner database/skema aplikasi; sesudah itu hak runtime dapat dikelola DBA.
- Mode Tunnel: OpenSSH Client Windows, akses jaringan/VPN kantor, port SSH dan izin TCP forwarding pada server. Alamat dan akun SSH default: `10.10.23.26` / `webadmin2`.
- Mode Local: service PostgreSQL Laragon harus tersedia dan berjalan. Menyalakan MySQL tidak menggantikannya.

Laragon mendokumentasikan penambahan Node.js/PostgreSQL melalui **Tools → Quick add**. Node dari Laragon dapat dipakai tanpa mengubah PATH permanen karena launcher menambahkan folder runtime hanya ke prosesnya. Rujukan resmi: https://laragon.org/docs/quick-add dan https://laragon.org/docs/isolated.

## 2. Penempatan folder dan satu perintah

Ekstrak ke folder baru, misalnya:

```text
C:\laragon\projects\PLN_Ticketing_PostgreSQL_Laragon
```

**Jangan menaruh sumber di `www` atau document root Apache/Nginx.** Folder sumber akan memuat `.env` dan backup konfigurasi rahasia. `.htaccess` penolak akses ikut disediakan sebagai lapisan tambahan, bukan pengganti penempatan yang aman; Nginx tidak memakai `.htaccess`.

```powershell
cd "C:\laragon\projects\PLN_Ticketing_PostgreSQL_Laragon"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\JALANKAN-TICKETING.ps1
```

Flag kebijakan hanya berlaku pada proses tersebut; patuhi kebijakan IT. Alternatif setara: klik dua kali **`MULAI-PLN-TICKETING.bat`**.

Laragon pada lokasi lain:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\JALANKAN-TICKETING.ps1 -LaragonRoot "D:\Tools\Laragon"
```

Untuk akun Windows biasa, gunakan folder yang dapat Anda tulis. File kredensial dibatasi melalui ACL Windows kepada akun saat ini dan SYSTEM. Gunakan penyimpanan NTFS; media tanpa dukungan ACL ditolak bila pengamanan tidak dapat diterapkan. Jangan menjalankan sebagai administrator hanya untuk mengatasi kesalahan konfigurasi.

## 3. Konfigurasi pertama

Launcher memasang dependensi, menjalankan pemeriksaan kode/PowerShell, membangun frontend, lalu meminta konfigurasi. Gunakan **Tunnel** untuk skenario berikut:

```text
Browser laptop → Node/Express laptop → SSH tunnel → PostgreSQL server
```

| Pertanyaan | Default / penjelasan |
|---|---|
| Mode | Tunnel |
| Server SSH | 10.10.23.26 |
| Akun SSH | webadmin2 |
| Port SSH | 22; konfirmasi kepada IT |
| Host PostgreSQL dari sisi server SSH | 127.0.0.1 jika service PostgreSQL satu server; jika terpisah, gunakan alamat dari DBA |
| Port PostgreSQL server | 5432; konfirmasi kepada DBA |
| Port tunnel laptop | 15432, tidak sama dengan port service PostgreSQL lokal |
| Port HTTP aplikasi | 4000 |
| Database / user PostgreSQL | Nama sebenarnya dari DBA; contoh pln_ticketing / ticketing_app |
| TLS database | N untuk tunnel bila server mengizinkan; Y bila server mewajibkan TLS |

**Password PostgreSQL berbeda fungsi dari password SSH.** Password PostgreSQL masuk melalui prompt tersembunyi dan disimpan pada `.env` backend. Password SSH diminta oleh OpenSSH di jendela tersendiri dan tidak disimpan oleh aplikasi.

Jangan mengirim password ke chat. `.connection.json` hanya menyimpan mode dan alamat/port, bukan password. Tidak ada kredensial database pada variabel `VITE_*`.

Bila TLS diperlukan, isi path CA dan, bila koneksi melalui tunnel memerlukan pencocokan sertifikat DNS server, nama DNS pada sertifikat. Pemeriksaan sertifikat tetap aktif; jangan mematikan validasi sertifikat agar koneksi terlihat berhasil. Rujukan driver: https://node-postgres.com/features/ssl.

## 4. Tunnel, tabel, dan admin

Jendela SSH dibuka otomatis. Konfirmasikan fingerprint kepada IT pada koneksi pertama; jangan mengabaikan fingerprint yang berubah. Selesaikan login SSH di jendela itu dan biarkan tetap terbuka.

Launcher menguji login PostgreSQL secara terpisah. Setelah ringkasan target ditampilkan, ketik **`SIAPKAN`** untuk mengizinkan migrasi dan master awal. Penyiapan menolak database pemeliharaan (`postgres`, `template0`, `template1`) serta database nonkosong yang tidak memiliki skema Ticketing yang dikenali. Tidak ada `DROP DATABASE`, reset tabel, atau reset password otomatis.

Admin pertama dibuat melalui prompt identitas dan password pribadi. Admin aktif yang sudah ada tidak dibuat ulang. `db:seed` hanya menambahkan master awal yang belum ada; tidak membuat tiket atau pengguna demo.

Pemeriksaan `db:ready` memverifikasi PostgreSQL/version, checksum migrasi, tabel/kolom penting, hak akses, admin aktif dan roundtrip INSERT/SELECT/UPDATE/DELETE pada **tabel sementara**, lalu rollback. Ini bukan pengganti uji alur aplikasi lengkap.

Setelah API health dan halaman hasil build tersedia, browser terbuka pada **http://127.0.0.1:4000** atau port pilihan Anda. Login dengan admin yang tadi dibuat. Tidak menggunakan Vite development server pada jalur launcher normal.

## 5. Pengoperasian berikutnya

Klik `MULAI-PLN-TICKETING.bat`. Konfigurasi tetap digunakan dan tunnel dibuka kembali. Perubahan source/dependensi/output build memicu pemeriksaan/build ulang. Start biasa tidak melakukan migrasi/seed bila setup sebelumnya sudah tercatat. Bila versi sumber memerlukan migrasi, jalankan Setup secara eksplisit.

Biarkan PowerShell dan jendela SSH terbuka. Ctrl+C menghentikan proses milik launcher; service Laragon atau server kantor tidak dimatikan. Jika SSH putus, launcher menghentikan aplikasi agar tidak menampilkan seolah koneksi masih sehat; jalankan kembali setelah jaringan pulih. Data yang sudah committed berada di PostgreSQL.

| Tujuan | Perintah dari folder aplikasi |
|---|---|
| Setup/pemeriksaan ulang skema | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\JALANKAN-TICKETING.ps1 -Action Setup` |
| Ubah server/port/password | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\JALANKAN-TICKETING.ps1 -Action Configure` |
| Cek koneksi baca-saja | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\JALANKAN-TICKETING.ps1 -Action Check` |
| Pasang ulang dependensi lalu setup | Tambahkan `-Reinstall` pada perintah Setup |
| Tidak membuka browser otomatis | Tambahkan `-NoBrowser` pada Start |

Tutup launcher/tunnel lama sebelum menjalankan Check/Setup lain. Port tunnel yang dipakai proses lain tidak direbut atau dipakai ulang secara diam-diam. Untuk pemeriksaan saat aplikasi sedang berjalan, buka `/api/health` pada alamat aplikasi tersebut.

Configure meminta konfirmasi `GANTI`, mencadangkan konfigurasi lama di `.config-backups`, dan menandai setup perlu diperiksa kembali. Tidak menghapus data database. Backup konfigurasi juga memuat kredensial lama; lindungi dan hapus sesuai kebijakan perusahaan setelah tidak diperlukan.

## 6. PostgreSQL lokal di Laragon

Tambahkan dan jalankan **PostgreSQL**, bukan MySQL, pada Laragon. DBA dapat menggunakan `database/PERSIAPAN_DBA.psql` melalui `psql` untuk membuat role/database contoh secara non-destruktif. Untuk database lokal pilih mode **Local**, host `127.0.0.1`, port PostgreSQL yang benar. Untuk memindah konfigurasi ke kantor, gunakan Configure lalu mode Tunnel. **Berganti koneksi tidak memigrasikan/menyinkronkan data lama.**

## 7. Masalah yang tidak diselesaikan dengan mengganti source

| Gejala | Tindakan |
|---|---|
| SSH timeout | Periksa jaringan/VPN, IP, port SSH dan izin akses dengan IT. Belum sampai tahap password/database. |
| Fingerprint berubah | Hentikan koneksi dan verifikasi kepada IT; jangan menghapus known_hosts secara otomatis. |
| Permission denied pada SSH | Periksa akun/password/key SSH dan kebijakan server; bukan password PostgreSQL. |
| Port lokal terpakai | Tutup tunnel/launcher lama atau pilih port lain melalui Configure. |
| PostgreSQL menolak password | Minta akun database yang benar, lalu Configure. |
| Database belum ada/hak kurang | DBA menyiapkan database/role/owner; template psql disediakan. |
| npm gagal akses registry | Gunakan akses/proxy registry yang disetujui IT; jangan `strict-ssl=false`. |
| TLS certificate mismatch | Cocokkan CA dan nama DNS sertifikat melalui Configure; jangan mematikan verifikasi. |
| Database nonkosong tak dikenali | Jangan memaksa migrasi; gunakan database khusus atau minta DBA memeriksa. |
| Browser tidak membuka otomatis | Buka alamat HTTP yang dicetak terminal. |

## 8. Data lama, penerimaan, dan penggunaan bersama

Data operasional MySQL/browser lama **tidak ikut dalam ZIP sumber**. Ikuti `MIGRASI_DATA_LAMA.md` dan jangan hapus penyimpanan lama sebelum data direkonsiliasi. Skema PostgreSQL bukan konversi otomatis semua file dump MySQL.

Sebelum operasional, lakukan checklist pada `HASIL_PENGUJIAN.md`: login tiap peran, buat tiket/lampiran, assignment, komentar, perubahan status, restart/persistensi, backup/restore, dan pemeriksaan hak akses.

Paket launcher ini menjalankan **aplikasi pada laptop** dengan **database pada server**. Penggunaan bersama dari browser pengguna lain memerlukan hosting API/frontend yang disetujui IT, HTTPS dan pengaturan akses; lihat `DEPLOYMENT_POSTGRESQL.md`. Jangan membagikan `localhost`, membuka firewall sembarangan, atau mengubah bind ke `0.0.0.0` hanya agar terlihat online.
