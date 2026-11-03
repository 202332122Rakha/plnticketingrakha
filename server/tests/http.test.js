import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { prepareQuery } from '../sql.js';
const secret = 'test-only-secret-32-characters-not-for-production';
const user = { id:'user-admin',username:'admin',employee_number:'TEST01',full_name:'Test Admin',email:'test@example.invalid',role:'admin',unit_id:'unit-one',account_status:'active',is_active:1,auth_version:0,unit_code:'UNIT',unit_name:'Test Unit',unit_type:'UPDL',created_at:'2026-01-01T00:00:00Z' };
function cookie(uid='user-admin',ver=0) {
  const payload=Buffer.from(JSON.stringify({sub:uid,ver,exp:Math.floor(Date.now()/1000)+300})).toString('base64url');
  return `pln_ticketing_session=${payload}.${crypto.createHmac('sha256',secret).update(payload).digest('base64url')}`;
}
async function withApp(fn, {role='admin',health=true,version=0,maxLoginAttempts=20,queryHandler}={}) {
  const calls=[];
  const query=async(text, values=[])=>{
    const statement=prepareQuery(text,values); calls.push(statement);
    if (queryHandler) {const custom=queryHandler(statement);if(custom) return custom;}
    if (/u\.auth_version/.test(text)) return {rows:Number(values[1])===version?[{...user,role}]:[]};
    if (/SELECT u\.\*.*FROM users/s.test(text)) return {rows:[]};
    if (/SELECT status, password_hash/.test(text)) return {rows:[]};
    return {rows:[],rowCount:0};
  };
  const client={query,release(){}};
  const {createApp}=await import('../app.js');
  const app=createApp({query,connect:async()=>client,transaction:async work=>work(client),testDatabaseConnection:async()=>({ok:health}),pool:{}},{authSecret:secret,secureCookies:false,maxLoginAttempts});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const url=`http://127.0.0.1:${server.address().port}`;
  try {await fn({url,calls,cookie:cookie()});} finally {await new Promise(resolve=>server.close(resolve));}
}
for (const path of ['/api/users','/api/audit_logs','/api/assignment_rules','/api/admin/export']) {
 test(`anonymous access to ${path} is denied`,()=>withApp(async({url})=>{assert.equal((await fetch(url+path)).status,401);}));
}
test('health reports database failure, not successful readiness',()=>withApp(async({url})=>{const r=await fetch(url+'/api/health');assert.equal(r.status,503);assert.equal((await r.json()).database,'disconnected');},{health:false}));
test('health identifies PostgreSQL when available',()=>withApp(async({url})=>{const r=await fetch(url+'/api/health');assert.equal(r.status,200);assert.equal((await r.json()).engine,'PostgreSQL');}));
test('malformed cookie is rejected without throwing',()=>withApp(async({url})=>{const r=await fetch(url+'/api/auth/me',{headers:{cookie:'pln_ticketing_session=%ZZ'}});assert.equal(r.status,401);}));
test('changed auth version revokes a previously valid session',()=>withApp(async({url,cookie})=>{assert.equal((await fetch(url+'/api/auth/me',{headers:{cookie}})).status,401);},{version:1}));
test('non-admin cannot write a master unit',()=>withApp(async({url,cookie,calls})=>{const r=await fetch(url+'/api/units',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({unitCode:'X'})});assert.equal(r.status,403);assert.equal(calls.some(x=>/^INSERT/.test(x.text)),false);},{role:'pelapor'}));
for (const [path,body] of [
 ['/api/units',{unitCode:'BAD;DROP',unitType:'UPDL',unitName:'Name'}],
 ['/api/users',{username:'new',email:'bad-email',password:'a-long-enough-password',name:'Name',employeeId:'NEW1',role:'admin',unitId:'UNIT'}],
 ['/api/ticket_categories',{code:'CAT',name:'Category',defaultSlaResponseMinutes:-1}],
 ['/api/users/any/reset-password',{password:'short'}],
]) {
 test(`${path} rejects invalid input before any database writes`,()=>withApp(async({url,cookie,calls})=>{const r=await fetch(url+path,{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,400);assert.equal(calls.some(x=>/^(INSERT|UPDATE|DELETE)/.test(x.text)),false);}));
}
test('unknown API routes do not return an HTML success page',()=>withApp(async({url})=>{const r=await fetch(url+'/api/missing');assert.equal(r.status,404);assert.equal((await r.json()).success,false);}));
test('unapproved origin cannot write using cookies',()=>withApp(async({url,cookie})=>{const r=await fetch(url+'/api/auth/logout',{method:'POST',headers:{cookie,Origin:'https://untrusted.example.invalid'}});assert.equal(r.status,403);}));
test('invalid JSON has a controlled error',()=>withApp(async({url,cookie})=>{const r=await fetch(url+'/api/units',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:'{broken'});assert.equal(r.status,400);}));
test('login attempts are rate limited',()=>withApp(async({url})=>{for(let i=0;i<2;i++){assert.equal((await fetch(url+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:'unknown',password:'unmatched-password'})})).status,401);}assert.equal((await fetch(url+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,429);},{maxLoginAttempts:2}));

