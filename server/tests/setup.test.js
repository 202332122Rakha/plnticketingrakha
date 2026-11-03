import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import {buildDbConfig} from '../config.js';
test('setup preserves special characters in database credentials and keeps them server-side',async()=>{
 const {writeEnvironment}=await import('../configure-env.js');const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ticketing-setup-'));
 try {const file=path.join(dir,'.env');const password='a#b$"quote\\back/slash@100%\nline';await writeEnvironment(file,{host:'127.0.0.1',port:15432,database:'pln_ticketing',user:'ticketing_app',password,ssl:false});const env=dotenv.parse(await fs.readFile(file));const config=buildDbConfig(env);assert.equal(config.password,password);assert.equal(config.port,15432);assert.ok(env.SESSION_SECRET.length>=43);assert.equal(Object.keys(env).some(key=>key.startsWith('VITE_')),false);}finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('setup never overwrites an existing environment file',async()=>{const {writeEnvironment}=await import('../configure-env.js');const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ticketing-setup-'));try{const file=path.join(dir,'.env');await fs.writeFile(file,'original');await assert.rejects(writeEnvironment(file,{host:'127.0.0.1',port:5432,database:'app',user:'app',password:'secret',ssl:false}));assert.equal(await fs.readFile(file,'utf8'),'original');}finally{await fs.rm(dir,{recursive:true,force:true});}});
test('CA path with apostrophe and hash survives dotenv serialization',async()=>{
 const {writeEnvironment}=await import('../configure-env.js');const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ticketing-ca-'));
 try{const ca=path.join(dir,"IT's #root.pem");await fs.writeFile(ca,'TEST-CA');const file=path.join(dir,'.env');
 await writeEnvironment(file,{host:'db.internal',port:5432,database:'app',user:'app',password:'secret',ssl:true,caPath:ca,appPort:4100});
 const env=dotenv.parse(await fs.readFile(file));assert.equal(buildDbConfig(env).ssl.ca,'TEST-CA');assert.equal(env.PORT,'4100');assert.ok(env.CLIENT_URL.includes('http://127.0.0.1:4100'));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('setup rejects values that could insert another environment variable',async()=>{
 const {writeEnvironment}=await import('../configure-env.js');const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ticketing-injection-'));
 try{await assert.rejects(writeEnvironment(path.join(dir,'.env'),{host:'127.0.0.1',port:5432,database:'app',user:'app',password:'secret',ssl:true,caPath:'cert.pem\nDB_SSL=false'}));}
 finally{await fs.rm(dir,{recursive:true,force:true});}
});
