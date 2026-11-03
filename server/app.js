import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAdminRoutes, applyAutoAssignment } from './admin-routes.js';
import { InputError, validatePassword } from './validation.js';

dotenv.config({ quiet: true });

export function createApp({ pool, query, connect, transaction, testDatabaseConnection }, options = {}) {
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'loopback') app.set('trust proxy', 'loopback');
const route = {};
for (const method of ['get','post','put','patch','delete']) {
  route[method] = (url, ...handlers) => app[method](url, ...handlers.map(handler => (req,res,next) => Promise.resolve().then(() => handler(req,res,next)).catch(next)));
}
const AUTH_SECRET = options.authSecret || process.env.SESSION_SECRET;
const AUTH_COOKIE = 'pln_ticketing_session';
const AUTH_TTL_SECONDS = 8 * 60 * 60;
const allowedOrigins = new Set(
  (process.env.CLIENT_URL || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

if (!AUTH_SECRET || AUTH_SECRET.length < 32 || /replace_with|change_me|isi_di_server/i.test(AUTH_SECRET)) {
  throw new Error('SESSION_SECRET must be configured with at least 32 characters.');
}

function signAuthToken(userId, authVersion = 0) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, ver: authVersion, exp: Math.floor(Date.now() / 1000) + AUTH_TTL_SECONDS })).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyAuthToken(token) {
  const [payload, signature, extra] = String(token || '').split('.');
  if (!payload || !signature || extra) return null;
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return claims.sub && Number(claims.exp) > Math.floor(Date.now() / 1000) ? claims : null;
  } catch {
    return null;
  }
}

