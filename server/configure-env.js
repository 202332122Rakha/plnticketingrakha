import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {buildDbConfig} from './config.js';
/** Called by local setup only. URL encoding prevents dotenv from changing passwords containing #, quotes or backslashes. */
export async function writeEnvironment(destination,{host,port,database,user,password,ssl=false,caPath='',sslServerName='',appPort=4000}) {
  if(!host||!user||!database||typeof password!=='string'||!password) throw new Error('Host, user, database, dan password PostgreSQL wajib diisi.');
  if(!/^[A-Za-z0-9_.-]+$/.test(host)) throw new Error('Gunakan nama host atau IPv4 yang valid; IPv6 dapat dikonfigurasi manual.');
  if(!Number.isInteger(Number(port))||Number(port)<1||Number(port)>65535) throw new Error('Port tidak valid.');
  if(typeof ssl!=='boolean') throw new Error('SSL harus true atau false.');
  if(!/^\d+$/.test(String(appPort))||Number(appPort)<1||Number(appPort)>65535) throw new Error('Port aplikasi tidak valid.');
  if(/[\r\n\0]/.test(caPath)) throw new Error('Path CA harus satu baris.');
  const url=new URL(`postgresql://${host}:${port}/${encodeURIComponent(database)}`);
  url.username=encodeURIComponent(user);url.password=encodeURIComponent(password);
  const env={DATABASE_URL:url.toString(),DB_SSL:String(Boolean(ssl)),DB_POOL_MAX:'10',DB_CONNECT_TIMEOUT_MS:'10000',DB_STATEMENT_TIMEOUT_MS:'30000',
    HOST:'127.0.0.1',PORT:String(appPort),NODE_ENV:'development',CLIENT_URL:[3000,4173,Number(appPort)].flatMap(p=>[`http://localhost:${p}`,`http://127.0.0.1:${p}`]).join(','),SESSION_SECRET:crypto.randomBytes(48).toString('base64url')};
  if(caPath) env.DB_SSL_CA=caPath.replaceAll('\\','/');
  if(sslServerName) env.DB_SSL_SERVERNAME=sslServerName;
  buildDbConfig(env);
  await fs.writeFile(destination,'# File rahasia backend. Jangan unggah atau commit.\n'+Object.entries(env).map(([key,value])=>`${key}=${key==='DB_SSL_CA'?JSON.stringify(value):value}`).join('\n')+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
 try {await writeEnvironment(path.resolve('.env'),{host:process.env.TICKETING_SETUP_HOST,port:Number(process.env.TICKETING_SETUP_PORT),database:process.env.TICKETING_SETUP_DATABASE,user:process.env.TICKETING_SETUP_USER,password:process.env.TICKETING_SETUP_PASSWORD,ssl:process.env.TICKETING_SETUP_SSL==='true',caPath:process.env.TICKETING_SETUP_CA||'',sslServerName:process.env.TICKETING_SETUP_SSL_SERVERNAME||'',appPort:Number(process.env.TICKETING_SETUP_APP_PORT||4000)});console.log('.env dibuat tanpa menampilkan password.');}
 catch(error){console.error(error.code==='EEXIST'?'.env sudah ada; tidak ditimpa.':error.message);process.exitCode=1;}
}
