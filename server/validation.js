export class InputError extends Error {
  constructor(message, status=400) { super(message); this.status=status; }
}
const fail = (message) => { throw new InputError(message); };
function text(value, name, max, required=false) {
  if (value != null && typeof value !== 'string') fail(`${name} harus berupa teks.`);
  const result=String(value ?? '').trim();
  if ((required && !result) || result.length>max) fail(`${name} wajib sesuai batas 1-${max} karakter.`);
  return result;
}
function flag(value, fallback=true) {
  if (value===undefined) return fallback;
  if (typeof value !== 'boolean') fail('Status aktif harus true atau false.');
  return value;
}
function positive(value,fallback,name,max=525600) {
  const result=value===undefined ? fallback : Number(value);
  if (!Number.isInteger(result)||result<1||result>max) fail(`${name} harus bilangan positif maksimal ${max}.`);
  return result;
}
export function validatePassword(value) {
  if (typeof value!=='string'||value.length<12||Buffer.byteLength(value,'utf8')>72) fail('Password minimal 12 karakter dan maksimal 72 byte UTF-8.');
  return value;
}
export function validateUserInput(input, requirePassword=true) {
  const username=text(input.username || input.employeeId,'Username',100,true).toLowerCase();
  if (!/^[a-z0-9_.-]{3,100}$/.test(username)) fail('Username harus 3-100 karakter: huruf, angka, titik, underscore, atau strip.');
  const email=text(input.email,'Email',191,true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Format email tidak valid.');
  if (!['admin','pic','pelapor','manajemen'].includes(input.role)) fail('Peran pengguna tidak valid.');
  if (input.expertise!==undefined && (!Array.isArray(input.expertise)||input.expertise.length>30)) fail('Keahlian harus berupa daftar maksimal 30 item.');
  return {
    username,email,employeeId:text(input.employeeId,'NIP',100,true),name:text(input.name,'Nama',255,true),
    password:requirePassword?validatePassword(input.password):undefined,role:input.role,unitId:text(input.unitId,'Unit',100,true),
    department:text(input.department,'Departemen',100),position:text(input.position,'Jabatan',100),
    team:text(input.team,'Tim',100),phone:text(input.phone,'Telepon',50),
    expertise:(input.expertise||[]).map(item=>text(item,'Keahlian',100,true)),isActive:flag(input.isActive),
  };
}
export function validateUnitInput(input) {
  if (!['UPDL','CORPU','NON_UPDL'].includes(input.unitType)) fail('Tipe unit harus UPDL, CORPU, atau NON_UPDL.');
  const unitCode=text(input.unitCode,'Kode unit',50,true).toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(unitCode)) fail('Kode unit hanya boleh huruf, angka, underscore, atau strip.');
  return {unitCode,unitName:text(input.unitName,'Nama unit',255,true),unitType:input.unitType,
    unitRegion:text(input.unitRegion||'Non-UPDL','Wilayah',100,true),unitFocus:text(input.unitFocus,'Fokus',5000),isActive:flag(input.isActive)};
}
export function validateCategoryInput(input) {
  if (input.subcategories!==undefined && (!Array.isArray(input.subcategories)||input.subcategories.length>100)) fail('Subkategori maksimal 100 item.');
  return {code:text(input.code,'Kode kategori',50,true).toUpperCase(),name:text(input.name,'Nama kategori',255,true),
    description:text(input.description,'Deskripsi',5000),subcategories:(input.subcategories||[]).map(x=>text(x,'Subkategori',255,true)),
    defaultTeam:text(input.defaultTeam,'Tim',100),defaultSlaResponseMinutes:positive(input.defaultSlaResponseMinutes,60,'SLA respons'),
    defaultSlaResolveHours:positive(input.defaultSlaResolveHours,24,'SLA penyelesaian',8760),isActive:flag(input.isActive)};
}
export function validateRuleInput(input) {
  if (!['least_active_workload','round_robin','direct_pic'].includes(input.loadBalancingStrategy)) fail('Strategi penugasan tidak valid.');
  const defaultPicId=text(input.defaultPicId,'PIC',100)||null;
  if (input.loadBalancingStrategy==='direct_pic'&&!defaultPicId) fail('PIC wajib dipilih untuk strategi direct_pic.');
  return {targetTeam:text(input.targetTeam,'Tim tujuan',100,true),defaultPicId,
    loadBalancingStrategy:input.loadBalancingStrategy,isActive:flag(input.isActive),notes:text(input.notes,'Catatan',4000)||null};
}
