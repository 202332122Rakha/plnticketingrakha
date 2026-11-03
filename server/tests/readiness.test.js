import test from 'node:test';
import assert from 'node:assert/strict';
import {assessReadiness, REQUIRED_TABLES} from '../readiness.js';
const manifest=[{version:'001_core.sql',checksum:'core-hash'},{version:'002_integrity.sql',checksum:'integrity-hash'}];
// Only the external database boundary is substituted. SQL readiness logic is real.
function connection({migrations=manifest,adminCount=1,canWrite=true,version=170000,probeError=false}={}){
 let tx=false,rows=new Map();
 return {get inTransaction(){return tx;},async query(sql,values=[]){
  if(sql.startsWith('SELECT current_database'))return{rows:[{name:'app_test',username:'app',server_version_num:version,version:'PostgreSQL 17',superuser:false}]};
  if(sql.includes('FROM public.schema_migrations'))return{rows:migrations};
  if(sql.includes('has_table_privilege'))return{rows:REQUIRED_TABLES.map(name=>({name,can_select:true,can_insert:canWrite,can_update:canWrite,can_delete:canWrite}))};
  if(sql.includes('count(*)')&&sql.includes('public.users'))return{rows:[{count:adminCount}]};
  if(sql==='BEGIN'){tx=true;return{rows:[]};}
  if(sql==='ROLLBACK'){tx=false;rows.clear();return{rows:[]};}
  if(sql.startsWith('INSERT INTO ticketing_readiness_probe')){if(probeError)throw Object.assign(new Error('probe failed'),{code:'42501'});rows.set(1,{body:values[0],data:values[1]});return{rowCount:1,rows:[]};}
  if(sql.startsWith('SELECT body'))return{rows:[rows.get(1)]};
  if(sql.startsWith('UPDATE ticketing_readiness_probe')){rows.get(1).body='updated';return{rows:[{body:'updated'}],rowCount:1};}
  if(sql.startsWith('DELETE FROM ticketing_readiness_probe')){rows.delete(1);return{rows:[],rowCount:1};}
  if(sql.startsWith('CREATE TEMP TABLE')||sql.startsWith('SET LOCAL')||sql.includes('LIMIT 0'))return{rows:[]};
  throw new Error('Unmodelled SQL boundary');
 }};
}
test('readiness checks schema, administrator and a parameterized database roundtrip',async()=>{
 const c=connection();const result=await assessReadiness(c,manifest);assert.equal(result.ok,true);assert.equal(result.engine,'PostgreSQL');assert.equal(result.writeProbe,'passed');assert.equal(c.inTransaction,false);
});
test('readiness fails for a pending migration',async()=>await assert.rejects(assessReadiness(connection({migrations:manifest.slice(0,1)}),manifest),/Migrasi/));
test('readiness fails for a database from newer application code',async()=>await assert.rejects(assessReadiness(connection({migrations:[...manifest,{version:'999_future.sql',checksum:'other'}]}),manifest),/lebih baru|tidak dikenal/));
test('readiness fails if a migration was edited after deployment',async()=>await assert.rejects(assessReadiness(connection({migrations:[{...manifest[0],checksum:'modified'},manifest[1]]}),manifest),/Checksum/));
test('readiness fails instead of launching with no active administrator',async()=>await assert.rejects(assessReadiness(connection({adminCount:0}),manifest),/admin/));
test('readiness fails with read-only application permissions',async()=>await assert.rejects(assessReadiness(connection({canWrite:false}),manifest),/Hak akses/));
test('failed roundtrip always rolls back its own transaction',async()=>{const c=connection({probeError:true});await assert.rejects(assessReadiness(c,manifest));assert.equal(c.inTransaction,false);});
test('read-only readiness has no temporary writes',async()=>{const c=connection();const r=await assessReadiness(c,manifest,{writeProbe:false});assert.equal(r.writeProbe,'not-run');assert.equal(c.inTransaction,false);});
test('unsupported PostgreSQL version cannot pass readiness',async()=>await assert.rejects(assessReadiness(connection({version:130000}),manifest),/PostgreSQL 14/));
