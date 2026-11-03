# Hasil pengujian PLN Ticketing — PostgreSQL / Laragon

**Paket:** 1.2.0
**Tanggal:** 2 November 2026
**Status:** paket sumber dan launcher tersedia; **belum merupakan rilis produksi yang telah diverifikasi end-to-end pada Windows dan server kantor**.

## 1. Hasil aktual, bukan perkiraan

| Pemeriksaan | Hasil | Batas bukti |
|---|---|---|
| `npm run check` | LULUS | Rangkaian pemeriksaan di Linux pada sumber yang dikirim. |
| Tes backend | 109 lulus, 0 gagal | Konfigurasi, transaksi/HTTP pada batas yang diuji, validasi, sesi, izin, assignment, kesiapan database dan receipt build. Dependensi database pada tes unit diganti dengan test double. |
| Tes frontend | 8 lulus, 0 gagal | Kontrak layanan frontend dan perilaku gagal tanpa membuat data lokal palsu; bukan pengujian semua halaman di browser. |
| TypeScript | LULUS | `tsc --noEmit` dengan TypeScript 5.8.3. |
| Sintaks JavaScript | 38 file lulus | Parsing file JavaScript, bukan eksekusi semua cabang. |
| `npm run build` di lingkungan penyusunan | GAGAL | Binding native Rolldown Linux tidak tersedia. Dependensi unggahan berasal dari Windows; modul native tidak dapat digunakan lintas platform. Ini belum membuktikan build Windows akan berhasil. |
| Instalasi dependensi baru | BELUM TERVERIFIKASI | Percobaan instalasi dibatasi waktu dan tidak selesai; akses unduhan/npm tidak tersedia di lingkungan ini. Tidak ada lockfile baru yang diklaim terverifikasi. |
| Parser/eksekusi PowerShell 5.1 dan Laragon | BELUM DIJALANKAN | PowerShell/Windows/Laragon tidak tersedia. Script ditinjau manual; pemeriksaan parser dan helper TCP disediakan untuk dijalankan di komputer tujuan. |
| PostgreSQL sungguhan, migrasi dan API integrasi | BELUM DIJALANKAN | Tidak tersedia service PostgreSQL/psql di lingkungan ini. Hasil test double tidak diklaim sebagai hasil SQL nyata. |
| SSH dan database `10.10.23.26` | BELUM DIUJI | Server kantor tidak diakses/diubah; kredensial database dan jalur jaringan tidak tersedia. |
| Uji UI browser lengkap, beban, backup/restore, dan audit keamanan | BELUM DIJALANKAN | Wajib dilakukan sesuai kebutuhan operasional/IT sebelum penggunaan produksi. |

**Total tes otomatis yang benar-benar lulus: 117 (109 backend + 8 frontend).** Log pemeriksaan terakhir disertakan pada `docs/verification-laragon/check.log`. Log kegagalan build juga disertakan agar keterbatasannya dapat diperiksa.

## 2. Perbaikan yang memiliki tes regresi

Tes baru ditulis dan dijalankan gagal sebelum implementasi/perbaikan, lalu dijalankan kembali hingga lulus. Area yang diuji meliputi:

- Profil koneksi hanya berisi konfigurasi nonrahasia; host/port dan pilihan mode divalidasi. Mode tunnel menolak endpoint `.env` yang berbeda dari port tunnel, dan koneksi jaringan Direct membutuhkan TLS.
- Password dengan karakter khusus serta path CA Windows yang mengandung spasi, tanda pagar dan apostrof ditulis tanpa perubahan makna. Nama sertifikat TLS dapat diisi tanpa mematikan validasi sertifikat.
- Penggantian konfigurasi membutuhkan tindakan eksplisit, membuat backup, tidak menimpa diam-diam, dan membatalkan status setup lama. Pergantian target database merotasi session secret; target yang sama mempertahankan secret valid.
- Migrasi menolak database pemeliharaan, database nonkosong tanpa ledger Ticketing, dan tabel asing yang tidak dikenali. Migrasi SQL 001/002 dari paket PostgreSQL sebelumnya tidak diubah.
- Pemeriksaan kesiapan menolak versi/schema/checksum/izin/admin yang tidak sesuai. Uji tulis memakai tabel sementara dalam transaksi yang di-rollback, bukan mengubah tiket operasional.
- Receipt build menjadi tidak valid bila sumber, hasil build, runtime atau versi dependensi berubah. Receipt bukan bukti koneksi database dan bukan tanda tangan keamanan.

## 3. Gerbang pemeriksaan pada komputer tujuan

Jalur normal `MULAI-PLN-TICKETING.bat` / `JALANKAN-TICKETING.ps1` dirancang menjalankan tahapan berikut:

