import assert from 'node:assert/strict';
import crypto from 'node:crypto';

if(process.env.INTEGRATION_RUNNER_ACTIVE!=='YES') throw new Error('Gunakan npm run test:integration dengan database test yang kosong.');
const baseUrl = process.env.TEST_API_URL || 'http://127.0.0.1:4001';
const password = 'Test-Password-12345!';
const suffix = crypto.randomUUID().slice(0, 8);
const results = [];

async function request(path, options = {}, cookie = '') {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  return { response, body, setCookie: response.headers.get('set-cookie') || '' };
}

async function check(name, run) {
  await run();
  results.push(name);
  console.log(`PASS ${name}`);
}

function registration(username, unit) {
  return {
    username,
    fullName: `Test ${username}`,
    employeeId: `TEST-${suffix}-${username}`,
    email: `${username}@example.test`,
    password,
    department: 'Integration Test',
    position: 'QA Test',
    phone: '0800000000',
    unitId: unit.id,
    unitType: unit.unit_type,
    isManualUnit: false,
  };
}

async function submitRegistration(input) {
  return request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

async function login(identifier, loginPassword = password) {
  return request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password: loginPassword }),
  });
}

await check('health and database connectivity', async () => {
  const { response, body } = await request('/api/health');
  assert.equal(response.status, 200);
  assert.equal(body.database, 'connected');
});

const { body: unitBody } = await request('/api/units');
assert.ok(unitBody.units.length >= 1);
assert.ok(unitBody.units.every((unit) => Boolean(unit.is_active)));
const unitA = unitBody.units.find((unit) => unit.unit_type === 'UPDL');
const unitB = unitBody.units.find((unit) => unit.unit_type === 'NON_UPDL' && unit.id !== unitA?.id);
const corpuUnit = unitBody.units.find((unit) => unit.unit_type === 'CORPU');
assert.ok(unitA && unitB && corpuUnit);

const adminLogin = await login(process.env.TEST_ADMIN_IDENTIFIER, process.env.TEST_ADMIN_PASSWORD);
assert.equal(adminLogin.response.status, 200);
const adminCookie = adminLogin.setCookie.split(';')[0];
assert.ok(adminCookie.includes('pln_ticketing_session='));

await check('anonymous read protection', async () => {
  const paths = ['/api/auth/me', '/api/profiles', '/api/tickets', '/api/registration_requests'];
  for (const path of paths) {
    const { response } = await request(path);
    assert.equal(response.status, 401, `${path} should require authentication`);
  }
});

await check('Admin session and registration list', async () => {
  const { response, body } = await request('/api/auth/me', {}, adminCookie);
  assert.equal(response.status, 200);
  assert.equal(body.user.role, 'admin');
  const requests = await request('/api/registration_requests', {}, adminCookie);
  assert.equal(requests.response.status, 200);
  assert.ok(Array.isArray(requests.body.requests));
  assert.equal(JSON.stringify(requests.body).includes('password_hash'), false);
});

const userA = registration(`test-user-${suffix}`, unitA);
const pendingA = await submitRegistration(userA);
assert.equal(pendingA.response.status, 201);
assert.equal(pendingA.body.submitted, true);

await check('pending registration cannot login and duplicate is rejected', async () => {
  const pendingLogin = await login(userA.username);
  assert.equal(pendingLogin.response.status, 403);
  const duplicate = await submitRegistration(userA);
  assert.equal(duplicate.response.status, 409);
});

const approvalA = await request(`/api/registration_requests/${pendingA.body.requestId}/approve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ role: 'pelapor', unitKey: unitA.id }),
}, adminCookie);
assert.equal(approvalA.response.status, 200);

await check('approved user remains active and can login', async () => {
  const repeatedApproval = await request(`/api/registration_requests/${pendingA.body.requestId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'pelapor', unitKey: unitA.id }),
  }, adminCookie);
  assert.equal(repeatedApproval.response.status, 409);
  const userLogin = await login(userA.username);
  assert.equal(userLogin.response.status, 200);
  const userCookie = userLogin.setCookie.split(';')[0];
  const me = await request('/api/auth/me', {}, userCookie);
  assert.equal(me.response.status, 200);
  assert.equal(me.body.user.role, 'pelapor');
  assert.equal(me.body.user.unitId, unitA.legacy_key || unitA.id);
});

const userB = registration(`test-user-b-${suffix}`, unitB);
const pendingB = await submitRegistration(userB);
assert.equal(pendingB.response.status, 201);
const approvalB = await request(`/api/registration_requests/${pendingB.body.requestId}/approve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ role: 'pelapor', unitKey: unitB.id }),
}, adminCookie);
assert.equal(approvalB.response.status, 200);
const userBLogin = await login(userB.username);
assert.equal(userBLogin.response.status, 200);
const userBCookie = userBLogin.setCookie.split(';')[0];

const picInput = registration(`test-pic-${suffix}`, unitA);
const pendingPic = await submitRegistration(picInput);
assert.equal(pendingPic.response.status, 201);
const picApproval = await request(`/api/registration_requests/${pendingPic.body.requestId}/approve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ role: 'pic', unitKey: unitA.id }),
}, adminCookie);
assert.equal(picApproval.response.status, 200);
const picLogin = await login(picInput.username);
assert.equal(picLogin.response.status, 200);
const picCookie = picLogin.setCookie.split(';')[0];

