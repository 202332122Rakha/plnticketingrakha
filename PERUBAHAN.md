# Perubahan paket 1.2.0

Dasar: revisi PostgreSQL 1.1.0 yang disertakan dalam percakapan. Source UI/fitur bisnis tidak didesain ulang.

- Launcher tunggal PowerShell/BAT untuk setup pertama dan start berikutnya; mode Tunnel/Local/Direct.
- Pencarian Node.js Laragon/PATH, npm melalui entrypoint JS, pemasangan dependensi, tes, build dan pemeriksaan PowerShell pada Windows tujuan.
- SSH tunnel dikelola otomatis dengan default 10.10.23.26/webadmin2; password SSH tidak disimpan; port konflik tidak direbut.
- Aplikasi melayani hasil build pada satu endpoint HTTP loopback, default port 4000, dengan health check sebelum browser dibuka.
- Profil nonsecret terpisah dari .env; konfigurasi dapat diganti dengan backup, tanpa mengedit source.
- Perbaikan CA path berkarakter khusus; dukungan nama sertifikat TLS melalui tunnel; verifikasi sertifikat tetap aktif.
- Pengaturan lingkungan shell yang kedaluwarsa tidak mengalihkan target database pada launcher.
- Proteksi NTFS untuk konfigurasi, penolakan source di folder www, dan .htaccess penolak akses sebagai lapisan tambahan.
- Penolakan migrasi ke database pemeliharaan dan skema aplikasi lain; migrasi SQL lama tidak diubah.
- Perintah db:ready untuk checksum migrasi, tabel, kolom penting, hak akses, admin dan roundtrip tabel sementara/rollback.
- Build receipt mendeteksi perubahan sumber, output, versi runtime/dependensi; tidak mengandung kredensial.
- Secret sesi diganti bila target database berubah; penggantian konfigurasi memerlukan pemeriksaan setup kembali.
- Panduan Laragon/PowerShell, template psql DBA tanpa password default, dan laporan pengujian aktual.

Tidak dilakukan: akses/deployment pada server kantor; migrasi data operasional lama; instalasi bersih/build Windows/PowerShell nyata; tes PostgreSQL nyata, browser end-to-end, beban dan audit keamanan independen. Lihat HASIL_PENGUJIAN.md.