1. Mencari Node.js yang memenuhi versi paket dan npm pada Laragon/PATH.
2. Memasang dependensi untuk platform Windows, menjalankan parser/tes helper PowerShell, tes kode, TypeScript dan build Vite. Kegagalan menghentikan setup sebelum migrasi.
3. Meminta konfigurasi melalui prompt lokal dan membatasi akses file konfigurasi melalui ACL Windows.
4. Membuka proses SSH tunnel milik launcher, tanpa mematikan atau memakai ulang port proses lain secara diam-diam.
5. Memastikan login PostgreSQL berhasil. Meminta `SIAPKAN` sebelum migrasi/master awal. Menolak database asing yang tidak dikenali.
6. Membuat admin pertama bila belum ada; tidak mereset password admin aktif.
7. Menjalankan `db:ready`: versi, checksum migrasi, tabel/kolom penting, izin, admin dan roundtrip data pada tabel sementara.
8. Menjalankan backend beserta frontend hasil build, memeriksa health API dan halaman HTTP, kemudian membuka browser.

**Tahapan di atas adalah perilaku yang diimplementasikan, bukan catatan bahwa semua tahapan sudah berhasil di Windows.** Saat jaringan, tool, sertifikat, hak akses atau akun tidak sesuai, launcher harus berhenti dengan pesan kegagalan. Pemeriksaan health tidak menggantikan uji setiap alur bisnis.

## 4. Checklist penerimaan sebelum operasional

| Uji | Kriteria diterima | Status pada komputer/server Anda |
|---|---|---|
| Setup bersih di folder baru | Instalasi, tes dan build selesai dengan exit 0; tidak memakai `dist` lama. | Belum diuji |
| SSH | Fingerprint diverifikasi IT; tunnel aktif pada port yang dipilih. | Belum diuji |
| PostgreSQL | `db:ready` menghasilkan `ok: true`, database yang benar, dan `writeProbe: passed`. | Belum diuji |
| Admin | Akun pertama dapat login/logout dan tidak ada password demo aktif. | Belum diuji |
| Hak akses | Pelapor/PIC/manajemen tidak dapat mengakses operasi admin atau tiket di luar kewenangannya. | Belum diuji |
| Tiket dan lampiran | Buat tiket, unggah/unduh lampiran, dan cocokkan isinya. | Belum diuji |
| Penugasan | PIC, prioritas, riwayat dan notifikasi sesuai tindakan serta cakupan unit. | Belum diuji |
| Komentar dan status | Perubahan tercatat dan alur status/tiket tertutup sesuai aturan. | Belum diuji |
| Persistensi | Tutup aplikasi, mulai ulang, data tetap ada pada PostgreSQL. | Belum diuji |
| Kegagalan | Password salah, tunnel putus, port terpakai dan database tidak tersedia tidak dilaporkan sebagai sukses. | Belum diuji |
| Backup/restore | Backup yang dibuat DBA dapat dipulihkan pada database uji dan direkonsiliasi. | Belum diuji |

## 5. Runner integrasi PostgreSQL terpisah

`npm run test:integration` tersedia untuk database PostgreSQL **kosong, terpisah dari operasional, dan bernama dengan akhiran `_test`**. Runner menolak berjalan tanpa `ALLOW_INTEGRATION_TEST=YES`, `TEST_DATABASE_URL` yang sesuai, dan database kosong. Pemeriksaan penolakannya sudah diuji. Jangan menetapkan URL database kantor yang sedang dipakai.

Runner dirancang menguji migrasi dua kali, seed dua kali tanpa reset password, rollback transaksi dan alur API. **Suite integrasi ini belum dijalankan dengan PostgreSQL nyata di lingkungan penyusunan.** Ia menulis data uji pada database uji dan tidak menghapus database otomatis. DBA perlu menyiapkan dan kemudian mengelola database uji tersebut. Jangan menempel URL berpassword dalam riwayat PowerShell atau mengirimkannya ke chat.

## 6. Peninjauan dan keputusan

Peninjauan akhir dilakukan oleh pembuat paket sendiri, terpisah dari tahap implementasi; tidak ada reviewer independen/subagent yang tersedia. Ini lebih terbatas daripada code review independen. Perbaikan hasil review mencakup penolakan ledger pada database bertabel asing, invalidasi status setup setelah perubahan konfigurasi, rotasi session secret saat target database berubah, dan dukungan nama DNS sertifikat TLS. Tes regresinya lulus.

Keputusan paket:

- Aplikasi berjalan pada laptop dan terikat ke loopback, database di server melalui tunnel. Konsekuensi: belum menjadi hosting aplikasi bersama/publik.
- Laragon digunakan sebagai penyedia Node.js; tidak ada perubahan ke PHP/MySQL atau instalasi otomatis service server.
- Database/akun disiapkan DBA. Launcher tidak meminta hak superuser atau menganggap akun SSH sebagai role PostgreSQL.
- Folder sumber di bawah `www` ditolak untuk mengurangi risiko menyajikan kredensial lewat web server lain. Gunakan folder baru di `projects` atau Downloads.
- ZIP tidak berisi `.env`, password, `node_modules`, `dist` lama atau database operasional. Instalasi pertama membutuhkan akses registry npm/proxy yang disetujui IT; build dilakukan pada komputer tujuan.
- Tidak ada konversi otomatis data operasional lama tanpa export sumber. Simpan database dan penyimpanan browser lama hingga migrasi dan rekonsiliasi selesai.

Tidak ada perubahan source tambahan yang sengaja ditunda sebagai temuan minor. **Batas instalasi/build, Windows, SQL nyata dan koneksi server di atas tetap terbuka**, bukan dinyatakan lulus karena tes unit berhasil.
