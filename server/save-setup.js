import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import {writeEnvironment} from './configure-env.js';
import {buildDbConfig} from './config.js';
import {normalizeConnectionProfile,validateProfileEnvironment} from './launch-config.js';
/** Validate both files before replacing either. Reconfiguration is explicit and backed up. */
export async function saveSetup(root,{profile,database},{replace=false}={}){
 const p=normalizeConnectionProfile(profile), targets=['.env','.connection.json'];
 let lock,temporary;const previous=new Map(),changed=[];
 try{
  lock=await fs.open(path.join(root,'.configure.lock'),'wx',0o600);
  for(const name of targets){try{previous.set(name,await fs.readFile(path.join(root,name)));}catch(e){if(e.code!=='ENOENT')throw e;}}
  if(previous.size&&!replace)throw new Error('Konfigurasi sudah ada. Gunakan -Action Configure untuk perubahan eksplisit dengan backup.');
  temporary=await fs.mkdtemp(path.join(root,'.setup-'));await fs.chmod(temporary,0o700);
  await writeEnvironment(path.join(temporary,'.env'),{...database,appPort:p.appPort});
  let text=await fs.readFile(path.join(temporary,'.env'),'utf8');
  if(previous.has('.env')){
   const old=dotenv.parse(previous.get('.env'));
   let sameTarget=false;
   try{
    const a=buildDbConfig(old),b=buildDbConfig(dotenv.parse(text));
    const oldProfile=previous.has('.connection.json')?normalizeConnectionProfile(JSON.parse(previous.get('.connection.json').toString('utf8'))):null;
    sameTarget=a.database===b.database&&a.user===b.user&&a.host===b.host&&a.port===b.port&&oldProfile&&
     ['mode','sshHost','sshUser','sshPort','remoteDbHost','remoteDbPort'].every(key=>oldProfile[key]===p[key]);
   }catch{sameTarget=false;}
   if(sameTarget&&old.SESSION_SECRET&&/^[A-Za-z0-9_+/=-]{32,}$/.test(old.SESSION_SECRET))text=text.replace(/^SESSION_SECRET=.*$/m,`SESSION_SECRET=${old.SESSION_SECRET}`);
  }
  validateProfileEnvironment(p,dotenv.parse(text));
  await fs.writeFile(path.join(temporary,'.env'),text,{mode:0o600});
  await fs.writeFile(path.join(temporary,'.connection.json'),JSON.stringify(p,null,2)+'\n',{mode:0o600});
  if(previous.size){
   const parent=path.join(root,'.config-backups');await fs.mkdir(parent,{recursive:true,mode:0o700});
   const backup=path.join(parent,new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex'));
   await fs.mkdir(backup,{mode:0o700});
   for(const[name,bytes]of previous)await fs.writeFile(path.join(backup,name),bytes,{flag:'wx',mode:0o600});
  }
  for(const name of targets){
   if(previous.has(name))await fs.rename(path.join(temporary,name),path.join(root,name));
   else await fs.writeFile(path.join(root,name),await fs.readFile(path.join(temporary,name)),{flag:'wx',mode:0o600});
   changed.push(name);
  }
  await fs.unlink(path.join(root,'.setup-state.json')).catch(error=>{if(error.code!=='ENOENT')throw error;});
  return {profile:p};
 }catch(error){
  for(const name of changed.reverse()){
   if(previous.has(name))await fs.writeFile(path.join(root,name),previous.get(name),{mode:0o600});
   else await fs.unlink(path.join(root,name));
  }
  throw error;
 }finally{
  if(temporary)await fs.rm(temporary,{recursive:true,force:true});
  if(lock){await lock.close();await fs.unlink(path.join(root,'.configure.lock')).catch(()=>{});}
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{
  await saveSetup(process.cwd(),{profile:JSON.parse(process.env.TICKETING_SETUP_PROFILE||'{}'),database:{host:process.env.TICKETING_SETUP_HOST,port:process.env.TICKETING_SETUP_PORT,database:process.env.TICKETING_SETUP_DATABASE,user:process.env.TICKETING_SETUP_USER,password:process.env.TICKETING_SETUP_PASSWORD,ssl:process.env.TICKETING_SETUP_SSL==='true',caPath:process.env.TICKETING_SETUP_CA||'',sslServerName:process.env.TICKETING_SETUP_SSL_SERVERNAME||''}},{replace:process.argv.includes('--replace')});
  console.log('Konfigurasi tersimpan. Password tidak ditampilkan; konfigurasi lama dicadangkan bila diganti.');
 }catch(error){console.error(error.code==='EEXIST'?'Konfigurasi sedang dikunci/berkas sudah ada. Tidak ada perubahan paksa.':error.message);process.exitCode=1;}
 finally{delete process.env.TICKETING_SETUP_PASSWORD;}
}