function getCookie(req, name) {
  const entry = String(req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  try { return entry ? decodeURIComponent(entry.slice(name.length + 1)) : ''; } catch { return ''; }
}

function setAuthCookie(res, token) {
  const secure = (options.secureCookies ?? (process.env.NODE_ENV === 'production')) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${AUTH_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/api; Max-Age=${AUTH_TTL_SECONDS}; SameSite=Lax${secure}`);
}

function clearAuthCookie(res) {
  const secure = (options.secureCookies ?? (process.env.NODE_ENV === 'production')) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${AUTH_COOKIE}=; HttpOnly; Path=/api; Max-Age=0; SameSite=Lax${secure}`);
}

async function requireAuth(req, res, next) {
  try {
    const claims = verifyAuthToken(getCookie(req, AUTH_COOKIE));
    if (!claims) return res.status(401).json({ success: false, message: 'Sesi tidak valid atau telah berakhir.' });
    const result = await query(
      `      SELECT u.id, u.username, u.employee_number, u.full_name, u.email, u.department, u.position,
              u.role, u.unit_id, u.phone, u.team, u.expertise, u.account_status, u.is_active, u.created_at, u.last_login_at,
              un.unit_code, un.unit_name, un.unit_type, un.legacy_key
       FROM users u LEFT JOIN units un ON un.id = u.unit_id
       WHERE u.id = ? AND u.is_active = 1 AND u.account_status = 'active' AND u.auth_version = ? LIMIT 1`,
      [claims.sub, Number(claims.ver || 0)]
    );
    const row = result.rows[0];
    if (!row) return res.status(401).json({ success: false, message: 'Akun tidak aktif atau sesi telah dicabut.' });
    req.authUser = mapUserRow(row);
    req.authUser.unitUuid = row.unit_id || undefined;
    next();
  } catch (error) {
    console.error('Authentication middleware failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal memverifikasi sesi.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.authUser || !roles.includes(req.authUser.role)) {
      return res.status(403).json({ success: false, message: 'Anda tidak memiliki hak akses untuk tindakan ini.' });
    }
    next();
  };
}

const authAttempts = new Map();
function consumeRateLimit(key, max, windowMs) {
  const now = Date.now();
  if (authAttempts.size > 10000) {
    for (const [id, value] of authAttempts) if (now - value.start > windowMs) authAttempts.delete(id);
    if (authAttempts.size > 10000 && !authAttempts.has(key)) return true;
  }
  const rec = authAttempts.get(key);
  if (!rec || now - rec.start > windowMs) {
    authAttempts.set(key, { start: now, count: 1 });
    return false;
  }
  rec.count += 1;
  return rec.count > max;
}

function clientKey(req) {
  return String(req.ip || req.socket.remoteAddress || 'unknown');
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function mapUserRow(row) {
  return {
    uid: row.id,
    username: row.username,
    employeeId: row.employee_number,
    name: row.full_name,
    email: row.email,
    department: row.department || '',
    position: row.position || undefined,
    role: row.role,
    unitId: row.legacy_key || row.unit_id || undefined,
    unitCode: row.unit_code || undefined,
    unitName: row.unit_name || undefined,
    unitType: row.unit_type || undefined,
    team: row.team || undefined,
    expertise: parseJsonArray(row.expertise),
    phone: row.phone || undefined,
    isActive: Boolean(row.is_active) && row.account_status === 'active',
    accountStatus: row.account_status,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at || undefined,
  };
}

async function writeAudit(actorId, action, targetType, targetId, details) {
  await query(
    `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [crypto.randomUUID(), actorId || null, action, targetType || null, targetId || null, details || null]
  );
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin tidak diizinkan.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '14mb' }));

route.get('/api/health', async (_req, res) => {
  const dbStatus = await testDatabaseConnection();
  res.status(dbStatus.ok ? 200 : 503).json({
    ok: dbStatus.ok, engine: 'PostgreSQL',
    database: dbStatus.ok ? 'connected' : 'disconnected',
    message: dbStatus.ok ? 'API PostgreSQL siap' : 'Database belum siap. Periksa npm run db:status pada server.',
  });
});

route.get(['/api/profiles', '/api/users'], requireAuth, async (req, res) => {
  try {
    const userId = req.query.userId || req.query.id;
    const includeInactive = String(req.query.includeInactive || '') === '1';
    if (userId && String(userId) !== req.authUser.uid && req.authUser.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Anda hanya dapat melihat profil sendiri.' });
    }
    if (!userId && req.authUser.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Daftar pengguna hanya dapat diakses Admin.' });
    }
    let sql = `
      SELECT u.id, u.username, u.employee_number, u.full_name, u.email, u.department, u.position, u.role,
             u.unit_id, u.phone, u.team, u.expertise, u.account_status, u.is_active, u.created_at, u.last_login_at,
             un.unit_name, un.unit_code, un.unit_type, un.legacy_key
      FROM users u
      LEFT JOIN units un ON u.unit_id = un.id
      WHERE 1 = 1
    `;
    const params = [];
    if (!includeInactive || req.authUser.role !== 'admin') {
      sql += ` AND u.is_active = 1 AND u.account_status = 'active'`;
    }
    if (userId) {
      sql += ` AND u.id = ?`;
      params.push(userId);
    }
    sql += ` ORDER BY u.full_name ASC`;
    const result = await query(sql, params);
    const users = result.rows.map(mapUserRow);
    res.json({ success: true, users, rows: result.rows, record: result.rows[0] || null });
  } catch (error) {
    console.error('GET /api/profiles failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal memuat profil pengguna.' });
  }
});

async function requireAdminForInactive(req, res, next) {
  if (String(req.query.includeInactive || '') !== '1') return next();
  await requireAuth(req, res, () => requireRole('admin')(req, res, next));
}
route.get('/api/units', requireAdminForInactive, async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || '') === '1';
    const result = await query(
      `SELECT id, legacy_key, unit_code, unit_name, unit_type, unit_region, unit_focus, is_active, requires_verification, created_at, updated_at
       FROM units
       ${includeInactive ? '' : 'WHERE is_active = 1 AND requires_verification = 0'}
       ORDER BY unit_type ASC, unit_name ASC`
    );
    res.json({ success: true, units: result.rows, rows: result.rows });
  } catch (error) {
    console.error('GET /api/units failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal memuat data unit dari database.' });
  }
});

route.get('/api/registration_requests', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const conditions = [];
    const params = [];
    if (['pending', 'approved', 'rejected'].includes(String(req.query.status || '').toLowerCase())) {
      conditions.push('r.status = ?');
      params.push(String(req.query.status).toLowerCase());
    }
    if (req.query.unitId) {
      conditions.push('(r.requested_unit_id = ? OR requested_unit.legacy_key = ? OR requested_unit.unit_code = ?)');
      params.push(req.query.unitId, req.query.unitId, req.query.unitId);
    }
    const result = await query(
      `SELECT r.id, r.user_id, r.requested_unit_id, r.requested_unit_name, r.username,
              r.full_name, r.employee_number, r.email, r.department, r.position, r.phone,
              r.status, r.reviewed_by, r.reviewed_at, r.review_note, r.created_at, r.updated_at,
              requested_unit.legacy_key AS unit_legacy_key, requested_unit.unit_code,
              requested_unit.unit_name, requested_unit.unit_type, approved_user.role AS assigned_role
       FROM registration_requests r
       LEFT JOIN units requested_unit ON requested_unit.id = r.requested_unit_id
       LEFT JOIN users approved_user ON approved_user.id = r.user_id
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY r.created_at DESC`,
      params
    );
    res.json({ success: true, requests: result.rows, rows: result.rows });
  } catch (error) {
    console.error('GET /api/registration_requests failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal memuat permohonan pendaftaran.' });
  }
});

route.post('/api/registration_requests/:id/approve', requireAuth, requireRole('admin'), async (req, res) => {
  const { role, unitKey } = req.body || {};
  if (!['pelapor', 'pic'].includes(role) || !unitKey) {
    return res.status(400).json({ success: false, message: 'Peran Pelapor/PIC dan unit resmi wajib dipilih.' });
  }

  const connection = await connect();
  let inTransaction = false;
  try {
    await connection.query('BEGIN');
    inTransaction = true;
    const { rows: requests } = await connection.query(
      'SELECT * FROM registration_requests WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    const registration = requests[0];
    if (!registration || registration.status !== 'pending') {
      await connection.query('ROLLBACK');
      inTransaction = false;
      return res.status(409).json({ success: false, message: 'Permohonan tidak ditemukan atau sudah diproses.' });
    }

    const { rows: units } = await connection.query(
      'SELECT id, unit_name FROM units WHERE is_active = 1 AND (id = ? OR legacy_key = ? OR unit_code = ?) LIMIT 1',
      [unitKey, unitKey, unitKey]
    );
    if (units.length === 0) {
      await connection.query('ROLLBACK');
      inTransaction = false;
      return res.status(400).json({ success: false, message: 'Unit resmi aktif untuk akun ini tidak ditemukan.' });
    }

    const userId = crypto.randomUUID();
    await connection.query(
      `INSERT INTO users (
        id, username, email, password_hash, full_name, employee_number, role, unit_id,
        account_status, registration_status, is_active, department, position, phone, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 'approved', 1, ?, ?, ?, NOW(), NOW())`,
      [userId, registration.username, registration.email, registration.password_hash, registration.full_name,
        registration.employee_number, role, units[0].id, registration.department, registration.position, registration.phone]
    );
    await connection.query(
      `UPDATE registration_requests
       SET user_id = ?, requested_unit_id = ?, status = 'approved', reviewed_by = ?, reviewed_at = NOW(),
           review_note = ?, updated_at = NOW()
       WHERE id = ? AND status = 'pending'`,
      [userId, units[0].id, req.authUser.uid, `Disetujui sebagai ${role} pada unit ${units[0].unit_name}.`, registration.id]
    );
    await connection.query(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details, created_at)
       VALUES (?, ?, 'REGISTRATION_APPROVED', 'registration_request', ?, ?, NOW())`,
      [crypto.randomUUID(), req.authUser.uid, registration.id, `Akun ${userId} disetujui sebagai ${role} pada unit ${units[0].unit_name}.`]
    );
    await connection.query(
      `INSERT INTO notifications (id, user_id, registration_request_id, title, message, notification_type, is_read, created_at)
       VALUES (?, ?, ?, 'Pendaftaran disetujui', ?, 'registration_approved', 0, NOW())`,
      [crypto.randomUUID(), userId, registration.id, `Akun Anda telah disetujui untuk unit ${units[0].unit_name}. Silakan masuk menggunakan username dan kata sandi yang didaftarkan.`]
    );
    await connection.query('COMMIT');
    inTransaction = false;
    res.json({ success: true, userId, unitName: units[0].unit_name, role });
  } catch (error) {
    if (error?.code === '23505') {
      if (inTransaction) await connection.query('ROLLBACK').catch(() => undefined);
      inTransaction = false;
      return res.status(409).json({ success: false, message: 'Username, email, atau NIP sudah digunakan oleh akun lain.' });
    }
    console.error('POST /api/registration_requests/:id/approve failed:', error.code || error.name || 'UNKNOWN');
    if (inTransaction) await connection.query('ROLLBACK').catch(() => undefined);
    inTransaction = false;
    res.status(500).json({ success: false, message: 'Gagal menyetujui permohonan pendaftaran.' });
  } finally {
    if (inTransaction) await connection.query('ROLLBACK').catch(() => undefined);
    connection.release();
  }
});