const categories = await request('/api/ticket_categories');
assert.equal(categories.response.status, 200);
const category = categories.body.categories[0];
assert.ok(category);
const userALoginForTicket = await login(userA.username);
const userACookieForTicket = userALoginForTicket.setCookie.split(';')[0];
const ticketCreation = await request('/api/tickets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: `Integration ticket ${suffix}`,
    description: 'Ticket created in isolated integration database.',
    type: 'Insiden',
    categoryId: category.legacy_key || category.id,
    subcategoryName: 'Test',
    location: 'Test Lab',
    assetReference: 'TEST-ASSET',
    impact: 'Tim',
    urgency: 'Sedang',
    priority: 'Sedang',
    tags: ['test'],
  }),
}, userACookieForTicket);
assert.equal(ticketCreation.response.status, 201);
const ticketId = ticketCreation.body.ticket.id;

await check('ticket ownership and unit isolation', async () => {
  const ownTickets = await request('/api/tickets', {}, (await login(userA.username)).setCookie.split(';')[0]);
  assert.equal(ownTickets.response.status, 200);
  assert.ok(ownTickets.body.tickets.some((ticket) => ticket.id === ticketId));
  const crossUnit = await request(`/api/tickets/${ticketId}`, {}, userBCookie);
  assert.equal(crossUnit.response.status, 404);
  const anonymousCreate = await request('/api/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(anonymousCreate.response.status, 401);
});

const userACookie = (await login(userA.username)).setCookie.split(';')[0];
const comment = await request(`/api/tickets/${ticketId}/comments`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Test comment', visibility: 'public' }),
}, userACookie);
assert.equal(comment.response.status, 201);
const progress = await request(`/api/tickets/${ticketId}/progress`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Test progress', visibility: 'public' }),
}, picCookie);
assert.equal(progress.response.status, 404);

const assignment = await request(`/api/tickets/${ticketId}/assign`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ picId: picApproval.body.userId, reason: 'Integration test assignment' }),
}, adminCookie);
assert.equal(assignment.response.status, 200);
const assignedProgress = await request(`/api/tickets/${ticketId}/progress`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'PIC working', visibility: 'public' }),
}, picCookie);
assert.equal(assignedProgress.response.status, 201);
const statusUpdate = await request(`/api/tickets/${ticketId}/status`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'Dalam Proses', details: 'Starting work' }),
}, picCookie);
assert.equal(statusUpdate.response.status, 200);

await check('comments, PIC assignment, progress, and status history', async () => {
  const comments = await request(`/api/tickets/${ticketId}/comments`, {}, userACookie);
  assert.equal(comments.response.status, 200);
  assert.equal(comments.body.comments.length, 1);
  const progresses = await request(`/api/tickets/${ticketId}/progress`, {}, userACookie);
  assert.equal(progresses.response.status, 200);
  assert.equal(progresses.body.progresses.length, 1);
  const activity = await request(`/api/tickets/${ticketId}/activity`, {}, userACookie);
  assert.equal(activity.response.status, 200);
  assert.ok(activity.body.activity.length >= 2);
});

const rejectInput = registration(`test-reject-${suffix}`, corpuUnit);
const pendingReject = await submitRegistration(rejectInput);
assert.equal(pendingReject.response.status, 201);
const rejected = await request(`/api/registration_requests/${pendingReject.body.requestId}/reject`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ reason: 'Rejected by isolated integration test.' }),
}, adminCookie);
assert.equal(rejected.response.status, 200);

await check('rejection remains inactive and is auditable', async () => {
  const rejectedLogin = await login(rejectInput.username);
  assert.equal(rejectedLogin.response.status, 403);
  const list = await request('/api/registration_requests?status=rejected', {}, adminCookie);
  assert.equal(list.response.status, 200);
  assert.ok(list.body.requests.some((requestRow) => requestRow.id === pendingReject.body.requestId));
});

const logout = await request('/api/auth/logout', { method: 'POST' }, userACookie);
assert.equal(logout.response.status, 200);
assert.match(logout.setCookie, /Max-Age=0/);
await check('logout clears the session cookie', async () => {
  const meAfterLogout = await request('/api/auth/me', {}, logout.setCookie.split(';')[0]);
  assert.equal(meAfterLogout.response.status, 401);
});