test('marking a missing notification uses PostgreSQL rowCount and returns 404',()=>withApp(async({url,cookie})=>{assert.equal((await fetch(url+'/api/notifications/missing/read',{method:'PATCH',headers:{cookie}})).status,404);}));
for(const path of ['/api/units?includeInactive=1','/api/ticket_categories?includeInactive=1']) {
 test(`revoked session cannot access ${path}`,()=>withApp(async({url,cookie})=>{assert.equal((await fetch(url+path,{headers:{cookie}})).status,401);},{version:1}));
 test(`non-admin cannot access ${path}`,()=>withApp(async({url,cookie})=>{assert.equal((await fetch(url+path,{headers:{cookie}})).status,403);},{role:'pelapor'}));
}
test('PIC cannot read a ticket assigned to someone else in the same unit',()=>withApp(async({url,cookie})=>{const r=await fetch(url+'/api/tickets/other-ticket',{headers:{cookie}});assert.equal(r.status,404);},{role:'pic',queryHandler:({text})=>text.includes('SELECT t.*')?{rows:[{id:'other-ticket',assigned_pic_id:'other-pic',reporter_unit_id:'unit-one',target_unit_id:'unit-one'}]}:null}));

function assignmentFixture(status='Baru') {
  return ({text}) => {
    if (/SELECT \* FROM tickets/.test(text)) return {rows:[{id:'ticket-one',ticket_number:'T-1',status,target_unit_id:'unit-one',reporter_unit_id:'unit-one'}]};
    if (/SELECT id FROM users WHERE id/.test(text)) return {rows:[{id:'pic-one'}]};
    if (/SELECT t\.\*/.test(text)) return {rows:[{id:'ticket-one',assigned_pic_id:'pic-one',status:'Ditugaskan'}]};
    return null;
  };
}
test('manual reassignment retires previous assignments and writes audit before commit',()=>withApp(async({url,cookie,calls})=>{
  const response=await fetch(url+'/api/tickets/ticket-one/assign',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({picId:'pic-one',reason:'Reassign to available PIC'})});
  assert.equal(response.status,200);
  assert.ok(calls.some(call=>/UPDATE pic_assignments/.test(call.text)),'Prior active assignment must be retired');
  const audit=calls.findIndex(call=>/INSERT INTO audit_logs/.test(call.text));
  const commit=calls.findIndex(call=>call.text==='COMMIT');
  assert.ok(audit>=0&&audit<commit,'Audit must be in the same transaction');
},{queryHandler:assignmentFixture()}));
test('manual assignment does not reopen a closed ticket',()=>withApp(async({url,cookie,calls})=>{
  const response=await fetch(url+'/api/tickets/ticket-one/assign',{method:'POST',headers:{cookie,'Content-Type':'application/json'},body:JSON.stringify({picId:'pic-one',reason:'Invalid assignment'})});
  assert.equal(response.status,409);
  assert.equal(calls.some(call=>/UPDATE tickets/.test(call.text)),false);
},{queryHandler:assignmentFixture('Ditutup')}));