route.post('/api/registration_requests/:id/reject', requireAuth, requireRole('admin'), async (req, res) => {
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 5 || reason.length > 2000) {
    return res.status(400).json({ success: false, message: 'Alasan penolakan harus 5-2000 karakter.' });
  }

  const connection = await connect();
  let inTransaction = false;
  try {
    await connection.query('BEGIN');
    inTransaction = true;
    const { rows: requests } = await connection.query(
      'SELECT id, status FROM registration_requests WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (!requests[0] || requests[0].status !== 'pending') {
      await connection.query('ROLLBACK');
      inTransaction = false;
      return res.status(409).json({ success: false, message: 'Permohonan tidak ditemukan atau sudah diproses.' });
    }
    await connection.query(
      `UPDATE registration_requests
       SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), review_note = ?, updated_at = NOW()
       WHERE id = ? AND status = 'pending'`,
      [req.authUser.uid, reason, req.params.id]
    );
    await connection.query(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details, created_at)
       VALUES (?, ?, 'REGISTRATION_REJECTED', 'registration_request', ?, ?, NOW())`,
      [crypto.randomUUID(), req.authUser.uid, req.params.id, reason]
    );
    await connection.query('COMMIT');
    inTransaction = false;
    res.json({ success: true });
  } catch (error) {
    console.error('POST /api/registration_requests/:id/reject failed:', error.code || error.name || 'UNKNOWN');
    if (inTransaction) await connection.query('ROLLBACK').catch(() => undefined);
    inTransaction = false;
    res.status(500).json({ success: false, message: 'Gagal menolak permohonan pendaftaran.' });
  } finally {
    if (inTransaction) await connection.query('ROLLBACK').catch(() => undefined);
    connection.release();
  }
});

route.get('/api/ticket_categories', requireAdminForInactive, async (req, res) => {
  try {
    const includeInactive = String(req.query.includeInactive || '') === '1';
    const result = await query(
      `SELECT id, legacy_key, category_code, category_name, description, subcategories, default_team,
              default_sla_response_minutes, default_sla_resolve_hours, is_active, created_at, updated_at
       FROM ticket_categories
       ${includeInactive ? '' : 'WHERE is_active = 1'}
       ORDER BY category_name ASC`
    );
    res.json({ success: true, categories: result.rows, rows: result.rows });
  } catch (error) {
    console.error('GET /api/ticket_categories failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal memuat kategori tiket.' });
  }
});

route.get(['/api/sla_settings', '/api/sla_configs'], requireAuth, async (_req, res) => {
  try {
    const result = await query(
      `SELECT id, priority, response_minutes, resolve_hours, description, is_active
       FROM sla_configs
       WHERE is_active = 1
       ORDER BY response_minutes ASC`
    );
    res.json({ success: true, configs: result.rows, rows: result.rows });
  } catch (error) {
    console.error('GET /api/sla_settings failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal memuat SLA.' });
  }
});

route.put('/api/sla_configs', requireAuth, requireRole('admin'), async (req, res) => {
  const configs = req.body?.configs;
  const priorities = ['Kritis', 'Tinggi', 'Sedang', 'Rendah'];
  if (!Array.isArray(configs) || configs.some((config) =>
    !priorities.includes(config.priority) ||
    !Number.isInteger(Number(config.responseMinutes)) || Number(config.responseMinutes) < 1 ||
    !Number.isInteger(Number(config.resolveHours)) || Number(config.resolveHours) < 1
  )) {
    return res.status(400).json({ success: false, message: 'Konfigurasi SLA harus berisi prioritas yang valid serta waktu positif.' });
  }
  const connection = await connect();
  let inTransaction = false;
  try {
    await connection.query('BEGIN');
    inTransaction = true;
    for (const config of configs) {
      await connection.query(
        `INSERT INTO sla_configs (id, priority, response_minutes, resolve_hours, description, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())
         ON CONFLICT (priority) DO UPDATE SET response_minutes = EXCLUDED.response_minutes, resolve_hours = EXCLUDED.resolve_hours,
           description = EXCLUDED.description, is_active = 1, updated_at = NOW()`,
        [crypto.randomUUID(), config.priority, Number(config.responseMinutes), Number(config.resolveHours), String(config.description || '').slice(0, 2000)]
      );
    }
    await connection.query(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, details, created_at)
       VALUES (?, ?, 'SLA_CONFIG_UPDATED', 'sla_config', ?, NOW())`,
      [crypto.randomUUID(), req.authUser.uid, `SLA configurations updated (${configs.length} priorities).`]
    );
    await connection.query('COMMIT');
    inTransaction = false;
    res.json({ success: true });
  } catch (error) {
    console.error('PUT /api/sla_configs failed:', error.code || error.name || 'UNKNOWN');
    if (inTransaction) await connection.query('ROLLBACK').catch(() => undefined);
    inTransaction = false;
    res.status(500).json({ success: false, message: 'Gagal menyimpan konfigurasi SLA.' });
  } finally {
    if (inTransaction) await connection.query('ROLLBACK').catch(() => undefined);
    connection.release();
  }
});

