import pg from 'pg';
import readline from 'node:readline';
import { dbConfig, pool } from './db.js';
import { databaseErrorMessage } from './config.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

const targetDb = dbConfig.database;

async function resetDatabase() {
  console.log('===============================================================');
  console.log('       PERINGATAN: RESET TOTAL DATABASE PLN TICKETING          ');
  console.log('===============================================================');
  console.log(`Target Database: "${targetDb}" di ${dbConfig.host}:${dbConfig.port}`);
  console.log('Tindakan ini akan MENGHAPUS SEMUA TABEL, DATA TIKET, PENGGUNA,');
  console.log('dan membangun ulang skema + master data baru secara bersih.');
  console.log('===============================================================');

  const confirm = await ask(`Ketik nama database "${targetDb}" untuk konfirmasi penghapusan: `);
  if (confirm.trim() !== targetDb) {
    console.log('[BATAL] Konfirmasi tidak sesuai. Penghapusan database dibatalkan.');
    rl.close();
    await pool.end();
    process.exit(0);
  }

  rl.close();

  console.log(`\n[1/3] Menghubungkan ke PostgreSQL maintenance database...`);
  const maintenanceDb = process.env.DB_MAINTENANCE_DATABASE || 'postgres';
  const adminClient = new pg.Client({
    ...dbConfig,
    database: maintenanceDb,
  });

  try {
    await adminClient.connect();

    console.log(`[2/3] Memutuskan koneksi aktif ke "${targetDb}" dan menghapus database...`);
    // Putuskan semua koneksi aktif ke target database
    await adminClient.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = $1
        AND pid <> pg_backend_pid();
    `, [targetDb]);

    // Drop database
    await adminClient.query(`DROP DATABASE IF EXISTS "${targetDb}";`);
    console.log(`[OK] Database "${targetDb}" berhasil dihapus.`);

    // Buat database baru yang bersih
    await adminClient.query(`CREATE DATABASE "${targetDb}" ENCODING 'UTF8' TEMPLATE template0;`);
    console.log(`[OK] Database baru "${targetDb}" berhasil dibuat.`);
  } catch (err) {
    console.error('[ERROR] Gagal drop/recreate database:', err.code ? databaseErrorMessage(err) : err.message);
    process.exitCode = 1;
    return;
  } finally {
    await adminClient.end().catch(() => undefined);
    await pool.end().catch(() => undefined);
  }

  console.log(`[3/3] Database "${targetDb}" siap. Jalankan 'npm run db:setup' untuk menerapkan skema & master data.`);
}

resetDatabase();

