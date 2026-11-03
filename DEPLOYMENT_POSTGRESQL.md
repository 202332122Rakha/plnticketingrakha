# Penyiapan DBA dan deployment

## Ruang lingkup paket

Launcher Windows menjalankan Node/Express pada laptop melalui runtime Laragon, sedangkan PostgreSQL dapat berada di server kantor. Ini **bukan** installer yang otomatis mengubah server `10.10.23.26`, memasang PostgreSQL melalui SSH, atau menerbitkan aplikasi ke internet.

## Informasi yang diperlukan dari IT/DBA

Konfirmasikan host/port SSH, akun SSH dan fingerprint; lokasi host PostgreSQL dari sisi server SSH; port PostgreSQL; nama database khusus aplikasi; role/password PostgreSQL; kewajiban TLS dan CA/nama sertifikat. Akun SSH `webadmin2` tidak otomatis memiliki role PostgreSQL atau akses sudo.

Untuk default launcher, DBA menyiapkan `pln_ticketing` dan `ticketing_app`. Jalankan template `database/PERSIAPAN_DBA.psql` hanya menggunakan akun DBA yang berwenang melalui psql. File tersebut tidak membawa password default, tidak menghapus database, dan tidak mengganti password role yang sudah ada. Periksa owner/privilege jika objek sudah ada.

Contoh dari PowerShell **di komputer yang memiliki psql**:

```powershell
psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -W -f .\database\PERSIAPAN_DBA.psql
```

Perintah ini untuk administrasi PostgreSQL lokal; sesuaikan host/port/akun DBA. Untuk server Linux yang memang mengizinkan sudo, DBA dapat menjalankan psql di server dengan hak yang sesuai. Jangan mengasumsikan setiap server menggunakan systemd atau akun OS `postgres`.

Role aplikasi harus mampu menjalankan migrasi pada skema `public`; owner database aplikasi pada penyiapan baru merupakan pola sederhana. Tidak perlu memberi role aplikasi SUPERUSER/CREATEDB. Setelah setup, DBA dapat memisahkan role migrasi dan role runtime dengan grant yang sesuai. Readiness runtime memeriksa SELECT/INSERT/UPDATE/DELETE pada tabel aplikasi, pembacaan ledger migrasi dan TEMP untuk uji sementara.

## SSH tunnel

Launcher membentuk forward loopback:

```text
127.0.0.1:15432 pada laptop → 127.0.0.1:5432 dari sisi server SSH
```

Host PostgreSQL di sisi server dapat diganti lewat Configure. `ExitOnForwardFailure`, connection timeout dan keepalive dipakai. Port forward hanya bind loopback. Kebijakan SSH server harus mengizinkan forwarding ke target; konfigurasi tersebut merupakan keputusan IT, bukan diubah oleh paket.

Menutup aplikasi juga menutup tunnel milik launcher. Tidak ada perubahan firewall atau pembukaan port PostgreSQL ke internet. SSH dan PostgreSQL memiliki proses autentikasi masing-masing.

## Koneksi TLS langsung

Mode Direct memerlukan TLS untuk database non-loopback. Isi sertifikat CA dari DBA bila CA tidak dipercaya sistem. Bila nama yang dipakai untuk koneksi tidak sama dengan nama sertifikat, isi nama DNS sertifikat dalam prompt; jangan menggunakan `rejectUnauthorized=false`. Variabel yang disimpan backend: `DB_SSL`, `DB_SSL_CA`, `DB_SSL_SERVERNAME`. Driver menggunakan `pg`; kredensial tidak masuk bundle browser.

## Hosting aplikasi pada server (pekerjaan IT terpisah)

Untuk akses banyak pengguna melalui satu URL, lakukan penerimaan pada staging dan host API/frontend pada server berwenang. Template `deploy/pln-ticketing.service.example` dan `deploy/nginx.conf.example` adalah contoh **Linux**, bukan perintah untuk terminal PowerShell lokal. Sesuaikan user service, lokasi Node, direktori aplikasi, hostname dan sertifikat aktual; jangan menyalin tanpa peninjauan.

Garis besar: tempatkan source di luar document root, pasang dependensi bersih, jalankan `npm run check`, `npm run build`, migrasi yang telah ditinjau, dan buat admin lokal bila belum ada. Uji `npm run db:ready`, kemudian jalankan Node sebagai service berhak minimum. Gunakan HTTPS pada reverse proxy. Untuk mode produksi, konfigurasi `NODE_ENV=production`, `SESSION_SECRET` acak minimal 32 karakter, `CLIENT_URL` origin HTTPS sebenarnya, dan `TRUST_PROXY=loopback` hanya jika reverse proxy memang berada pada host yang sama. Jangan memakai `.env` development laptop tanpa penyesuaian.

Akun Windows service bersama dan URL publik berada di luar launcher single-user ini; ACL file perlu disesuaikan hanya kepada identity service yang berhak. Gunakan kontrol akses jaringan dan audit perusahaan.

## Backup dan perubahan skema

Backup PostgreSQL dengan `pg_dump` menggunakan versi client yang kompatibel dengan server dan uji restore di database terpisah. Cadangkan `.env`/session secret dengan mekanisme penyimpanan rahasia perusahaan; ekspor laporan admin bukan backup database. Jangan menyimpan dump di document root atau mengunggahnya ke chat.

Migrasi disimpan di `server/migrations`. File yang telah diterapkan tidak boleh diedit; checksum akan menolak perubahan. Tambahkan migrasi baru untuk perubahan berikutnya. Runner menolak database pemeliharaan atau skema lain yang tidak dikenal. Tidak ada flag paksa reset dalam launcher.

Data MySQL/browser lama memerlukan ekstraksi dan pemetaan tersendiri, bukan menjalankan dump MySQL langsung pada PostgreSQL. Tidak ada data operasional lama yang diimpor oleh paket ini.

Rujukan resmi:
- https://node-postgres.com/features/connecting
- https://node-postgres.com/features/ssl
- https://www.postgresql.org/docs/current/app-pgdump.html
- https://laragon.org/docs/quick-add