route.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, user_id, ticket_id, registration_request_id, title, message, notification_type, is_read, created_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`,
      [req.authUser.uid]
    );
    res.json({ success: true, notifications: result.rows, rows: result.rows });
  } catch (error) {
    console.error('GET /api/notifications failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal memuat notifikasi.' });
  }
});

route.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const result = await query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.authUser.uid]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Notifikasi tidak ditemukan.' });
    res.json({ success: true });
  } catch (error) {
    console.error('PATCH notification failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal memperbarui notifikasi.' });
  }
});

route.post('/api/notifications/read-all', requireAuth, async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.authUser.uid]);
    res.json({ success: true });
  } catch (error) {
    console.error('POST /api/notifications/read-all failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal memperbarui notifikasi.' });
  }
});

function canAccessTicket(user, ticket) {
  if (user.role === 'admin') return true;
  if (user.role === 'pelapor') return ticket.reporter_id === user.uid;
  const unitUuid = user.unitUuid;
  if (user.role === 'pic') {
    return ticket.assigned_pic_id === user.uid && Boolean(unitUuid && (ticket.target_unit_id || ticket.reporter_unit_id) === unitUuid);
  }
  if (user.role === 'manajemen') {
    return Boolean(unitUuid && (ticket.reporter_unit_id === unitUuid || ticket.target_unit_id === unitUuid));
  }
  return false;
}

const TICKET_SELECT = `
  SELECT t.*, reporter.full_name AS reporter_name, reporter.email AS reporter_email,
         reporter_unit.unit_name AS reporter_unit_name, reporter_unit.unit_code AS reporter_unit_code,
         reporter_unit.unit_type AS reporter_unit_type, reporter_unit.legacy_key AS reporter_unit_legacy_key,
         target_unit.unit_name AS handling_unit_name, target_unit.legacy_key AS handling_unit_legacy_key, target_unit.unit_type AS handling_unit_type,
         category.category_name, category.category_code,
         category.legacy_key AS category_legacy_key, pic.full_name AS current_pic_name,
         pic.team AS current_pic_team
  FROM tickets t
  LEFT JOIN users reporter ON reporter.id = t.reporter_id
  LEFT JOIN units reporter_unit ON reporter_unit.id = t.reporter_unit_id
  LEFT JOIN units target_unit ON target_unit.id = t.target_unit_id
  LEFT JOIN ticket_categories category ON category.id = t.category_id
  LEFT JOIN users pic ON pic.id = t.assigned_pic_id`;

async function loadTicket(ticketId) {
  const result = await query(`${TICKET_SELECT} WHERE t.id = ? LIMIT 1`, [ticketId]);
  return result.rows[0] || null;
}

route.get('/api/tickets', requireAuth, async (req, res) => {
  try {
    const filters = [];
    const params = [];
    if (req.authUser.role === 'pelapor') {
      filters.push('t.reporter_id = ?');
      params.push(req.authUser.uid);
    } else if (req.authUser.role === 'pic') {
      filters.push('(t.assigned_pic_id = ? AND COALESCE(t.target_unit_id,t.reporter_unit_id) = ?)');
      params.push(req.authUser.uid, req.authUser.unitUuid || '');
    } else if (req.authUser.role !== 'admin') {
      if (!req.authUser.unitUuid) return res.json({ success: true, tickets: [], rows: [] });
      filters.push('(t.reporter_unit_id = ? OR t.target_unit_id = ?)');
      params.push(req.authUser.unitUuid, req.authUser.unitUuid);
    }
    const result = await query(
      `${TICKET_SELECT}
       ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
       ORDER BY t.created_at DESC`,
      params
    );
    res.json({ success: true, tickets: result.rows, rows: result.rows });
  } catch (error) {
    console.error('GET /api/tickets failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal memuat data tiket.' });
  }
});

route.get('/api/tickets/:id', requireAuth, async (req, res) => {
  try {
    const ticket = await loadTicket(req.params.id);
    if (!ticket || !canAccessTicket(req.authUser, ticket)) {
      return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan atau akses ditolak.' });
    }
    res.json({ success: true, ticket, record: ticket });
  } catch (error) {
    console.error('GET /api/tickets/:id failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal memuat detail tiket.' });
  }
});

route.post('/api/tickets', requireAuth, async (req, res) => {
  const input = req.body || {};
  const title = String(input.title || '').trim();
  const description = String(input.description || '').trim();
  const categoryKey = String(input.categoryId || '').trim();
  const allowedPriorities = ['Kritis', 'Tinggi', 'Sedang', 'Rendah'];
  const allowedImpacts = ['Individu', 'Tim', 'Departemen', 'Banyak Pengguna'];
  const allowedUrgencies = ['Rendah', 'Sedang', 'Tinggi'];
  if (!title || title.length > 255 || !description || !categoryKey) {
    return res.status(400).json({ success: false, message: 'Judul, deskripsi, dan kategori tiket wajib diisi.' });
  }
  if (!allowedPriorities.includes(input.priority) || !allowedImpacts.includes(input.impact) || !allowedUrgencies.includes(input.urgency)) {
    return res.status(400).json({ success: false, message: 'Prioritas, dampak, atau urgensi tiket tidak valid.' });
  }
  if (!req.authUser.unitUuid && !req.authUser.unitId) return res.status(403).json({ success: false, message: 'Akun belum memiliki unit yang disetujui Admin.' });

  const connection = await connect();
  let inTransaction = false;
  try {
    await connection.query('BEGIN');
    inTransaction = true;
    const { rows: categories } = await connection.query(
      'SELECT id FROM ticket_categories WHERE is_active = 1 AND (id = ? OR legacy_key = ?) LIMIT 1',
      [categoryKey, categoryKey]
    );
    if (!categories[0]) {
      await connection.query('ROLLBACK');
      inTransaction = false;
      return res.status(400).json({ success: false, message: 'Kategori tiket tidak ditemukan atau tidak aktif.' });
    }
    const { rows: slaRows } = await connection.query(
      'SELECT response_minutes, resolve_hours FROM sla_configs WHERE priority = ? AND is_active = 1 LIMIT 1',
      [input.priority]
    );
    const responseMinutes = Number(slaRows[0]?.response_minutes || (input.priority === 'Kritis' ? 15 : 60));
    const resolveHours = Number(slaRows[0]?.resolve_hours || (input.priority === 'Kritis' ? 4 : 24));
    const ticketId = crypto.randomUUID();
    const ticketNumber = `TCU-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const dueAt = new Date(Date.now() + resolveHours * 60 * 60 * 1000);
    const responseDueAt = new Date(Date.now() + responseMinutes * 60 * 1000);
    const tags = Array.isArray(input.tags) ? JSON.stringify(input.tags.slice(0, 20).map((tag) => String(tag).slice(0, 80))) : null;
    const reporterUnitKey = req.authUser.unitUuid || req.authUser.unitId;
    const requestedTarget = req.authUser.role === 'admin' && input.targetUnitId ? input.targetUnitId : reporterUnitKey;
    const { rows: targetUnits } = await connection.query(
      'SELECT id FROM units WHERE is_active = 1 AND (id = ? OR legacy_key = ? OR unit_code = ?) LIMIT 1',
      [requestedTarget, requestedTarget, requestedTarget]
    );
    if (!targetUnits[0]) {
      await connection.query('ROLLBACK');
      inTransaction = false;
      return res.status(400).json({ success: false, message: 'Unit tujuan tiket tidak aktif atau tidak tersedia.' });
    }
    await connection.query(
      `INSERT INTO tickets (
        id, ticket_number, title, description, reporter_id, reporter_unit_id, target_unit_id, category_id,
        ticket_type, department, location, asset_reference, component_id, component_name, subcategory_name,
        tags, status, priority, impact, urgency, internal_priority, response_due_at, resolution_due_at, due_at,
        assignment_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Baru', ?, ?, ?, ?, ?, ?, ?, 'unassigned', NOW(), NOW())`,
      [ticketId, ticketNumber, title, description, req.authUser.uid, req.authUser.unitUuid, targetUnits[0].id, categories[0].id,
        String(input.type || 'Insiden'), req.authUser.department, String(input.location || '').slice(0, 255),
        String(input.assetReference || '').slice(0, 255) || null, String(input.componentId || '').slice(0, 100) || null,
        String(input.componentName || '').slice(0, 255) || null, String(input.subcategoryName || 'Umum').slice(0, 255),
        tags, input.priority, input.impact, input.urgency, Number(input.internalPriority || 0), responseDueAt, dueAt, dueAt]
    );
    await connection.query(
      `INSERT INTO ticket_status_history (id, ticket_id, old_status, new_status, changed_by, note, created_at)
       VALUES (?, ?, NULL, 'Baru', ?, 'Tiket dibuat', NOW())`,
      [crypto.randomUUID(), ticketId, req.authUser.uid]
    );
    await connection.query(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details, created_at)
       VALUES (?, ?, 'TICKET_CREATED', 'ticket', ?, ?, NOW())`,
      [crypto.randomUUID(), req.authUser.uid, ticketId, `Tiket ${ticketNumber} dibuat.`]
    );
    await applyAutoAssignment(connection, ticketId, categories[0].id, targetUnits[0].id, req.authUser.uid);
    await connection.query('COMMIT');
    inTransaction = false;
    const ticket = await loadTicket(ticketId);
    res.status(201).json({ success: true, ticket, record: ticket });
  } catch (error) {
    console.error('POST /api/tickets failed:', error.code || error.name || 'UNKNOWN');
    if (inTransaction) await connection.query('ROLLBACK').catch(() => undefined);
    inTransaction = false;
    res.status(500).json({ success: false, message: 'Gagal menyimpan tiket ke database.' });
  } finally {
    if (inTransaction) await connection.query('ROLLBACK').catch(() => undefined);
    connection.release();
  }
});

route.get('/api/tickets/:id/comments', requireAuth, async (req, res) => {
  try {
    const ticket = await loadTicket(req.params.id);
    if (!ticket || !canAccessTicket(req.authUser, ticket)) {
      return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan atau akses ditolak.' });
    }
    const canReadInternal = ['admin', 'pic', 'manajemen'].includes(req.authUser.role) ? 1 : 0;
    const result = await query(
      `SELECT c.id, c.ticket_id, c.author_id, c.message, c.visibility, c.entry_type, c.created_at,
              u.full_name AS author_name, u.role AS author_role
       FROM ticket_comments c JOIN users u ON u.id = c.author_id
       WHERE c.ticket_id = ? AND (c.visibility = 'public' OR ? = 1) AND c.entry_type = 'comment'
       ORDER BY c.created_at ASC`,
      [req.params.id, canReadInternal]
    );
    res.json({ success: true, comments: result.rows, rows: result.rows });
  } catch (error) {
    console.error('GET ticket comments failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal memuat komentar tiket.' });
  }
});

route.post('/api/tickets/:id/comments', requireAuth, async (req, res) => {
  const message = String(req.body?.message || '').trim();
  const visibility = req.body?.visibility === 'internal' ? 'internal' : 'public';
  if (!message || message.length > 10000) return res.status(400).json({ success: false, message: 'Komentar wajib diisi dan maksimal 10000 karakter.' });
  if (visibility === 'internal' && !['admin', 'pic', 'manajemen'].includes(req.authUser.role)) {
    return res.status(403).json({ success: false, message: 'Komentar internal hanya tersedia untuk petugas.' });
  }
  try {
    const ticket = await loadTicket(req.params.id);
    if (!ticket || !canAccessTicket(req.authUser, ticket)) {
      return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan atau akses ditolak.' });
    }
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO ticket_comments (id, ticket_id, author_id, message, visibility, entry_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'comment', NOW(), NOW())`,
      [id, req.params.id, req.authUser.uid, message, visibility]
    );
    const result = await query(
      `SELECT c.id, c.ticket_id, c.author_id, c.message, c.visibility, c.created_at,
              u.full_name AS author_name, u.role AS author_role
       FROM ticket_comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?`,
      [id]
    );
    res.status(201).json({ success: true, comment: result.rows[0], record: result.rows[0] });
  } catch (error) {
    console.error('POST ticket comment failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal menyimpan komentar tiket.' });
  }
});

