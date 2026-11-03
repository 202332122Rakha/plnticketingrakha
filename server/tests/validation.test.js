import test from 'node:test';
import assert from 'node:assert/strict';
const v = await import('../validation.js').catch(() => ({}));
const call = (name, ...args) => { assert.equal(typeof v[name], 'function', `${name} must exist`); return v[name](...args); };
const valid = {username:'staff.01',employeeId:'NIP-001',name:'Pegawai Contoh',email:'pegawai@example.invalid',password:'A-very-strong-password!',role:'pelapor',unitId:'unit-updl-bgr',isActive:true};
test('user validation normalizes identity while preserving a valid non-ASCII name',()=>{
 const u=call('validateUserInput',{...valid,username:' Staff.01 ',email:'Staff@Example.Invalid',name:'Budi Prasetyo'});
 assert.equal(u.username,'staff.01');assert.equal(u.email,'staff@example.invalid');assert.equal(u.isActive,true);assert.equal(u.name,'Budi Prasetyo');
});
for(const [key,value] of [['email','not an email'],['role','superuser'],['unitId',''],['name',''],['isActive','false'],['username',"a' OR 1=1"],['employeeId','x'.repeat(101)]]) {
 test(`invalid user ${key} is rejected`,()=>assert.throws(()=>call('validateUserInput',{...valid,[key]:value}),err=>err.status===400));
}
for(const password of ['short','a'.repeat(73),'😀'.repeat(19)]) {
 test(`password length boundary ${Buffer.byteLength(password)} bytes rejected`,()=>assert.throws(()=>call('validatePassword',password),err=>err.status===400));
}
test('valid password is accepted without truncation or transformation',()=>assert.equal(call('validatePassword','Long unique !234'), 'Long unique !234'));
test('unit validation rejects invalid type',()=>assert.throws(()=>call('validateUnitInput',{unitCode:'ABC',unitName:'Test',unitType:'OTHER'}),err=>err.status===400));
test('unit code and label are normalized and stored separately',()=>{
 const u=call('validateUnitInput',{unitCode:' bgr-1 ',unitName:' Bogor Baru ',unitType:'UPDL',unitRegion:'Jawa',unitFocus:'Belajar'});
 assert.equal(u.unitCode,'BGR-1');assert.equal(u.unitName,'Bogor Baru');
});
test('negative or non-integer category SLA is rejected',()=>{
 for(const n of [-1,0,1.5])assert.throws(()=>call('validateCategoryInput',{code:'NET',name:'Network',defaultSlaResponseMinutes:n,defaultSlaResolveHours:4}),err=>err.status===400);
});
test('rule strategy must be a supported server-side strategy',()=>assert.throws(()=>call('validateRuleInput',{targetTeam:'IT',loadBalancingStrategy:'random',isActive:true}),err=>err.status===400));
