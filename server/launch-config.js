import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import dotenv from 'dotenv';
import {buildDbConfig} from './config.js';

const KEYS=new Set(['version','mode','sshHost','sshUser','sshPort','localPort','remoteDbHost','remoteDbPort','appPort']);
function port(value,name){if(!/^\d+$/.test(String(value))||Number(value)<1||Number(value)>65535)throw new Error(`${name} harus angka 1-65535.`);return Number(value);}
function host(value,name){if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(value)||value.length>253)throw new Error(`${name} harus nama host atau IPv4, tanpa spasi/opsi SSH.`);return value;}
/** Non-secret launch settings. Database/SSH passwords must NEVER be stored here. */
export function normalizeConnectionProfile(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Profil koneksi harus berupa object JSON.');
 for(const key of Object.keys(input))if(!KEYS.has(key))throw new Error(`Field profil tidak didukung: ${key}. Jangan simpan password dalam profil.`);
 const p={version:1,mode:'Tunnel',sshHost:'10.10.23.26',sshUser:'webadmin2',sshPort:22,localPort:15432,remoteDbHost:'127.0.0.1',remoteDbPort:5432,appPort:4000,...input};
 if(p.version!==1)throw new Error('Versi profil koneksi tidak didukung.');
 if(!['Tunnel','Direct','Local'].includes(p.mode))throw new Error('Mode harus Tunnel, Direct, atau Local.');
 p.sshHost=host(p.sshHost,'Host SSH');p.remoteDbHost=host(p.remoteDbHost,'Host database dari server SSH');
 if(typeof p.sshUser!=='string'||!/^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(p.sshUser))throw new Error('Username SSH tidak valid.');
 for(const k of ['sshPort','localPort','remoteDbPort','appPort'])p[k]=port(p[k],k);
 if(p.mode==='Tunnel'&&p.appPort===p.localPort)throw new Error('Port HTTP aplikasi tidak boleh sama dengan port tunnel database.');
 return p;
}
export function buildTunnelArguments(input){
 const p=normalizeConnectionProfile(input);
 if(p.mode!=='Tunnel')throw new Error('Argumen tunnel hanya untuk mode Tunnel.');
 return ['-N','-T','-o','ExitOnForwardFailure=yes','-o','ConnectTimeout=10','-o','ServerAliveInterval=30','-o','ServerAliveCountMax=3','-p',String(p.sshPort),'-L',`127.0.0.1:${p.localPort}:${p.remoteDbHost}:${p.remoteDbPort}`,`${p.sshUser}@${p.sshHost}`];
}
export function validateProfileEnvironment(input,env){
 const p=normalizeConnectionProfile(input), db=buildDbConfig(env);
 if(['postgres','template0','template1'].includes(db.database.toLowerCase()))throw new Error('Gunakan database khusus aplikasi; jangan gunakan postgres/template0/template1.');
 const loopback=['127.0.0.1','localhost','::1'].includes(db.host);
 if(p.mode==='Tunnel'&&(db.host!=='127.0.0.1'||db.port!==p.localPort))throw new Error('Konfigurasi database berbeda dari tunnel. Jalankan -Action Configure; tidak ada konfigurasi yang diganti otomatis.');
 if(p.mode==='Local'&&!loopback)throw new Error('Mode Local hanya boleh mengarah ke PostgreSQL lokal.');
 if(p.mode==='Direct'&&!loopback&&!db.ssl)throw new Error('Koneksi langsung ke database jaringan wajib memakai TLS. Gunakan Tunnel untuk koneksi tanpa TLS database.');
 if(port(env.PORT||4000,'PORT')!==p.appPort)throw new Error('Port HTTP pada .env dan profil berbeda. Jalankan -Action Configure.');
 if(env.HOST&&!['127.0.0.1','localhost'].includes(env.HOST))throw new Error('Launcher lokal hanya melayani loopback. Untuk hosting publik gunakan panduan deployment server.');
 return {host:db.host,port:db.port,database:db.database,user:db.user,tls:Boolean(db.ssl),appPort:p.appPort};
}
export async function readLaunchSettings(root=process.cwd()){
 let profile,env;
 try{profile=normalizeConnectionProfile(JSON.parse(await fs.readFile(path.join(root,'.connection.json'),'utf8')));}catch(error){if(error.code==='ENOENT')throw new Error('Profil koneksi belum ada. Jalankan -Action Configure.');throw error;}
 try{env=dotenv.parse(await fs.readFile(path.join(root,'.env')));}catch{throw new Error('.env belum tersedia/tidak dapat dibaca. Jalankan -Action Configure.');}
 return {profile,database:validateProfileEnvironment(profile,env),sshArguments:profile.mode==='Tunnel'?buildTunnelArguments(profile):[]};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{console.log(JSON.stringify(await readLaunchSettings()));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