route.get('/api/tickets/:id/progress', requireAuth, async (req, res) => {
  try {
    const ticket = await loadTicket(req.params.id);
    if (!ticket || !canAccessTicket(req.authUser, ticket)) {
      return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan atau akses ditolak.' });
    }
    const canReadInternal = ['admin', 'pic', 'manajemen'].includes(req.authUser.role) ? 1 : 0;
    const result = await query(
      `SELECT c.id, c.ticket_id, c.author_id, c.message, c.visibility, c.created_at,
              u.full_name AS author_name, u.role AS author_role
       FROM ticket_comments c JOIN users u ON u.id = c.author_id
       WHERE c.ticket_id = ? AND c.entry_type = 'progress' AND (c.visibility = 'public' OR ? = 1)
       ORDER BY c.created_at DESC`,
      [req.params.id, canReadInternal]
    );
    res.json({ success: true, progresses: result.rows, rows: result.rows });
  } catch (error) {
    console.error('GET ticket progress failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal memuat progres tiket.' });
  }
});

route.post('/api/tickets/:id/progress', requireAuth, requireRole('admin', 'pic'), async (req, res) => {
  const message = String(req.body?.message || '').trim();
  const visibility = req.body?.visibility === 'internal' ? 'internal' : 'public';
  if (!message || message.length > 10000) return res.status(400).json({ success: false, message: 'Progres wajib diisi dan maksimal 10000 karakter.' });
  if (visibility === 'internal' && !['admin', 'pic', 'manajemen'].includes(req.authUser.role)) {
    return res.status(403).json({ success: false, message: 'Progres internal hanya tersedia untuk petugas.' });
  }
  try {
    const ticket = await loadTicket(req.params.id);
    if (!ticket || !canAccessTicket(req.authUser, ticket)) {
      return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan atau akses ditolak.' });
    }
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO ticket_comments (id, ticket_id, author_id, message, visibility, entry_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'progress', NOW(), NOW())`,
      [id, req.params.id, req.authUser.uid, message, visibility]
    );
    const result = await query(
      `SELECT c.id, c.ticket_id, c.author_id, c.message, c.visibility, c.created_at,
              u.full_name AS author_name, u.role AS author_role
       FROM ticket_comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?`,
      [id]
    );
    res.status(201).json({ success: true, progress: result.rows[0], record: result.rows[0] });
  } catch (error) {
    console.error('POST ticket progress failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal menyimpan progres tiket.' });
  }
});

route.get('/api/tickets/:id/activity', requireAuth, async (req, res) => {
  try {
    const ticket = await loadTicket(req.params.id);
    if (!ticket || !canAccessTicket(req.authUser, ticket)) {
      return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan atau akses ditolak.' });
    }
    const result = await query(
      `SELECT h.id, h.ticket_id, h.old_status, h.new_status, h.changed_by, h.note, h.created_at,
              u.full_name AS actor_name, u.role AS actor_role
       FROM ticket_status_history h LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.ticket_id = ? ORDER BY h.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, activity: result.rows, rows: result.rows });
  } catch (error) {
    console.error('GET ticket activity failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal memuat riwayat tiket.' });
  }
});

