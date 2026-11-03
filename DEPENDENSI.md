# Dependensi dan pemasangan

Versi dependensi langsung dipatok pada package.json. Runtime PostgreSQL menggunakan `pg` 8.16.3, bukan mysql2. Node minimal 22.12.0. TypeScript yang dipakai pemeriksaan adalah 5.8.3.

ZIP tidak menyertakan node_modules, runtime Node/Laragon, installer PostgreSQL, atau binary native yang hanya cocok pada komputer pembuat. Ini menghindari membawa paket Windows/Linux yang salah serta konfigurasi/rahasia dari mesin lain.

Pemasangan pertama menjalankan npm install dan menghasilkan package-lock.json pada komputer tujuan. **Lockfile baru dari registry belum dapat dibuat/diverifikasi dalam lingkungan penyusunan yang tidak memiliki akses unduh.** Setelah lock tersedia, launcher memakai npm ci untuk pemasangan ulang. Tidak ada klaim bahwa seluruh dependency transitif telah diaudit atau instalasi bersih telah terbukti berhasil dari lingkungan ini.

Gunakan registry/proxy yang disetujui IT. Jangan menonaktifkan TLS npm atau menggunakan paket acak dari sumber tidak dikenal untuk mengatasi error jaringan. Sebelum operasional, IT perlu meninjau hasil npm audit dan menyimpan lockfile yang telah lulus build/penerimaan.

Bila Node dari Laragon tidak ditemukan: Tools > Quick add > Node.js, atau berikan -LaragonRoot. Launcher hanya mengubah PATH proses, tidak PATH Windows permanen. PostgreSQL pada Laragon diperlukan hanya untuk mode Local atau penggunaan client DBA; untuk mode Tunnel, database berada di server.