await check('attachment bytes are persisted and downloaded exactly',async()=>{
 const payload=Buffer.from('PostgreSQL attachment verification\n','utf8');
 const upload=await request(`/api/tickets/${ticketId}/attachments`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileName:'integration.txt',contentType:'text/plain',dataBase64:payload.toString('base64')})},adminCookie);
 assert.equal(upload.response.status,201);
 const attachmentId=upload.body.attachment.id;
 const download=await fetch(`${baseUrl}/api/ticket_attachments/${attachmentId}/download`,{headers:{Cookie:adminCookie}});
 assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),payload);
 assert.equal((await request(`/api/ticket_attachments/${attachmentId}/download`,{},userBCookie)).response.status,404);
});
let newUnit, newCategory, extraPic;
await check('unit CRUD persists changes, rejects duplicate code, and protects references',async()=>{
 const created=await request('/api/units',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitCode:`QA_${suffix}`,unitName:'QA temporary unit',unitType:'UPDL',unitRegion:'Jawa',unitFocus:'Testing'})},adminCookie);
 assert.equal(created.response.status,201);newUnit=created.body.unit;
 const edited=await request(`/api/units/${newUnit.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitName:'QA updated unit'})},adminCookie);assert.equal(edited.response.status,200);assert.equal(edited.body.unit.unit_name,'QA updated unit');
 const duplicate=await request('/api/units',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unitCode:newUnit.unit_code,unitName:'Duplicate',unitType:'UPDL'})},adminCookie);assert.equal(duplicate.response.status,409);
 assert.equal((await request(`/api/units/${unitA.id}`,{method:'DELETE'},adminCookie)).response.status,409);
 assert.equal((await request(`/api/units/${newUnit.id}`,{method:'DELETE'},adminCookie)).response.status,200);
});
await check('category CRUD and JSON subcategories are persisted',async()=>{
 const body={code:`QA_${suffix}`,name:'QA category',description:'Test',subcategories:['LAN','Wi-Fi'],defaultTeam:'QA Team',defaultSlaResponseMinutes:30,defaultSlaResolveHours:8,isActive:true};
 const created=await request('/api/ticket_categories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},adminCookie);assert.equal(created.response.status,201);newCategory=created.body.category;
 const edited=await request('/api/ticket_categories',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,id:newCategory.id,name:'QA category updated'})},adminCookie);assert.equal(edited.response.status,200);assert.equal(edited.body.category.category_name,'QA category updated');assert.deepEqual(JSON.parse(edited.body.category.subcategories),['LAN','Wi-Fi']);
});
await check('admin user creation and server-side auto-assignment work together',async()=>{
 const created=await request('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:`qa-pic-${suffix}`,employeeId:`QA-PIC-${suffix}`,name:'QA additional PIC',email:`qa-pic-${suffix}@example.invalid`,password,department:'QA',role:'pic',unitId:unitA.id,team:'QA Team',isActive:true})},adminCookie);
 assert.equal(created.response.status,201);extraPic=created.body.user;assert.ok(extraPic.uid);
 const rule=await request(`/api/assignment_rules/${newCategory.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({targetTeam:'QA Team',defaultPicId:extraPic.uid,loadBalancingStrategy:'direct_pic',isActive:true})},adminCookie);assert.equal(rule.response.status,200);
 const freshLogin=await login(userA.username);const cookie=freshLogin.setCookie.split(';')[0];
 const createdTicket=await request('/api/tickets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Auto-assignment test',description:'PostgreSQL test',categoryId:newCategory.id,type:'Insiden',impact:'Tim',urgency:'Sedang',priority:'Sedang'})},cookie);
 assert.equal(createdTicket.response.status,201);assert.equal(createdTicket.body.ticket.assigned_pic_id,extraPic.uid);assert.equal(createdTicket.body.ticket.assignment_method,'auto');
 const deactivate=await request(`/api/users/${extraPic.uid}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({isActive:false})},adminCookie);assert.equal(deactivate.response.status,409);
 assert.equal((await request(`/api/ticket_categories/${newCategory.id}`,{method:'DELETE'},adminCookie)).response.status,409);
});
await check('password reset persists and revokes previously valid sessions',async()=>{
 const signed=await login(extraPic.username);assert.equal(signed.response.status,200);const oldCookie=signed.setCookie.split(';')[0];
 const newPassword=`New-Password-${suffix}-Secure!`;
 const reset=await request(`/api/users/${extraPic.uid}/reset-password`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:newPassword})},adminCookie);assert.equal(reset.response.status,200);
 assert.equal((await request('/api/auth/me',{},oldCookie)).response.status,401);
 assert.equal((await login(extraPic.username,newPassword)).response.status,200);
});
await check('audit and report exports omit authentication secrets',async()=>{
 const audit=await request('/api/audit_logs',{},adminCookie);assert.equal(audit.response.status,200);assert.ok(audit.body.logs.some(log=>log.action==='PASSWORD_RESET'));
 const report=await request('/api/admin/export',{},adminCookie);assert.equal(report.response.status,200);assert.equal(JSON.stringify(report.body).includes('password_hash'),false);assert.equal(JSON.stringify(report.body).includes('file_content'),false);
 assert.equal((await request('/api/admin/export',{},picCookie)).response.status,403);
});
console.log(JSON.stringify({passed:results.length,failed:0}));