route.patch('/api/tickets/:id/status', requireAuth, async (req, res) => {
  const newStatus = String(req.body?.status || '');
  const details = String(req.body?.details || '').trim().slice(0, 4000);
  const allowedStatuses = ['Baru', 'Diverifikasi', 'Ditugaskan', 'Dalam Proses', 'Menunggu Pelapor', 'Menunggu Pihak Ketiga', 'Menunggu Persetujuan', 'Selesai', 'Ditutup', 'Ditolak'];
  if (!allowedStatuses.includes(newStatus)) return res.status(400).json({ success: false, message: 'Status tiket tidak valid.' });

  const connection = await connect();
  let inTransaction = false;
  try {
    await connection.query('BEGIN');
    inTransaction = true;
    const { rows: tickets } = await connection.query('SELECT * FROM tickets WHERE id = ? FOR UPDATE', [req.params.id]);
    const ticket = tickets[0];
    if (!ticket || !canAccessTicket(req.authUser, ticket)) {
      await connection.query('ROLLBACK');
      inTransaction = false;
      return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan atau akses ditolak.' });
    }
    const isAdmin = req.authUser.role === 'admin';
    const isAssignedPic = req.authUser.role === 'pic' && ticket.assigned_pic_id === req.authUser.uid;
    const isOwner = req.authUser.role === 'pelapor' && ticket.reporter_id === req.authUser.uid;
    const picStatuses = ['Dalam Proses', 'Menunggu Pelapor', 'Menunggu Pihak Ketiga', 'Selesai'];
    const ownerStatuses = ['Ditutup', 'Dalam Proses'];
    const validByRole = isAdmin || (isAssignedPic && picStatuses.includes(newStatus)) || (isOwner && ownerStatuses.includes(newStatus) && ['Selesai', 'Ditutup'].includes(ticket.status));
    if (!validByRole) {
      await connection.query('ROLLBACK');
      inTransaction = false;
      return res.status(403).json({ success: false, message: 'Peran Anda tidak diizinkan melakukan perubahan status ini.' });
    }
    const newPriority = req.body?.priority;
    if (newPriority && (!isAdmin || !['Kritis', 'Tinggi', 'Sedang', 'Rendah'].includes(newPriority))) {
      await connection.query('ROLLBACK');
      inTransaction = false;
      return res.status(403).json({ success: false, message: 'Perubahan prioritas hanya dapat dilakukan Admin.' });
    }
    const resolution = String(req.body?.resolution || '').trim().slice(0, 10000) || null;
    const rejectionReason = String(req.body?.rejectionReason || '').trim().slice(0, 2000) || null;
    const priorityChangeReason = String(req.body?.priorityChangeReason || '').trim().slice(0, 2000) || null;
    await connection.query(
      `UPDATE tickets SET status = ?, priority = COALESCE(?, priority),
       resolution = COALESCE(?, resolution), rejection_reason = COALESCE(?, rejection_reason),
       priority_change_reason = COALESCE(?, priority_change_reason),
       first_response_at = CASE WHEN first_response_at IS NULL AND ? <> 'Baru' THEN NOW() ELSE first_response_at END,
       resolved_at = CASE WHEN ? = 'Selesai' THEN NOW() WHEN ? = 'Dalam Proses' THEN NULL ELSE resolved_at END,
       closed_at = CASE WHEN ? = 'Ditutup' THEN NOW() WHEN ? = 'Dalam Proses' THEN NULL ELSE closed_at END,
       reopened_count = reopened_count + ?, updated_at = NOW()
       WHERE id = ?`,
      [newStatus, newPriority || null, resolution, rejectionReason, priorityChangeReason, newStatus,
        newStatus, newStatus, newStatus, newStatus, isOwner && newStatus === 'Dalam Proses' ? 1 : 0, ticket.id]
    );
    await connection.query(
      `INSERT INTO ticket_status_history (id, ticket_id, old_status, new_status, changed_by, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [crypto.randomUUID(), ticket.id, ticket.status, newStatus, req.authUser.uid, details || null]
    );
    await connection.query(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, details, created_at)
       VALUES (?, ?, 'TICKET_STATUS_CHANGED', 'ticket', ?, ?, NOW())`,
      [crypto.randomUUID(), req.authUser.uid, ticket.id, `${ticket.status} -> ${newStatus}`]
    );
    await connection.query('COMMIT');
    inTransaction = false;
    const updatedTicket = await loadTicket(ticket.id);
    res.json({ success: true, ticket: updatedTicket, record: updatedTicket });
  } catch (error) {
    console.error('PATCH ticket status failed:', error.code || error.name || 'UNKNOWN');
    if (inTransaction) await connection.query('ROLLBACK').catch(() => undefined);
    inTransaction = false;
    res.status(500).json({ success: false, message: 'Gagal memperbarui status tiket.' });
  } finally {
    if (inTransaction) await connection.query('ROLLBACK').catch(() => undefined);
    connection.release();
  }
});

route.get('/api/tickets/:id/assignable-pics', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const ticket = await loadTicket(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });
    const result = await query(
      `SELECT id, username, employee_number, full_name, email, department, position, unit_id, phone, created_at
       FROM users WHERE role = 'pic' AND account_status = 'active' AND is_active = 1 AND unit_id = ?
       ORDER BY full_name ASC`,
      [ticket.target_unit_id || ticket.reporter_unit_id]
    );
    res.json({ success: true, users: result.rows, rows: result.rows });
  } catch (error) {
    console.error('GET assignable PICs failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal memuat daftar PIC.' });
  }
});

route.post('/api/tickets/:id/assign', requireAuth, requireRole('admin'), async (req, res) => {
  const picId = String(req.body?.picId || '');
  const reason = String(req.body?.reason || '').trim().slice(0, 2000);
  const connection = await connect();
  let inTransaction = false;
  try {
    await connection.query('BEGIN');
    inTransaction = true;
    const { rows: tickets } = await connection.query('SELECT * FROM tickets WHERE id = ? FOR UPDATE', [req.params.id]);
    const ticket = tickets[0];
    if (!ticket) {
      await connection.query('ROLLBACK');
      inTransaction = false;
      return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });
    }
    if (['Selesai','Ditutup','Ditolak'].includes(ticket.status)) {
      await connection.query('ROLLBACK'); inTransaction = false;
      return res.status(409).json({ success: false, message: 'Tiket selesai/ditutup/ditolak tidak dapat ditugaskan ulang. Gunakan alur pembukaan kembali terlebih dahulu.' });
    }
    const { rows: pics } = await connection.query(
      `SELECT id FROM users WHERE id = ? AND role = 'pic' AND account_status = 'active' AND is_active = 1 AND unit_id = ? LIMIT 1 FOR SHARE`,
      [picId, ticket.target_unit_id || ticket.reporter_unit_id]
    );
    if (!pics[0]) {
      await connection.query('ROLLBACK');
      inTransaction = false;
      return res.status(400).json({ success: false, message: 'PIC tidak aktif atau bukan bagian dari unit tiket.' });
    }
    await connection.query(
      `UPDATE tickets SET assigned_pic_id = ?, status = 'Ditugaskan', assignment_status = 'assigned',
       assignment_method = 'manual', assigned_at = NOW(), accepted_at = NULL, in_progress_at = NULL, updated_at = NOW() WHERE id = ?`,
      [picId, ticket.id]
    );
    await connection.query("UPDATE pic_assignments SET assignment_status='completed' WHERE ticket_id=? AND assignment_status IN ('pending','accepted')", [ticket.id]);
    await connection.query(
      `INSERT INTO pic_assignments (id, ticket_id, pic_id, assigned_by, assignment_status, reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, NOW(), NOW())`,
      [crypto.randomUUID(), ticket.id, picId, req.authUser.uid, reason || null]
    );
    await connection.query(
      `INSERT INTO ticket_status_history (id, ticket_id, old_status, new_status, changed_by, note, created_at)
       VALUES (?, ?, ?, 'Ditugaskan', ?, ?, NOW())`,
      [crypto.randomUUID(), ticket.id, ticket.status, req.authUser.uid, reason || 'Tiket ditugaskan kepada PIC.']
    );
    await connection.query(
      `INSERT INTO notifications (id, user_id, ticket_id, title, message, notification_type, is_read, created_at)
       VALUES (?, ?, ?, 'Tiket ditugaskan', ?, 'assignment', 0, NOW())`,
      [crypto.randomUUID(), picId, ticket.id, `Tiket ${ticket.ticket_number} ditugaskan kepada Anda.`]
    );
    await connection.query(
      'INSERT INTO audit_logs (id,actor_id,action,target_type,target_id,details) VALUES (?,?,?,?,?,?)',
      [crypto.randomUUID(), req.authUser.uid, 'TICKET_ASSIGNED', 'ticket', ticket.id, reason || 'Penugasan manual PIC.']
    );
    await connection.query('COMMIT');
    inTransaction = false;
    const updatedTicket = await loadTicket(ticket.id);
    res.json({ success: true, ticket: updatedTicket, record: updatedTicket });
  } catch (error) {
    console.error('POST ticket assignment failed:', error.code || error.name || 'UNKNOWN');
    if (inTransaction) await connection.query('ROLLBACK').catch(() => undefined);
    inTransaction = false;
    res.status(500).json({ success: false, message: 'Gagal menugaskan PIC.' });
  } finally {
    if (inTransaction) await connection.query('ROLLBACK').catch(() => undefined);
    connection.release();
  }
});

