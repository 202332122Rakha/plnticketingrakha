import crypto from 'node:crypto';
import {spawnSync, spawn} from 'node:child_process';
import {validateIntegrationEnvironment} from '../integration-safety.js';
let pool,server,applicationPool;
function run(script,env){const result=spawnSync(process.execPath,[script],{stdio:'inherit',env});if(result.status!==0)throw new Error(`Pengujian berhenti: ${script} (exit ${result.status}).`);}
try {
 const config=validateIntegrationEnvironment();
 const pg=(await import('pg')).default;pool=new pg.Pool(config);
 const tables=await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'");
 if(tables.rows.length)throw new Error('Database test harus kosong. Runner tidak menghapus tabel/data. Buat database baru yang terpisah dan berakhiran _test.');
 const adminPassword=crypto.randomBytes(24).toString('base64url');
 const env={...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL,DB_SSL:process.env.TEST_DB_SSL||'false',DB_SSL_CA:process.env.TEST_DB_SSL_CA||'',DB_SSL_SERVERNAME:process.env.TEST_DB_SSL_SERVERNAME||'',NODE_ENV:'test',SESSION_SECRET:crypto.randomBytes(48).toString('base64url'),INITIAL_ADMIN_USERNAME:'integration-admin',INITIAL_ADMIN_EMPLOYEE_ID:'INTEGRATION-ADMIN',INITIAL_ADMIN_EMAIL:'integration-admin@example.invalid',INITIAL_ADMIN_PASSWORD:adminPassword};
 console.log(`Testing isolated PostgreSQL database: ${config.database}. No database is deleted by this script.`);
 run('server/run-migrations.js',env);run('server/run-migrations.js',env); // idempotent migration validation
 run('server/seed.js',env);run('server/create-admin.js',env);
 const before=await pool.query("SELECT password_hash FROM users WHERE username='integration-admin'");
 const counts=await pool.query('SELECT (SELECT count(*) FROM units) AS units,(SELECT count(*) FROM ticket_categories) AS categories');
 run('server/seed.js',env);
 const after=await pool.query("SELECT password_hash FROM users WHERE username='integration-admin'");
 const countsAfter=await pool.query('SELECT (SELECT count(*) FROM units) AS units,(SELECT count(*) FROM ticket_categories) AS categories');
 if(before.rows[0].password_hash!==after.rows[0].password_hash||JSON.stringify(counts.rows)!==JSON.stringify(countsAfter.rows))throw new Error('Seed idempotence/password preservation check failed.');
 console.log('PASS migration repeat, seed repeat, and existing password preservation');
 Object.assign(process.env,env);
 const database=await import('../db.js'); applicationPool=database.pool;
 const {createApp}=await import('../app.js');
 const rollbackId=crypto.randomUUID();
 try {await database.transaction(async client=>{await client.query("INSERT INTO units(id,unit_code,unit_name,unit_type) VALUES($1,$2,'Rollback test','UPDL')",[rollbackId,`ROLLBACK_${rollbackId}`]);throw new Error('expected-rollback');});}catch(error){if(error.message!=='expected-rollback')throw error;}
 if((await pool.query('SELECT id FROM units WHERE id=$1',[rollbackId])).rows.length)throw new Error('Rollback did not remove test write.');
 console.log('PASS transaction rollback on the real PostgreSQL connection');
 const app=createApp(database,{secureCookies:false});
 server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});
 try {await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['server/scripts/api-integration-test.js'],{stdio:'inherit',env:{...env,TEST_API_URL:`http://127.0.0.1:${server.address().port}`,TEST_ADMIN_IDENTIFIER:'integration-admin',TEST_ADMIN_PASSWORD:adminPassword,INTEGRATION_RUNNER_ACTIVE:'YES'}});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error(`API integration exit ${code}`)));});}
 finally {await new Promise(resolve=>server.close(resolve));server=null;await applicationPool.end();applicationPool=null;}
 console.log('Integration suite passed. Test data remains in the isolated database for inspection.');
} catch(error) {console.error('Integration test not completed:',error.code||error.message);process.exitCode=1;}
finally {if(server)await new Promise(resolve=>server.close(resolve));if(applicationPool)await applicationPool.end();if(pool)await pool.end();}
