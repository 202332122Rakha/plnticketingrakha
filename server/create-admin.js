import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool, transaction } from './db.js';
import { validateUserInput } from './validation.js';
import { databaseErrorMessage } from './config.js';
try {
  const input=validateUserInput({
    username:process.env.INITIAL_ADMIN_USERNAME||'admin',
    employeeId:process.env.INITIAL_ADMIN_EMPLOYEE_ID||'ADMIN-INITIAL',
    name:process.env.INITIAL_ADMIN_NAME||'Administrator Ticketing',
    email:process.env.INITIAL_ADMIN_EMAIL,
    password:process.env.INITIAL_ADMIN_PASSWORD,
    role:'admin',unitId:process.env.INITIAL_ADMIN_UNIT||'PLN_CORPU',department:'Administrasi Ticketing',isActive:true,
  });
  const hash=await bcrypt.hash(input.password,12);
  await transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(41026,2)');
    const existing=await client.query('SELECT id FROM users WHERE lower(username)=$1 OR lower(email)=$2 OR lower(employee_number)=lower($3)',[input.username,input.email,input.employeeId]);
    if(existing.rowCount) throw new Error('Identitas admin sudah ada. Tidak ada password/akun yang diubah. Gunakan menu Admin untuk perubahan akun.');
    const unit=await client.query('SELECT id FROM units WHERE is_active=1 AND (id=$1 OR legacy_key=$1 OR unit_code=$1)',[input.unitId]);
    if(!unit.rowCount)throw new Error('Unit admin tidak tersedia. Jalankan db:seed atau isi INITIAL_ADMIN_UNIT.');
    const id=crypto.randomUUID();
    await client.query(`INSERT INTO users(id,username,email,password_hash,full_name,employee_number,role,unit_id,account_status,registration_status,is_active,department)
      VALUES ($1,$2,$3,$4,$5,$6,'admin',$7,'active','approved',1,$8)`,[id,input.username,input.email,hash,input.name,input.employeeId,unit.rows[0].id,input.department]);
    await client.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,details)
      VALUES ($1,$2,'INITIAL_ADMIN_CREATED','user',$2,'Admin dibuat melalui CLI lokal.')`,[crypto.randomUUID(),id]);
  });
  console.log(`Admin '${input.username}' berhasil dibuat. Password tidak dicetak atau disimpan sebagai teks di database.`);
} catch(error) {
  console.error(error.code?databaseErrorMessage(error):error.message);
  console.error('Isi INITIAL_ADMIN_EMAIL dan INITIAL_ADMIN_PASSWORD secara lokal, atau gunakan scripts/Setup-Ticketing.ps1.');
  process.exitCode=1;
} finally { delete process.env.INITIAL_ADMIN_PASSWORD; await pool.end(); }