route.get('/api/tickets/:id/attachments', requireAuth, async (req, res) => {
  try {
    const ticket = await loadTicket(req.params.id);
    if (!ticket || !canAccessTicket(req.authUser, ticket)) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan atau akses ditolak.' });
    const result = await query(
      `SELECT id, ticket_id, uploaded_by, storage_path, file_name, content_type, file_size, created_at
       FROM ticket_attachments WHERE ticket_id = ? ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json({ success: true, attachments: result.rows, rows: result.rows });
  } catch (error) {
    console.error('GET ticket attachments failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal memuat lampiran tiket.' });
  }
});

route.post('/api/tickets/:id/attachments', requireAuth, async (req, res) => {
  const fileName = String(req.body?.fileName || '').replace(/[\\/\0]/g, '_').slice(0, 255);
  const contentType = String(req.body?.contentType || '');
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'application/pdf', 'text/plain']);
  const encoded = String(req.body?.dataBase64 || '');
  if (!fileName || !allowedTypes.has(contentType) || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    return res.status(400).json({ success: false, message: 'Nama, tipe, atau isi lampiran tidak valid.' });
  }
  const fileBuffer = Buffer.from(encoded, 'base64');
  if (!fileBuffer.length || fileBuffer.length > 10 * 1024 * 1024) return res.status(413).json({ success: false, message: 'Ukuran lampiran harus 1 byte hingga 10 MB.' });
  try {
    const ticket = await loadTicket(req.params.id);
    if (!ticket || !canAccessTicket(req.authUser, ticket)) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan atau akses ditolak.' });
    const attachmentId = crypto.randomUUID();
    const storagePath = `postgresql:${attachmentId}`;
    await query(
      `INSERT INTO ticket_attachments (id, ticket_id, uploaded_by, storage_path, file_name, content_type, file_size, file_content, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [attachmentId, ticket.id, req.authUser.uid, storagePath, fileName, contentType, fileBuffer.length, fileBuffer]
    );
    res.status(201).json({ success: true, attachment: { id: attachmentId, ticket_id: ticket.id, uploaded_by: req.authUser.uid, storage_path: storagePath, file_name: fileName, content_type: contentType, file_size: fileBuffer.length } });
  } catch (error) {
    console.error('POST ticket attachment failed:', error.code || error.name || 'UNKNOWN');
    res.status(500).json({ success: false, message: 'Gagal menyimpan lampiran tiket.' });
  }
});

route.get('/api/ticket_attachments/:id/download', requireAuth, async (req, res) => {
  const result = await query('SELECT * FROM ticket_attachments WHERE id = ?', [req.params.id]);
  const attachment = result.rows[0];
  const ticket = attachment ? await loadTicket(attachment.ticket_id) : null;
  if (!attachment || !ticket || !canAccessTicket(req.authUser, ticket)) return res.status(404).json({ success: false, message: 'Lampiran tidak ditemukan atau akses ditolak.' });
  if (!attachment.file_content) return res.status(404).json({ success: false, message: 'Isi lampiran lama belum dipindahkan ke PostgreSQL.' });
  res.setHeader('Content-Type', attachment.content_type || 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(attachment.file_name)}`);
  res.send(attachment.file_content);
});

route.post('/api/auth/register', async (req, res) => {
  if (consumeRateLimit(`register:${clientKey(req)}`, 8, 15 * 60 * 1000)) {
    return res.status(429).json({ success: false, message: 'Terlalu banyak percobaan pendaftaran. Silakan coba lagi nanti.' });
  }
  try {
    const {
      username,
      fullName,
      employeeId,
      email,
      password,
      department,
      position,
      phone,
      unitId,
      requestedUnitName,
      unitType,
      isManualUnit,
    } = req.body || {};

    const cleanUsername = String(username || '').trim().toLowerCase();
    const cleanFullName = String(fullName || '').trim();
    const cleanEmployeeId = String(employeeId || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '');
    const cleanDepartment = String(department || '').trim();
    const cleanPosition = String(position || '').trim();
    const cleanPhone = String(phone || '').trim();

    if (!cleanUsername || !cleanFullName || !cleanEmployeeId || !cleanEmail || !cleanPassword || !cleanDepartment || !cleanPosition) {
      return res.status(400).json({ success: false, message: 'Nama lengkap, username, NIP, email, password, divisi, dan jabatan wajib diisi.' });
    }

    if (!/^[a-z0-9_.-]{3,100}$/.test(cleanUsername)) {
      return res.status(400).json({ success: false, message: 'Username harus 3-100 karakter dan hanya berisi huruf, angka, titik, garis bawah, atau tanda hubung.' });
    }
    if (cleanFullName.length > 255 || cleanEmployeeId.length > 100 || cleanEmail.length > 191 || cleanDepartment.length > 100 || cleanPosition.length > 100 || cleanPhone.length > 50) {
      return res.status(400).json({ success: false, message: 'Salah satu data pendaftaran melebihi batas panjang yang diizinkan.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Format email tidak valid.' });
    }
    if (!['UPDL', 'CORPU', 'NON_UPDL'].includes(unitType)) {
      return res.status(400).json({ success: false, message: 'Kelompok unit tidak valid.' });
    }
    try { validatePassword(cleanPassword); } catch (error) { return res.status(400).json({ success: false, message: error.message }); }

    const manualUnit = Boolean(isManualUnit);
    const cleanRequestedUnitName = String(requestedUnitName || '').trim().replace(/\s+/g, ' ');
    if (manualUnit) {
      if (unitId || cleanRequestedUnitName.length < 3 || cleanRequestedUnitName.length > 255) {
        return res.status(400).json({ success: false, message: 'Unit manual harus memiliki nama 3-255 karakter dan menunggu verifikasi Admin.' });
      }
    } else {
      if (!unitId) {
        return res.status(400).json({ success: false, message: 'Pilih unit aktif dari master database.' });
      }
      const selectedUnit = await query(
        'SELECT id FROM units WHERE id = ? AND unit_type = ? AND is_active = 1 LIMIT 1',
        [unitId, unitType]
      );
      if (selectedUnit.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Unit tidak aktif atau tidak sesuai kelompok unit yang dipilih.' });
      }
    }

    const passwordHash = await bcrypt.hash(cleanPassword, 12);
    const requestId = crypto.randomUUID();
    const now = new Date();
    const connection = await connect();
    let inTransaction = false;
    try {
      await connection.query('BEGIN');
      inTransaction = true;
      await connection.query("SET LOCAL lock_timeout = '5s'");
      await connection.query('SELECT pg_advisory_xact_lock(41026, 2)');
      for (const [field, value, message] of [
        ['username', cleanUsername, 'Username sudah digunakan atau sedang menunggu verifikasi.'],
        ['email', cleanEmail, 'Email korporat sudah terdaftar atau sedang menunggu verifikasi.'],
        ['employee_number', cleanEmployeeId, 'NIP / ID pegawai sudah terdaftar atau sedang menunggu verifikasi.'],
      ]) {
        const { rows: users } = await connection.query(`SELECT 1 FROM users WHERE LOWER(${field}) = LOWER(?) LIMIT 1`, [value]);
        const { rows: requests } = await connection.query(`SELECT 1 FROM registration_requests WHERE LOWER(${field}) = LOWER(?) LIMIT 1`, [value]);
        if (users.length || requests.length) {
          await connection.query('ROLLBACK');
          inTransaction = false;
          return res.status(409).json({ success: false, message });
        }
      }

      await connection.query(
        `INSERT INTO registration_requests (
          id, username, full_name, employee_number, email, password_hash, department, position, phone,
          requested_unit_id, requested_unit_name, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
        [
          requestId,
          cleanUsername,
          cleanFullName,
          cleanEmployeeId,
          cleanEmail,
          passwordHash,
          cleanDepartment,
          cleanPosition,
          cleanPhone || null,
          manualUnit ? null : unitId,
          manualUnit ? cleanRequestedUnitName : null,
        ]
      );
      await connection.query('COMMIT');
      inTransaction = false;
    } finally {
      if (inTransaction) await connection.query('ROLLBACK').catch(() => undefined);
      connection.release();
    }

    return res.status(201).json({
      success: true,
      submitted: true,
      requestId,
      submittedAt: now.toISOString(),
      message: 'Permohonan pendaftaran berhasil dikirim dan menunggu verifikasi admin.',
    });
  } catch (error) {
    console.error('POST /api/auth/register failed:', error.code || error.name || 'UNKNOWN');
    return res.status(500).json({ success: false, message: 'Gagal menyimpan permohonan pendaftaran ke database.' });
  }
});

