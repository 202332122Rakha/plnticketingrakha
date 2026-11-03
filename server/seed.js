import crypto from 'node:crypto';
import { pool, transaction } from './db.js';
import { units, categories, slaList } from './master-data.js';
import { databaseErrorMessage } from './config.js';
try {
  await transaction(async (client) => {
    for (const u of units) await client.query(
      `INSERT INTO units (id,legacy_key,unit_code,unit_name,unit_type,unit_region,unit_focus,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,1) ON CONFLICT DO NOTHING`,
      [crypto.randomUUID(),u.key,u.code,u.name,u.type,u.region,u.focus]);
    for (const c of categories) await client.query(
      `INSERT INTO ticket_categories (id,legacy_key,category_code,category_name,description,subcategories,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,1) ON CONFLICT DO NOTHING`,
      [crypto.randomUUID(),c.key,c.key.replace('cat-','').toUpperCase(),c.name,c.desc,JSON.stringify(['Umum'])]);
    for (const s of slaList) await client.query(
      `INSERT INTO sla_configs(id,priority,response_minutes,resolve_hours,description,is_active)
       VALUES ($1,$2,$3,$4,$5,1) ON CONFLICT DO NOTHING`,
      [crypto.randomUUID(),s.priority,s.response,s.resolve,s.desc]);
  });
  console.log(`Master awal tersedia: ${units.length} unit, ${categories.length} kategori, ${slaList.length} prioritas SLA.`);
  console.log('Seed tidak mengubah data yang sudah ada, tidak membuat akun demo, dan tidak mereset password.');
} catch(error) {
  console.error('Seed gagal:',databaseErrorMessage(error),error.code || 'UNKNOWN'); process.exitCode=1;
} finally { await pool.end(); }
