# Pemindahan data lama ke PostgreSQL

## Yang sudah dan belum dilakukan

Kode aplikasi, koneksi, skema tabel dan jalur baca/tulis telah direvisi untuk PostgreSQL. **Data dari MySQL, data browser/localStorage lama, serta berkas lampiran lama belum dipindahkan.** ZIP sumber tidak berisi salinan database operasional yang dapat divalidasi.

Skrip `db:migrate` membuat/memperbarui **skema PostgreSQL**. Skrip tersebut bukan alat impor otomatis dump MySQL. File SQL MySQL tidak boleh langsung dijalankan pada PostgreSQL. Jangan menghapus MySQL, folder lampiran, profil browser, atau data browser aplikasi lama sebelum rekonsiliasi selesai.

## Tahapan bersama DBA/pemilik aplikasi

1. Inventarisasi sumber: database MySQL yang benar, tabel/kolom, jumlah baris, versi skema, penyimpanan lampiran, serta data admin yang mungkin hanya tersimpan pada browser lama. Buat backup utuh yang dapat dipulihkan. Simpan di lingkungan kantor, bukan chat.
2. Ekspor data lokal dari aplikasi/browser lama melalui prosedur yang disetujui sebelum browser dibersihkan. Kode lama menyimpan sebagian perubahan admin secara lokal; hal itu tidak otomatis ada pada dump MySQL.
3. Buat database PostgreSQL **staging baru**. Terapkan skema dari paket ini. Jangan menjalankan seed dulu bila semua master akan diimpor dengan ID lama; rencanakan penggabungan master supaya tidak duplikat kode.
4. Buat pemetaan kolom dan transformasi, lalu impor secara terkontrol dengan transaksi/batch dan pencatatan jumlah baris. Pertahankan ID dan hubungan antartabel; jangan membangkitkan ID baru tanpa memetakan seluruh foreign key.
5. Rekonsiliasi data dan jalankan uji penerimaan. Matikan sementara penulisan ke sistem lama pada jendela cutover yang disetujui, ambil delta/final snapshot, impor, lalu validasi ulang.
6. Ubah konfigurasi backend ke database yang lolos pemeriksaan. Pertahankan backup/release lama dan rencana rollback yang jelas. Jangan menjalankan dua sistem aktif yang menulis data berbeda tanpa mekanisme sinkronisasi.

## Pemetaan penting

| Data | Penanganan |
|---|---|
| ID string | Skema mempertahankan VARCHAR(36); periksa panjang dan referensi. |
| is_active / is_read | SMALLINT 0/1 dengan CHECK untuk kompatibilitas API lama; bukan bebas nilai. |
| Email/username/NIP/kode | Indeks case-insensitive menolak duplikat berbeda kapitalisasi. Selesaikan duplikat dengan pemilik data sebelum impor. |
| Password | Hash bcrypt yang valid dapat dipertahankan. Jangan mengganti dengan password sama untuk seluruh akun dan jangan ekspor plaintext. Hash berbeda memerlukan prosedur reset terotorisasi. |
| Waktu | PostgreSQL menggunakan TIMESTAMPTZ. Tentukan zona waktu kolom lama sebelum konversi; jangan menganggap DATETIME lama otomatis UTC. |
| JSON berbentuk teks | expertise, subcategories, tags tetap berupa teks JSON yang divalidasi/parser frontend; pastikan JSON sah. |
| Status | Cocokkan nilai enum/CHECK. Jangan otomatis mengganti status tak dikenal menjadi aktif/selesai. |
| Lampiran | Skema baru menyimpan metadata dan file_content BYTEA. storage_path lama saja tidak berisi file; berkas asal perlu dipetakan dan diimpor. Maksimum upload baru 10 MB per file. |
| Riwayat/audit | Pertahankan urutan waktu, aktor dan referensi tiket. Audit aplikasi bukan ledger kriptografis yang mustahil diubah DBA. |
| Sesi | Sesi lama tidak dipindahkan. SESSION_SECRET baru dan auth_version mengharuskan login ulang. |

Urutan referensi umum: units -> users -> ticket_categories / sla_configs -> registration_requests -> tickets -> ticket_comments / ticket_attachments / ticket_status_history / pic_assignments / notifications / audit_logs / assignment_rules. Sesuaikan baris yang mempunyai relasi silang; jangan menonaktifkan constraint produksi secara membabi buta.

## Rekonsiliasi minimum

Hitung baris per tabel serta per status/unit/prioritas, cek tiket tanpa pelapor/unit/kategori/PIC yang tidak seharusnya, cocokkan sampel riwayat, dan bandingkan ukuran/checksum lampiran. Uji login setiap peran, pendaftaran/persetujuan, pembuatan tiket, komentar publik/internal, penugasan, perubahan status, notifikasi, kategori, SLA, dan pembatasan akses lintas pengguna/unit. Lakukan restart layanan lalu cek data tetap tersedia. Jalankan simulasi backup/restore ke database terpisah.

## Rollback

Jika validasi gagal sebelum cutover, sistem lama tetap menjadi sumber resmi. Jika kegagalan terjadi sesudah sistem baru menerima penulisan, jangan sekadar mengganti .env ke database lama: ekspor/rekonsiliasi perubahan baru terlebih dahulu agar tiket yang baru dibuat tidak hilang. Keputusan cutover/rollback milik pemilik layanan dan DBA.
