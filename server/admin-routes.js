import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { InputError, validateUserInput, validateUnitInput, validateCategoryInput, validateRuleInput, validatePassword } from './validation.js';
const ACTIVE = "('Baru','Diverifikasi','Ditugaskan','Dalam Proses','Menunggu Pelapor','Menunggu Pihak Ketiga','Menunggu Persetujuan')";
const id = () => crypto.randomUUID();
const one = (result, message='Data tidak ditemukan.') => {
  if (!result.rows[0]) throw new InputError(message,404);
  return result.rows[0];
};
async function audit(client,actor,action,type,target,details) {
  await client.query('INSERT INTO audit_logs (id,actor_id,action,target_type,target_id,details) VALUES ($1,$2,$3,$4,$5,$6)',[id(),actor,action,type,target,details]);
}
async function unit(client,key,active=true) {
  return one(await client.query(`SELECT * FROM units WHERE (id=$1 OR legacy_key=$1 OR unit_code=$1) ${active?'AND is_active=1':''} FOR SHARE`,[key]),'Unit tidak ditemukan atau tidak aktif.');
}
async function userRow(client,key) {
  return one(await client.query('SELECT u.*, un.legacy_key,un.unit_code,un.unit_name,un.unit_type FROM users u LEFT JOIN units un ON un.id=u.unit_id WHERE u.id=$1',[key]));
}
async function pendingIdentity(client,data) {
  await client.query('SELECT pg_advisory_xact_lock(41026,2)');
  const existing=await client.query("SELECT id FROM registration_requests WHERE status='pending' AND (lower(email)=lower($1) OR lower(username)=lower($2) OR lower(employee_number)=lower($3)) LIMIT 1",[data.email,data.username,data.employeeId]);
  if(existing.rows.length) throw new InputError('Identitas masih memiliki permohonan pendaftaran. Proses permohonan tersebut terlebih dahulu.',409);
}
async function notify(client,uid,ticket,title,message) {
  await client.query("INSERT INTO notifications(id,user_id,ticket_id,title,message,notification_type) VALUES($1,$2,$3,$4,$5,'assignment')",[id(),uid,ticket,title,message]);
}
async function assign(client,ticket,pic,actor,method,reason) {
  await client.query("UPDATE tickets SET assigned_pic_id=$1,status='Ditugaskan',assignment_method=$2,assignment_status='assigned',assigned_at=NOW(),accepted_at=NULL,in_progress_at=NULL WHERE id=$3",[pic,method,ticket.id]);
  await client.query("UPDATE pic_assignments SET assignment_status='completed' WHERE ticket_id=$1 AND assignment_status IN ('pending','accepted')",[ticket.id]);
  await client.query("INSERT INTO pic_assignments(id,ticket_id,pic_id,assigned_by,reason) VALUES($1,$2,$3,$4,$5)",[id(),ticket.id,pic,actor,reason]);
  await client.query("INSERT INTO ticket_status_history(id,ticket_id,old_status,new_status,changed_by,note) VALUES($1,$2,$3,'Ditugaskan',$4,$5)",[id(),ticket.id,ticket.status,actor,reason]);
  await notify(client,pic,ticket.id,'Penugasan tiket',reason);
  await audit(client,actor,'TICKET_ASSIGNED','ticket',ticket.id,reason);
}
/** Runs on the ticket creation transaction: rule and candidate rows remain locked until commit. */
export async function applyAutoAssignment(client,ticketId,categoryId,targetUnitId,actorId) {
  const rule=(await client.query('SELECT * FROM assignment_rules WHERE category_id=$1 AND is_active=1 FOR UPDATE',[categoryId])).rows[0];
  if(!rule) return;
  const candidates=(await client.query(`SELECT u.id FROM users u WHERE u.role='pic' AND u.account_status='active' AND u.is_active=1 AND u.unit_id=$1 AND u.team=$2 ORDER BY u.id FOR SHARE`,[targetUnitId,rule.target_team])).rows;
  if(!candidates.length) return;
  let chosen;
  if(rule.load_balancing_strategy==='direct_pic') chosen=candidates.find(u=>u.id===rule.default_pic_id);
  else if(rule.load_balancing_strategy==='round_robin') chosen=candidates[(candidates.findIndex(u=>u.id===rule.last_pic_id)+1)%candidates.length];
  else {
    const counts=(await client.query(`SELECT assigned_pic_id,COUNT(*)::int AS total FROM tickets WHERE status IN ${ACTIVE} AND assigned_pic_id IS NOT NULL GROUP BY assigned_pic_id`)).rows;
    const loads=new Map(counts.map(row=>[row.assigned_pic_id,Number(row.total)]));
    chosen=candidates.sort((a,b)=>(loads.get(a.id)||0)-(loads.get(b.id)||0)||a.id.localeCompare(b.id))[0];
  }
  if(!chosen) return;
  await assign(client,{id:ticketId,status:'Baru'},chosen.id,actorId,'auto',`Penugasan otomatis sesuai aturan kategori (${rule.load_balancing_strategy}).`);
  await client.query('UPDATE assignment_rules SET last_pic_id=$1 WHERE id=$2',[chosen.id,rule.id]);
}
export function installAdminRoutes(route,{query,transaction,requireAuth,requireRole,mapUserRow,loadTicket}) {
  const admin=[requireAuth,requireRole('admin')];
  route.post('/api/units',...admin,async(req,res)=>{
    const data=validateUnitInput(req.body||{});
    const saved=await transaction(async client=>{
      const saved=one(await client.query('INSERT INTO units(id,unit_code,unit_name,unit_type,unit_region,unit_focus,is_active) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[id(),data.unitCode,data.unitName,data.unitType,data.unitRegion,data.unitFocus,Number(data.isActive)]));
      await audit(client,req.authUser.uid,'UNIT_CREATED','unit',saved.id,`Unit ${saved.unit_code} dibuat.`);return saved;
    });res.status(201).json({success:true,unit:saved});
  });
  async function changeUnit(req,toggle=false) {
    return transaction(async client=>{
      // Lock before validating changes so another edit cannot silently overwrite this decision.
      const old=one(await client.query('SELECT * FROM units WHERE id=$1 OR legacy_key=$1 FOR UPDATE',[req.params.id]));
      const data=validateUnitInput({...{unitCode:old.unit_code,unitName:old.unit_name,unitType:old.unit_type,unitRegion:old.unit_region,unitFocus:old.unit_focus,isActive:Boolean(old.is_active)},...(toggle?{isActive:!old.is_active}:req.body)});
      if(!data.isActive || data.unitType!==old.unit_type) {
        const used=await client.query(`SELECT id FROM users WHERE unit_id=$1 AND is_active=1 UNION ALL SELECT id FROM tickets WHERE (target_unit_id=$1 OR reporter_unit_id=$1) AND status IN ${ACTIVE} LIMIT 1`,[old.id]);
        if(used.rows.length) throw new InputError('Unit masih memiliki pengguna atau tiket aktif. Pindahkan/selesaikan terlebih dahulu.',409);
      }
      const saved=one(await client.query('UPDATE units SET unit_code=$1,unit_name=$2,unit_type=$3,unit_region=$4,unit_focus=$5,is_active=$6 WHERE id=$7 RETURNING *',[data.unitCode,data.unitName,data.unitType,data.unitRegion,data.unitFocus,Number(data.isActive),old.id]));
      await audit(client,req.authUser.uid,'UNIT_UPDATED','unit',old.id,`Unit ${data.unitCode} diperbarui.`);return saved;
    });
  }
  route.patch('/api/units/:id',...admin,async(req,res)=>res.json({success:true,unit:await changeUnit(req)}));
  route.post('/api/units/:id/toggle',...admin,async(req,res)=>res.json({success:true,unit:await changeUnit(req,true)}));
  route.delete('/api/units/:id',...admin,async(req,res)=>{
    await transaction(async client=>{
      const old=one(await client.query('SELECT id FROM units WHERE id=$1 OR legacy_key=$1 FOR UPDATE',[req.params.id]));
      const refs=await client.query('SELECT id FROM users WHERE unit_id=$1 UNION ALL SELECT id FROM tickets WHERE reporter_unit_id=$1 OR target_unit_id=$1 UNION ALL SELECT id FROM registration_requests WHERE requested_unit_id=$1 LIMIT 1',[old.id]);
      if(refs.rows.length) throw new InputError('Unit digunakan pada data lain. Nonaktifkan setelah seluruh ketergantungan ditangani; jangan hapus riwayat.',409);
      await client.query('DELETE FROM units WHERE id=$1',[old.id]);await audit(client,req.authUser.uid,'UNIT_DELETED','unit',old.id,'Unit yang tidak direferensikan dihapus.');
    });res.json({success:true});
  });
  route.post('/api/users',...admin,async(req,res)=>{
    const data=validateUserInput(req.body||{});const hash=await bcrypt.hash(data.password,12);
    const saved=await transaction(async client=>{
      await pendingIdentity(client,data);const targetUnit=await unit(client,data.unitId);const uid=id();
      await client.query(`INSERT INTO users(id,username,email,password_hash,full_name,employee_number,role,unit_id,account_status,registration_status,is_active,department,position,phone,team,expertise) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'approved',$10,$11,$12,$13,$14,$15)`,[uid,data.username,data.email,hash,data.name,data.employeeId,data.role,targetUnit.id,data.isActive?'active':'disabled',Number(data.isActive),data.department,data.position,data.phone,data.team,JSON.stringify(data.expertise)]);
      await audit(client,req.authUser.uid,'USER_CREATED','user',uid,`Pengguna ${data.employeeId} dibuat sebagai ${data.role}.`);return mapUserRow(await userRow(client,uid));
    });res.status(201).json({success:true,user:saved});
  });
  route.patch('/api/users/:id',...admin,async(req,res)=>{
    const saved=await transaction(async client=>{
      await client.query('SELECT pg_advisory_xact_lock(41026,3)');
      const old=one(await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[req.params.id]));
      const oldMapped=mapUserRow(old);
      const data=validateUserInput({...oldMapped,...req.body},false);
      const targetUnit=await unit(client,data.unitId);
      const changedAccess=data.role!==old.role||data.isActive!==Boolean(old.is_active)||targetUnit.id!==old.unit_id;
      if(old.id===req.authUser.uid&&(data.role!=='admin'||!data.isActive)) throw new InputError('Admin tidak boleh menonaktifkan atau menurunkan peran akunnya sendiri.',409);
      if(old.role==='admin'&&old.is_active&&(data.role!=='admin'||!data.isActive)) {
        const remaining=await client.query("SELECT id FROM users WHERE role='admin' AND is_active=1 AND account_status='active' AND id<>$1",[old.id]);
        if(!remaining.rows.length) throw new InputError('Minimal satu Admin aktif harus tetap tersedia.',409);
      }
      if(old.role==='pic'&&(changedAccess||data.team!==(old.team||''))) {
        const tasks=await client.query(`SELECT id FROM tickets WHERE assigned_pic_id=$1 AND status IN ${ACTIVE} LIMIT 1`,[old.id]);
        if(tasks.rows.length) throw new InputError('PIC masih memiliki tiket aktif. Alihkan tiket sebelum mengubah akses/unit/tim.',409);
      }
      await pendingIdentity(client,data);
      await client.query(`UPDATE users SET username=$1,email=$2,full_name=$3,employee_number=$4,role=$5,unit_id=$6,account_status=$7,is_active=$8,department=$9,position=$10,phone=$11,team=$12,expertise=$13,auth_version=auth_version+$14 WHERE id=$15`,[data.username,data.email,data.name,data.employeeId,data.role,targetUnit.id,data.isActive?'active':'disabled',Number(data.isActive),data.department,data.position,data.phone,data.team,JSON.stringify(data.expertise),changedAccess?1:0,old.id]);
      await audit(client,req.authUser.uid,'USER_UPDATED','user',old.id,`Pengguna ${data.employeeId} diperbarui; peran ${data.role}; aktif ${data.isActive}.`);
      return mapUserRow(await userRow(client,old.id));
    });res.json({success:true,user:saved});
  });
  route.post('/api/users/:id/reset-password',...admin,async(req,res)=>{
    const password=validatePassword(req.body?.password);const hash=await bcrypt.hash(password,12);
    await transaction(async client=>{
      const saved=await client.query('UPDATE users SET password_hash=$1,auth_version=auth_version+1 WHERE id=$2 RETURNING id',[hash,req.params.id]);one(saved);
      await audit(client,req.authUser.uid,'PASSWORD_RESET','user',req.params.id,'Password diubah; seluruh sesi sebelumnya dicabut.');
    });res.json({success:true});
  });
  route.post('/api/users/:id/reassign-tickets',...admin,async(req,res)=>{
    const {toPicId,reason}=req.body||{};
    if(typeof toPicId!=='string'||toPicId===req.params.id||typeof reason!=='string'||reason.trim().length<5||reason.length>2000) throw new InputError('PIC pengganti yang berbeda dan alasan 5-2000 karakter wajib diisi.');
    const count=await transaction(async client=>{
      const pic=one(await client.query("SELECT * FROM users WHERE id=$1 AND role='pic' AND is_active=1 AND account_status='active' FOR SHARE",[toPicId]),'PIC pengganti tidak aktif.');
      const tickets=(await client.query(`SELECT * FROM tickets WHERE assigned_pic_id=$1 AND status IN ${ACTIVE} FOR UPDATE`,[req.params.id])).rows;
      if(tickets.some(ticket=>(ticket.target_unit_id||ticket.reporter_unit_id)!==pic.unit_id)) throw new InputError('Seluruh tiket harus ditangani PIC pada unit tujuan yang sama.',409);
      for(const ticket of tickets) await assign(client,ticket,pic.id,req.authUser.uid,'manual',reason.trim());return tickets.length;
    });res.json({success:true,count});
  });
  async function saveCategory(req,update) {
    const data=validateCategoryInput(req.body||{});
    return transaction(async client=>{
      const old=update?one(await client.query('SELECT id FROM ticket_categories WHERE id=$1 OR legacy_key=$1 FOR UPDATE',[String(req.body.id||'')])):null;
      const uid=old?.id||id();
      const values=[data.code,data.name,data.description,JSON.stringify(data.subcategories),data.defaultTeam,data.defaultSlaResponseMinutes,data.defaultSlaResolveHours,Number(data.isActive),uid];
      const saved=update?await client.query('UPDATE ticket_categories SET category_code=$1,category_name=$2,description=$3,subcategories=$4,default_team=$5,default_sla_response_minutes=$6,default_sla_resolve_hours=$7,is_active=$8 WHERE id=$9 RETURNING *',values):await client.query('INSERT INTO ticket_categories(category_code,category_name,description,subcategories,default_team,default_sla_response_minutes,default_sla_resolve_hours,is_active,id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',values);
      await audit(client,req.authUser.uid,update?'CATEGORY_UPDATED':'CATEGORY_CREATED','category',uid,`Kategori ${data.code} disimpan.`);return one(saved);
    });
  }
  route.post('/api/ticket_categories',...admin,async(req,res)=>res.status(201).json({success:true,category:await saveCategory(req,false)}));
  route.put('/api/ticket_categories',...admin,async(req,res)=>res.json({success:true,category:await saveCategory(req,true)}));
  route.delete('/api/ticket_categories/:id',...admin,async(req,res)=>{
    await transaction(async client=>{
      const old=one(await client.query('SELECT id FROM ticket_categories WHERE id=$1 OR legacy_key=$1 FOR UPDATE',[req.params.id]));
      if((await client.query('SELECT id FROM tickets WHERE category_id=$1 LIMIT 1',[old.id])).rows.length) throw new InputError('Kategori memiliki riwayat tiket. Nonaktifkan kategori, jangan hapus.',409);
      await client.query('DELETE FROM ticket_categories WHERE id=$1',[old.id]);await audit(client,req.authUser.uid,'CATEGORY_DELETED','category',old.id,'Kategori tanpa tiket dihapus.');
    });res.json({success:true});
  });
  route.get('/api/assignment_rules',...admin,async(_req,res)=>{
    const result=await query(`SELECT COALESCE(r.id,c.id) AS id,c.id AS category_id,c.legacy_key AS category_legacy_key,c.category_name,COALESCE(r.target_team,c.default_team,'') AS target_team,r.default_pic_id,p.full_name AS default_pic_name,COALESCE(r.load_balancing_strategy,'least_active_workload') AS load_balancing_strategy,COALESCE(r.is_active,0) AS is_active,r.notes FROM ticket_categories c LEFT JOIN assignment_rules r ON r.category_id=c.id LEFT JOIN users p ON p.id=r.default_pic_id ORDER BY c.category_name`);
    res.json({success:true,rules:result.rows});
  });
  route.put('/api/assignment_rules/:id',...admin,async(req,res)=>{
    const data=validateRuleInput(req.body||{});
    await transaction(async client=>{
      const cat=one(await client.query('SELECT c.id FROM ticket_categories c LEFT JOIN assignment_rules r ON r.category_id=c.id WHERE c.id=$1 OR c.legacy_key=$1 OR r.id=$1',[req.params.id]));
      if(data.defaultPicId) {
        const pic=one(await client.query("SELECT team FROM users WHERE id=$1 AND role='pic' AND is_active=1 AND account_status='active' FOR SHARE",[data.defaultPicId]),'PIC default tidak aktif.');
        if(pic.team!==data.targetTeam) throw new InputError('Tim PIC default harus sama dengan tim tujuan.');
      }
      await client.query('INSERT INTO assignment_rules(id,category_id,target_team,default_pic_id,load_balancing_strategy,is_active,notes) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(category_id) DO UPDATE SET target_team=EXCLUDED.target_team,default_pic_id=EXCLUDED.default_pic_id,load_balancing_strategy=EXCLUDED.load_balancing_strategy,is_active=EXCLUDED.is_active,notes=EXCLUDED.notes',[id(),cat.id,data.targetTeam,data.defaultPicId,data.loadBalancingStrategy,Number(data.isActive),data.notes]);
      await audit(client,req.authUser.uid,'ASSIGNMENT_RULE_UPDATED','category',cat.id,'Aturan penugasan otomatis diperbarui.');
    });res.json({success:true});
  });
  route.get('/api/audit_logs',...admin,async(_req,res)=>{
    const logs=await query('SELECT a.*,u.full_name AS actor_name,u.role AS actor_role,t.ticket_number FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id LEFT JOIN tickets t ON t.id=a.target_id AND a.target_type=\'ticket\' ORDER BY a.created_at DESC LIMIT 1000');res.json({success:true,logs:logs.rows});
  });
  route.patch('/api/tickets/:id/classify-unit',...admin,async(req,res)=>{
    if(typeof req.body?.unitKey!=='string') throw new InputError('Unit tujuan wajib dipilih.');
    await transaction(async client=>{
      const target=await unit(client,req.body.unitKey);const ticket=one(await client.query('SELECT * FROM tickets WHERE id=$1 FOR UPDATE',[req.params.id]));
      if(!ticket.target_unit_id && ticket.assigned_pic_id && !['Selesai','Ditutup','Ditolak'].includes(ticket.status)) {
        const pic=one(await client.query('SELECT unit_id FROM users WHERE id=$1 FOR SHARE',[ticket.assigned_pic_id]));
        if(pic.unit_id!==target.id) throw new InputError('Tiket aktif sudah ditugaskan ke PIC unit lain. Selesaikan/alihkan penugasan terlebih dahulu.',409);
      }
      await client.query('UPDATE tickets SET reporter_unit_id=$1,target_unit_id=COALESCE(target_unit_id,$1) WHERE id=$2',[target.id,ticket.id]);
      await audit(client,req.authUser.uid,'TICKET_UNIT_CLASSIFIED','ticket',ticket.id,`Asal unit tiket diklasifikasikan menjadi ${target.unit_name}; unit penanganan lama dipertahankan bila tersedia.`);
    });res.json({success:true,ticket:await loadTicket(req.params.id)});
  });
  route.get('/api/admin/export',...admin,async(req,res)=>{
    // Reporting export, not a pg_dump substitute. Never export password hashes or attachment bytes.
    const data=await transaction(async client=>{
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const output={exportedAt:new Date().toISOString(),format:'pln-ticketing-report-v1',notice:'Ekspor laporan, bukan backup database. Gunakan pg_dump untuk pemulihan lengkap.'};
      output.units=(await client.query('SELECT * FROM units ORDER BY unit_code')).rows;
      output.users=(await client.query('SELECT id,username,employee_number,full_name,email,role,unit_id,is_active,department,position,team,phone FROM users ORDER BY full_name')).rows;
      for(const table of ['tickets','ticket_categories','sla_configs','assignment_rules','audit_logs']) output[table]=(await client.query(`SELECT * FROM ${table}`)).rows;
      return output;
    });res.json({success:true,data});
  });
}
