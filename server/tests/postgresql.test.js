import test from 'node:test';
import assert from 'node:assert/strict';

const configModule = await import('../config.js').catch(() => ({}));
const sqlModule = await import('../sql.js').catch(() => ({}));
const build = (...args) => { assert.equal(typeof configModule.buildDbConfig, 'function', 'PostgreSQL config builder must exist'); return configModule.buildDbConfig(...args); };
const sql = (...args) => { assert.equal(typeof sqlModule.prepareQuery, 'function', 'Parameterized PostgreSQL query compiler must exist'); return sqlModule.prepareQuery(...args); };

test('DB configuration defaults to local PostgreSQL, not a root MySQL account', () => {
  const c=build({DB_PASSWORD:'test-only'});
  assert.equal(c.host,'127.0.0.1'); assert.equal(c.port,5432); assert.equal(c.user,'ticketing_app'); assert.equal(c.database,'pln_ticketing');
  assert.equal(c.connectionTimeoutMillis,10000); assert.equal(c.ssl,false);
});
test('individual DB fields support the office server without assuming the SSH identity', () => {
  const c=build({DB_HOST:'10.10.23.26', DB_PORT:'15432', DB_USER:'ticketing_app', DB_NAME:'ticketing_stage', DB_PASSWORD:'a@:# value'});
  assert.equal(c.host,'10.10.23.26'); assert.equal(c.port,15432); assert.equal(c.password,'a@:# value'); assert.equal(c.user,'ticketing_app');
});
test('a PostgreSQL URI decodes credentials and takes precedence as one connection definition', () => {
  const c=build({DATABASE_URL:'postgresql://ticket%40app:a%23b%3Ac@db.internal:5433/ticketing', DB_HOST:'ignored'});
  assert.equal(c.user,'ticket@app'); assert.equal(c.password,'a#b:c'); assert.equal(c.host,'db.internal'); assert.equal(c.port,5433);
});
for (const uri of ['mysql://root:secret@localhost/x','not-a-url','https://host/db']) {
 test(`invalid/non-PostgreSQL URL fails closed: ${uri.split(':')[0]}`, () => assert.throws(()=>build({DATABASE_URL:uri}),/PostgreSQL|DATABASE_URL/));
}
for (const port of ['0','65536','5432oops','-1','1.5']) {
 test(`invalid DB port ${port} is rejected`,()=>assert.throws(()=>build({DB_PORT:port}),/DB_PORT|port/));
}
test('remote TLS requires certificate verification', () => {
 const c=build({DB_SSL:'true'}); assert.equal(c.ssl.rejectUnauthorized,true);
 assert.throws(()=>build({DB_SSL:'sometimes'}),/DB_SSL/);
});
test('SQL values stay separate from text even for injection-like strings', () => {
 const q=sql('SELECT * FROM users WHERE email = ? AND role = ?', ["x' OR 1=1 --", 'admin']);
 assert.equal(q.text,'SELECT * FROM users WHERE email = $1 AND role = $2');
 assert.deepEqual(q.values,["x' OR 1=1 --",'admin']);
});
test('question marks inside quoted strings, identifiers, comments, and dollar bodies are not parameters', () => {
 const q=sql(`SELECT '?' AS "?", 'it''s ?' AS text, $$?$$ AS body, $tag$?$tag$ AS tagged, ? -- ?\n/* ? */`, [8]);
 assert.equal(q.text,`SELECT '?' AS "?", 'it''s ?' AS text, $$?$$ AS body, $tag$?$tag$ AS tagged, $1 -- ?\n/* ? */`);
});
test('native repeated PostgreSQL placeholders remain native', () => {
 assert.deepEqual(sql('SELECT $1::text, $1::text', ['ok']),{text:'SELECT $1::text, $1::text',values:['ok']});
});
test('parameter count mismatch fails before a database write', () => {
 assert.throws(()=>sql('UPDATE users SET name = ? WHERE id = ?', ['only-name']),/parameter/i);
 assert.throws(()=>sql('SELECT $2', ['one']),/parameter/i);
 assert.throws(()=>sql('SELECT ?', ['one','two']),/parameter/i);
});
test('mixed placeholder styles are rejected',()=>assert.throws(()=>sql('SELECT ?, $1', [1,2]),/mixed|campur/i));
test('TLS through a loopback tunnel can verify the real database certificate name',()=>{
 const c=build({DB_HOST:'127.0.0.1',DB_PORT:'15432',DB_SSL:'true',DB_SSL_SERVERNAME:'db.internal'});
 assert.equal(c.ssl.rejectUnauthorized,true);assert.equal(c.ssl.servername,'db.internal');assert.equal(c.host,'127.0.0.1');
});
test('TLS server name cannot be silently ignored with TLS disabled',()=>assert.throws(()=>build({DB_SSL:'false',DB_SSL_SERVERNAME:'db.internal'}),/DB_SSL/));
