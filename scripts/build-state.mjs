import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
async function files(directory,relative=''){
 let entries;try{entries=await fs.readdir(path.join(directory,relative),{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return[];throw e;}
 const output=[];
 for(const entry of entries){const rel=path.join(relative,entry.name);if(entry.isSymbolicLink())throw new Error('Symlink tidak didukung dalam berkas build.');if(entry.isDirectory())output.push(...await files(directory,rel));else if(entry.isFile())output.push(rel);}
 return output.sort();
}
async function digest(root,paths){const hash=crypto.createHash('sha256');for(const name of [...paths].sort()){hash.update(name.replaceAll('\\','/'));hash.update('\0');hash.update(await fs.readFile(path.join(root,name)));hash.update('\0');}return hash.digest('hex');}
async function inputs(root){
 const list=[];for(const dir of ['src','server','scripts','public'])for(const name of await files(path.join(root,dir)))list.push(path.join(dir,name));
 for(const name of ['package.json','package-lock.json','index.html','tsconfig.json','vite.config.ts','JALANKAN-TICKETING.ps1'])try{if((await fs.stat(path.join(root,name))).isFile())list.push(name);}catch(e){if(e.code!=='ENOENT')throw e;}
 return list;
}
async function dependencyVersions(root){
 const p=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')),versions={};
 for(const[name,want]of Object.entries({...p.dependencies,...p.devDependencies}).sort()){
  let actual;try{actual=JSON.parse(await fs.readFile(path.join(root,'node_modules',name,'package.json'),'utf8')).version;}catch{throw new Error(`Dependensi ${name} belum tersedia. Jalankan Setup.`);}
  if(/^\d+\.\d+\.\d+$/.test(want)&&actual!==want)throw new Error(`Versi ${name} berbeda dari paket: perlu ${want}, terpasang ${actual}. Jalankan Setup.`);
  versions[name]=actual;
 }
 return versions;
}
async function current(root){
 const output=await files(path.join(root,'dist'));
 if(!output.includes('index.html'))throw new Error('Frontend belum dibangun. Jalankan Setup.');
 return {schema:1,platform:process.platform,arch:process.arch,nodeMajor:process.versions.node.split('.')[0],sourceDigest:await digest(root,await inputs(root)),outputDigest:await digest(path.join(root,'dist'),output),dependencies:await dependencyVersions(root)};
}
export async function recordBuild(root=process.cwd()){
 const state=await current(root);await fs.writeFile(path.join(root,'.build-state.json'),JSON.stringify({...state,checkedAt:new Date().toISOString()},null,2)+'\n',{mode:0o600});return state;
}
export async function checkBuild(root=process.cwd()){
 try{const saved=JSON.parse(await fs.readFile(path.join(root,'.build-state.json'),'utf8'));const now=await current(root);delete saved.checkedAt;if(JSON.stringify(saved)!==JSON.stringify(now))return{valid:false,reason:'Sumber, hasil build, runtime, atau dependensi berubah. Jalankan Setup untuk pemeriksaan ulang.'};return{valid:true};}
 catch(error){return{valid:false,reason:error.code==='ENOENT'?'Build belum diverifikasi. Jalankan Setup.':error.message};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{if(process.argv[2]==='write'){await recordBuild();console.log('Build receipt tersimpan; ini bukan bukti koneksi database.');}
 else{const result=await checkBuild();console.log(result.valid?'Build sesuai sumber dan dependensi terpasang.':result.reason);process.exitCode=result.valid?0:2;}}
 catch(error){console.error(error.message);process.exitCode=1;}
}
