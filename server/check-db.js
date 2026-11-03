import { testDatabaseConnection, pool, dbConfig } from './db.js';
try {
  console.log(`PostgreSQL ${dbConfig.host}:${dbConfig.port}/${dbConfig.database} (user: ${dbConfig.user})`);
  const result = await testDatabaseConnection();
  if (!result.ok) { console.error(result.message); process.exitCode = 1; }
  else console.log(`TERHUBUNG: ${result.version}; waktu server ${new Date(result.now).toISOString()}`);
} finally { await pool.end(); }