route.post('/api/auth/login', async (req, res) => {
  if (consumeRateLimit(`login:${clientKey(req)}`, options.maxLoginAttempts || 20, 15 * 60 * 1000)) {
    return res.status(429).json({ success: false, message: 'Terlalu banyak percobaan masuk. Silakan coba lagi nanti.' });
  }
  try {
    const identifier = String(req.body?.identifier || '').trim();
    const password = String(req.body?.password || '');

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Username/NIP/email dan password wajib diisi.' });
    }

    const userResult = await query(
      `SELECT u.*, un.unit_code, un.unit_name, un.unit_type, un.legacy_key
       FROM users u LEFT JOIN units un ON un.id = u.unit_id
       WHERE lower(u.email) = lower(?) OR lower(u.username) = lower(?) OR lower(u.employee_number) = lower(?)
       LIMIT 1`,
      [identifier, identifier, identifier]
    );

    if (userResult.rows.length === 0) {
      const pending = await query(
        `SELECT status, password_hash FROM registration_requests
         WHERE lower(email) = lower(?) OR lower(username) = lower(?) OR lower(employee_number) = lower(?)
         ORDER BY created_at DESC LIMIT 1`,
        [identifier, identifier, identifier]
      );
      const pendingPasswordValid = pending.rows[0]?.password_hash && await bcrypt.compare(password, pending.rows[0].password_hash);
      if (pendingPasswordValid && pending.rows[0]?.status === 'pending') {
        return res.status(403).json({ success: false, message: 'Akun Anda masih menunggu persetujuan Admin dan belum dapat masuk ke dashboard.' });
      }
      if (pendingPasswordValid && pending.rows[0]?.status === 'rejected') {
        return res.status(403).json({ success: false, message: 'Permohonan pendaftaran Anda ditolak. Hubungi Admin untuk informasi lebih lanjut.' });
      }
      return res.status(401).json({ success: false, message: 'Identitas atau password tidak valid.' });
    }

    const user = userResult.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Identitas atau password tidak valid.' });
    }
    if (user.account_status === 'pending' || user.registration_status === 'pending') {
      return res.status(403).json({ success: false, message: 'Akun Anda masih menunggu persetujuan Admin dan belum dapat masuk ke dashboard.' });
    }
    if (user.account_status === 'rejected' || user.registration_status === 'rejected') {
      return res.status(403).json({ success: false, message: 'Akun Anda ditolak dan tidak dapat digunakan untuk masuk.' });
    }
    if (user.account_status === 'disabled' || user.account_status === 'suspended' || !user.is_active) {
      return res.status(403).json({ success: false, message: 'Akun Anda dinonaktifkan. Hubungi Administrator.' });
    }

    await query(`UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = ?`, [user.id]);

    const sanitized = mapUserRow(user);

    setAuthCookie(res, signAuthToken(user.id, user.auth_version || 0));
    return res.json({ success: true, user: sanitized });
  } catch (error) {
    console.error('POST /api/auth/login failed:', error.code || error.name || 'UNKNOWN');
    return res.status(500).json({ success: false, message: 'Login server gagal.' });
  }
});

route.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.authUser });
});

route.post('/api/auth/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

installAdminRoutes(route, { query, transaction, requireAuth, requireRole, mapUserRow, loadTicket });

app.use('/api', (_req, res) => res.status(404).json({ success: false, message: 'Endpoint API tidak ditemukan.' }));
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
app.use(express.static(dist, { index: 'index.html', dotfiles: 'deny' }));
app.get('*', (req, res, next) => {
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(dist, 'index.html'), error => { if (error && !res.headersSent) res.status(503).type('text').send('Frontend belum dibangun. Jalankan npm run build, atau npm run dev untuk pengembangan.'); });
});
app.use((error, _req, res, _next) => {
  if (res.headersSent) return;
  if (error instanceof InputError) return res.status(error.status).json({ success: false, message: error.message });
  if (error.type === 'entity.too.large') return res.status(413).json({ success: false, message: 'Ukuran permintaan terlalu besar.' });
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ success: false, message: 'Format JSON tidak valid.' });
  if (error.message === 'Origin tidak diizinkan.') return res.status(403).json({ success: false, message: error.message });
  if (error.code === '23505') return res.status(409).json({ success: false, message: 'Data identitas/kode sudah digunakan.' });
  if (error.code === '23503') return res.status(409).json({ success: false, message: 'Data masih digunakan atau referensi tidak valid.' });
  if (error.code === '23514' || error.code === '22001') return res.status(400).json({ success: false, message: 'Data tidak memenuhi batasan database.' });
  console.error('API error:', error.code || error.name || 'UNKNOWN');
  res.status(503).json({ success: false, message: 'Operasi belum berhasil. Periksa koneksi database dan log server.' });
});
return app;
}
