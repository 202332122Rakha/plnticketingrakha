import {buildDbConfig} from './config.js';
export function validateIntegrationEnvironment(env=process.env) {
 if(env.ALLOW_INTEGRATION_TEST!=='YES') throw new Error('Set ALLOW_INTEGRATION_TEST=YES hanya untuk database pengujian terpisah.');
 if(!env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL wajib diisi; DATABASE_URL produksi tidak pernah digunakan.');
 const config=buildDbConfig({DATABASE_URL:env.TEST_DATABASE_URL,DB_SSL:env.TEST_DB_SSL||'false',DB_SSL_CA:env.TEST_DB_SSL_CA||'',DB_SSL_SERVERNAME:env.TEST_DB_SSL_SERVERNAME||''});
 if(!/^[a-zA-Z0-9_]+_test$/.test(config.database)) throw new Error('Nama database pengujian wajib berakhiran _test.');
 return config;
}
