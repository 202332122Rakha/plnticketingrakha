import {pool,query} from './db.js';
import {databaseErrorMessage} from './config.js';
try {const result=await query("SELECT id FROM users WHERE role='admin' AND is_active=1 AND account_status='active' LIMIT 1");if(result.rows.length) console.log('Admin aktif sudah tersedia. Tidak ada password yang direset.');else{console.log('Belum ada Admin aktif.');process.exitCode=2;}}
catch(error){console.error(databaseErrorMessage(error));process.exitCode=1;}finally{await pool.end();}
