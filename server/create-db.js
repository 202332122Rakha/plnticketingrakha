import pg from 'pg';
import { dbConfig, pool } from './db.js';
import { databaseErrorMessage } from './config.js';
const name = dbConfig.database;
const client = new pg.Client({ ...dbConfig, database: process.env.DB_MAINTENANCE_DATABASE || 'postgres' });
try {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(name)) throw new Error('DB_NAME untuk db:create harus 1-63 huruf/angka/underscore, tidak diawali angka.');
  await client.connect();
  const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (!exists.rowCount) await client.query(`CREATE DATABASE "${name}" ENCODING 'UTF8' TEMPLATE template0`);
  console.log(`Database PostgreSQL ${name} tersedia.`);
} catch (error) {
  if (error.code === '42P04') console.log('Database sudah tersedia.');
  else { console.error(error.code ? databaseErrorMessage(error) : error.message); console.error('Pada server kantor, DBA dapat membuat database terlebih dahulu; akun aplikasi tidak perlu diberi hak CREATEDB.'); process.exitCode = 1; }
} finally { await client.end().catch(() => undefined); await pool.end(); }
