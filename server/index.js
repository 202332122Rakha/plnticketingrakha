import dotenv from 'dotenv';
import { createApp } from './app.js';
import * as database from './db.js';
dotenv.config({ quiet: true });
const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '127.0.0.1';
let server;
try {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT tidak valid.');
  const status = await database.testDatabaseConnection();
  if (!status.ok) throw new Error(status.message);
  await database.query('SELECT auth_version FROM users LIMIT 0');
  server = createApp(database).listen(port, host, () => console.log(`PLN Ticketing / PostgreSQL: http://${host}:${port}`));
  server.on('error', async error => { console.error('HTTP server gagal:', error.code || error.message); await database.pool.end(); process.exitCode = 1; });
} catch (error) {
  console.error('Aplikasi belum dapat dijalankan:', error.message);
  console.error('Periksa .env, npm run db:status, dan npm run db:migrate.');
  await database.pool.end(); process.exitCode = 1;
}
async function shutdown() {
  if (server) await new Promise(resolve => server.close(resolve));
  await database.pool.end();
}
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
