import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import { databaseErrorMessage } from './config.js';
import { ensureMigrationTarget } from './migration-policy.js';

const directory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
let client;
try {
  client = await pool.connect();
  await client.query("SET lock_timeout = '10s'");
  await client.query('SELECT pg_advisory_lock(41026, 1)');
  await ensureMigrationTarget(client);
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const files = (await fs.readdir(directory)).filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
  for (const file of files) {
    const sql = await fs.readFile(path.join(directory, file), 'utf8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');
    const previous = await client.query('SELECT checksum FROM schema_migrations WHERE version = $1', [file]);
    if (previous.rows[0]) {
      if (previous.rows[0].checksum !== checksum) throw new Error(`Checksum migrasi ${file} berubah. Jangan edit migrasi yang telah diterapkan.`);
      console.log(`SKIP ${file} (sudah diterapkan)`); continue;
    }
    try {
      await client.query('BEGIN');
      // Execute a full SQL file so PostgreSQL function bodies and dollar quotes are preserved.
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(version, checksum) VALUES ($1, $2)', [file, checksum]);
      await client.query('COMMIT');
      console.log(`OK ${file}`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined); throw error;
    }
  }
  console.log('Migrasi PostgreSQL selesai. Data lama tidak dihapus.');
} catch (error) {
  console.error(error.code ? `${databaseErrorMessage(error)} (${error.code})` : error.message);
  process.exitCode = 1;
} finally {
  if (client) { await client.query('SELECT pg_advisory_unlock(41026, 1)').catch(() => undefined); client.release(); }
  await pool.end();
}
