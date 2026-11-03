import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const REQUIRED_TABLES=['units','users','registration_requests','ticket_categories','tickets','ticket_comments','ticket_attachments','ticket_status_history','pic_assignments','notifications','sla_configs','audit_logs','assignment_rules'];
export async function readMigrationManifest(directory=path.join(path.dirname(fileURLToPath(import.meta.url)),'migrations')){
 const files=(await fs.readdir(directory)).filter(n=>/^\d+_[a-z0-9_]+\.sql$/.test(n)).sort();
 return Promise.all(files.map(async version=>({version,checksum:crypto.createHash('sha256').update(await fs.readFile(path.join(directory,version))).digest('hex')})));
}
/** The caller owns the dedicated connection. No operational rows are modified. */
export async function assessReadiness(client,manifest,{writeProbe=true,requireAdmin=true}={}){
 const info=(await client.query(`SELECT current_database() AS name, current_user AS username, version() AS version,
 current_setting('server_version_num')::integer AS server_version_num,
 (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser`)).rows[0];
 if(!info||!String(info.version).includes('PostgreSQL')||Number(info.server_version_num)<140000)throw new Error('Gunakan PostgreSQL 14 atau lebih baru.');
 const applied=(await client.query('SELECT version, checksum FROM public.schema_migrations ORDER BY version')).rows;
 for(const migration of manifest){const existing=applied.find(m=>m.version===migration.version);if(!existing)throw new Error(`Migrasi ${migration.version} belum diterapkan. Jalankan Setup.`);if(existing.checksum!==migration.checksum)throw new Error(`Checksum migrasi ${migration.version} tidak cocok. Jangan mengedit migrasi yang sudah diterapkan.`);}
 if(applied.some(row=>!manifest.some(m=>m.version===row.version)))throw new Error('Database menggunakan migrasi lebih baru/tidak dikenal. Gunakan versi aplikasi yang sesuai.');
 const grants=(await client.query(`SELECT c.relname AS name,
 has_table_privilege(current_user,c.oid,'SELECT') AS can_select,
 has_table_privilege(current_user,c.oid,'INSERT') AS can_insert,
 has_table_privilege(current_user,c.oid,'UPDATE') AS can_update,
 has_table_privilege(current_user,c.oid,'DELETE') AS can_delete
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND c.relname=ANY($1::text[])`,[REQUIRED_TABLES])).rows;
 for(const name of REQUIRED_TABLES){const row=grants.find(r=>r.name===name);if(!row||!row.can_select||!row.can_insert||!row.can_update||!row.can_delete)throw new Error(`Hak akses SELECT/INSERT/UPDATE/DELETE pada tabel ${name} belum lengkap.`);}
 // Check migration-dependent columns, not just the presence of a migration ledger.
 await client.query('SELECT auth_version, team, expertise FROM public.users LIMIT 0');
 await client.query('SELECT file_content FROM public.ticket_attachments LIMIT 0');
 await client.query('SELECT last_pic_id FROM public.assignment_rules LIMIT 0');
 const adminCount=Number((await client.query("SELECT count(*)::integer AS count FROM public.users WHERE role='admin' AND is_active=1 AND account_status='active'")).rows[0]?.count||0);
 if(requireAdmin&&!adminCount)throw new Error('Belum ada admin aktif. Jalankan Setup untuk membuat admin pertama.');
 if(writeProbe){
  await client.query('BEGIN');
  try{
   await client.query("SET LOCAL lock_timeout='5s'");
   await client.query('CREATE TEMP TABLE ticketing_readiness_probe (id INTEGER PRIMARY KEY, body TEXT NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()) ON COMMIT DROP');
   const body="PostgreSQL roundtrip: ' ? $1 # ",data=Buffer.from([0,1,2,127,255]);
   await client.query('INSERT INTO ticketing_readiness_probe(id,body,data) VALUES(1,$1,$2)',[body,data]);
   const saved=(await client.query('SELECT body,data FROM ticketing_readiness_probe WHERE id=1')).rows[0];
   if(saved?.body!==body||!Buffer.isBuffer(saved?.data)||!saved.data.equals(data))throw new Error('Uji baca/tulis PostgreSQL tidak mengembalikan data yang sama.');
   const updated=await client.query("UPDATE ticketing_readiness_probe SET body='updated' WHERE id=1 RETURNING body");
   if(updated.rows[0]?.body!=='updated')throw new Error('Uji UPDATE PostgreSQL gagal.');
   if((await client.query('DELETE FROM ticketing_readiness_probe WHERE id=1')).rowCount!==1)throw new Error('Uji DELETE PostgreSQL gagal.');
  }finally{await client.query('ROLLBACK');}
 }
 return {ok:true,engine:'PostgreSQL',database:info.name,username:info.username,version:info.version,migrations:applied.length,tables:REQUIRED_TABLES.length,activeAdmins:adminCount,writeProbe:writeProbe?'passed':'not-run',warnings:info.superuser?['Akun database adalah superuser. Gunakan role aplikasi berhak minimum sebelum operasional.']:[]};
}
