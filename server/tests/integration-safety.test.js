import test from 'node:test';
import assert from 'node:assert/strict';
const gate=async env=>(await import('../integration-safety.js')).validateIntegrationEnvironment(env);
test('integration runner rejects execution without explicit consent',async()=>{await assert.rejects(gate({TEST_DATABASE_URL:'postgresql://app:test@localhost/pln_ticketing_test'}),/ALLOW_INTEGRATION_TEST/);});
test('integration runner refuses production database names',async()=>{await assert.rejects(gate({ALLOW_INTEGRATION_TEST:'YES',TEST_DATABASE_URL:'postgresql://app:test@localhost/pln_ticketing'}),/_test/);});
test('integration runner never inherits the production DATABASE_URL',async()=>{await assert.rejects(gate({ALLOW_INTEGRATION_TEST:'YES',DATABASE_URL:'postgresql://app:test@localhost/pln_ticketing_test'}),/TEST_DATABASE_URL/);});
test('a specifically named isolated test database is accepted',async()=>{const config=await gate({ALLOW_INTEGRATION_TEST:'YES',TEST_DATABASE_URL:'postgresql://app:test@localhost/pln_ticketing_test'});assert.equal(config.database,'pln_ticketing_test');});
