import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeConnectionProfile, validateProfileEnvironment, buildTunnelArguments} from '../launch-config.js';

test('default tunnel targets the provided SSH server without treating SSH login as database login',()=>{
 const p=normalizeConnectionProfile({});
 assert.equal(p.mode,'Tunnel');assert.equal(p.sshHost,'10.10.23.26');assert.equal(p.sshUser,'webadmin2');
 assert.equal(p.sshPort,22);assert.equal(p.localPort,15432);assert.equal(p.remoteDbHost,'127.0.0.1');assert.equal(p.remoteDbPort,5432);
 assert.equal(p.appPort,4000);assert.equal(Object.hasOwn(p,'password'),false);
});
test('custom SSH and database ports produce loopback-only forwarding arguments',()=>{
 const a=buildTunnelArguments(normalizeConnectionProfile({sshPort:2222,localPort:15433,remoteDbHost:'db.internal',remoteDbPort:5440}));
 assert.deepEqual(a,['-N','-T','-o','ExitOnForwardFailure=yes','-o','ConnectTimeout=10','-o','ServerAliveInterval=30','-o','ServerAliveCountMax=3','-p','2222','-L','127.0.0.1:15433:db.internal:5440','webadmin2@10.10.23.26']);
});
for(const bad of [{sshHost:'-oProxyCommand=x'},{sshUser:'user name'},{localPort:0},{sshPort:65536},{appPort:15432},{mode:'MySQL'},{remoteDbHost:'db\nother'},{password:'secret'},{dbPassword:'secret'}]){
 test(`unsafe profile rejected: ${Object.keys(bad).join(',')}`,()=>assert.throws(()=>normalizeConnectionProfile(bad)));
}
test('a tunnel profile rejects an env that would accidentally bypass the tunnel',()=>{
 const p=normalizeConnectionProfile({});
 assert.throws(()=>validateProfileEnvironment(p,{DB_HOST:'10.10.23.26',DB_PORT:'5432',DB_NAME:'pln_ticketing',DB_USER:'ticketing_app',PORT:'4000'}));
 assert.doesNotThrow(()=>validateProfileEnvironment(p,{DB_HOST:'127.0.0.1',DB_PORT:'15432',DB_NAME:'pln_ticketing',DB_USER:'ticketing_app',PORT:'4000'}));
});
test('a local profile cannot silently use a remote database',()=>{
 const p=normalizeConnectionProfile({mode:'Local'});
 assert.throws(()=>validateProfileEnvironment(p,{DB_HOST:'10.10.23.26',DB_PORT:'5432',DB_NAME:'app',DB_USER:'app',PORT:'4000'}));
});
test('maintenance databases are never accepted as application setup targets',()=>{
 for(const name of ['postgres','template0','template1'])assert.throws(()=>validateProfileEnvironment(normalizeConnectionProfile({mode:'Local'}),{DB_NAME:name,PORT:'4000'}));
});
test('direct connection must use TLS unless it is loopback',()=>{
 const p=normalizeConnectionProfile({mode:'Direct'});
 assert.throws(()=>validateProfileEnvironment(p,{DB_HOST:'10.10.23.26',DB_SSL:'false',DB_NAME:'app',PORT:'4000'}));
 assert.doesNotThrow(()=>validateProfileEnvironment(p,{DB_HOST:'10.10.23.26',DB_SSL:'true',DB_NAME:'app',PORT:'4000'}));
});
