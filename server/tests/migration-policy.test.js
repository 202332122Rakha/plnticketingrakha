import test from 'node:test';
import assert from 'node:assert/strict';
import {ensureMigrationTarget} from '../migration-policy.js';
const client=(name,tables)=>({query:async sql=>({rows:sql.includes('current_database')?[{name}]:tables.map(table_name=>({table_name}))})});
test('first migration accepts an empty dedicated PostgreSQL database',async()=>assert.equal(await ensureMigrationTarget(client('pln_ticketing',[])),'new'));
test('migration accepts an already managed Ticketing database',async()=>assert.equal(await ensureMigrationTarget(client('pln_ticketing',['schema_migrations','users','tickets'])),'managed'));
test('migration refuses another application database without the migration ledger',async()=>await assert.rejects(ensureMigrationTarget(client('other_app',['customers'])),/tidak kosong/));
test('migration refuses maintenance databases even when empty',async()=>{for(const name of ['postgres','template0','template1'])await assert.rejects(ensureMigrationTarget(client(name,[])),/database khusus/);});
test('an unrelated schema_migrations table does not authorize modifying another application',async()=>await assert.rejects(ensureMigrationTarget(client('other_app',['schema_migrations','customers'])),/tabel lain/));
