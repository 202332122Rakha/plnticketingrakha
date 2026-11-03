import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=process.env.TEST_COMPILED_ROOT;
globalThis.window=new EventTarget();
globalThis.localStorage={getItem(){throw new Error('Business data must not be read from browser storage');},setItem(){throw new Error('Business data must not be written to browser storage');}};
const load=rel=>import(pathToFileURL(path.join(root,'src',rel)).href);
const admin={uid:'server-admin',username:'admin',employeeId:'A1',name:'Admin',email:'admin@example.invalid',role:'admin',unitId:'unit-one',isActive:true,createdAt:'2026-01-01'};
const unit={id:'unit-uuid',legacy_key:'unit-one',unit_code:'TEST',unit_name:'Test Unit',unit_type:'UPDL',unit_region:'Jawa',is_active:1};
function backend({fail=false,failWrite=false}={}) {
 globalThis.fetch=async(input,init={})=>{
  const url=String(input);const method=init.method||'GET';
  if(fail || (failWrite&&method!=='GET')) return new Response(JSON.stringify({success:false,message:'Database unavailable'}),{status:503});
  let data={};
  if(url.startsWith('/api/units')) data={units:[unit],unit};
  else if(url.startsWith('/api/tickets')) data={tickets:[]};
  else if(url.startsWith('/api/ticket_categories')) data={categories:[{id:'cat1',category_name:'Network',category_code:'NET',subcategories:'["LAN","Wi-Fi"]',is_active:1}]};
  else if(url.startsWith('/api/users')) data=method==='GET'?{users:[admin]}:{user:{...admin,uid:'created-on-server',name:'New User'}};
  else if(url.startsWith('/api/registration_requests')) data={requests:[]};
  else if(url.startsWith('/api/audit_logs')) data={logs:[]};
  else if(url.startsWith('/api/assignment_rules')) data={rules:[]};
  return new Response(JSON.stringify({success:true,...data}),{status:200,headers:{'Content-Type':'application/json'}});
 };
}
test('mapped API users keep their unit, employee ID and active state',async()=>{const {mapUser}=await load('services/adminApiService.js');const result=mapUser(admin);assert.equal(result.employeeId,'A1');assert.equal(result.unitId,'unit-one');assert.equal(result.isActive,true);});
test('category JSON stored in PostgreSQL text is decoded in the frontend',async()=>{backend();const {listCategories}=await load('services/ticketApiService.js');assert.deepEqual((await listCategories())[0].subcategories,['LAN','Wi-Fi']);});
test('snapshot starts empty, loads from server, and clears on logout',async()=>{backend();const {storageService:s}=await load('services/storageService.js');s.clear();assert.deepEqual(s.getUsers(),[]);await s.refresh(admin);assert.equal(s.getUsers()[0].uid,'server-admin');assert.equal(s.getUnits()[0].unitId,'unit-one');s.clear();assert.deepEqual(s.getUnits(),[]);assert.deepEqual(s.getUsers(),[]);});
test('unavailable database does not fall back to fabricated tickets',async()=>{backend();const {storageService:s}=await load('services/storageService.js');await s.refresh(admin);backend({fail:true});await assert.rejects(s.refresh(admin),/unavailable/i);assert.deepEqual(s.getUsers(),[]);assert.deepEqual(s.getTickets(),[]);});
test('failed write does not create a local user',async()=>{backend();const {storageService:s}=await load('services/storageService.js');await s.refresh(admin);backend({failWrite:true});await assert.rejects(s.saveUser({...admin,uid:'local-new',employeeId:'NEW'},'a-safe-long-password'),/unavailable/i);assert.equal(s.getUsers().some(u=>u.uid==='local-new'),false);});
test('create returns the server user ID, never a temporary browser ID',async()=>{backend();const {storageService:s}=await load('services/storageService.js');await s.refresh(admin);const saved=await s.saveUser({...admin,uid:'local-new',employeeId:'NEW'},'a-safe-long-password');assert.equal(saved.uid,'created-on-server');});
test('a non-admin snapshot never requests the private user directory',async()=>{backend();const fetchBackend=globalThis.fetch;globalThis.fetch=(input,init)=>{assert.notEqual(String(input),'/api/users?includeInactive=1');return fetchBackend(input,init);};const {storageService:s}=await load('services/storageService.js');await s.refresh({...admin,role:'pelapor'});assert.equal(s.getUsers().length,1);assert.deepEqual(s.getAssignmentRules(),[]);});
test('management users are not offered the admin-only audit log menu',async()=>{const {canAccessView}=await load('utils/authPermissions.js');assert.equal(canAccessView({...admin,role:'manajemen'},'audit-log'),false);assert.equal(canAccessView(admin,'audit-log'),true);assert.equal(canAccessView({...admin,role:'manajemen'},'reports'),true);});
