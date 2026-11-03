import {REQUIRED_TABLES} from './readiness.js';
/** Protect unrelated or maintenance databases before applying any application DDL. */
export async function ensureMigrationTarget(client){
 const {name}=(await client.query('SELECT current_database() AS name')).rows[0];
 if(['postgres','template0','template1'].includes(String(name).toLowerCase()))throw new Error('Migrasi memerlukan database khusus aplikasi, bukan postgres/template0/template1.');
 const tables=(await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows.map(r=>r.table_name);
 if(tables.includes('schema_migrations')){
  if(tables.some(name=>name!=='schema_migrations'&&!REQUIRED_TABLES.includes(name)))throw new Error('Database berisi tabel lain yang bukan bagian Ticketing. Minta DBA memeriksa target sebelum migrasi.');
  return 'managed';
 }
 if(tables.length)throw new Error('Database tidak kosong dan belum memiliki ledger migrasi Ticketing. Gunakan database baru atau minta DBA meninjau skema; tidak ada tabel yang diubah.');
 return 'new';
}
