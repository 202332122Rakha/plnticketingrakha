// @ts-nocheck
import { units, categories, slaList } from '../server/master-data.js';

const mockUnits = units.map((u: any) => ({
  id: u.key,
  legacy_key: u.key,
  unit_code: u.code,
  unit_name: u.name,
  unit_type: u.type,
  unit_region: u.region,
  unit_focus: u.focus,
  is_active: 1
}));

const mockCategories = categories.map((c: any) => ({
  id: c.key,
  legacy_key: c.key,
  category_code: c.key.replace('cat-', '').toUpperCase(),
  category_name: c.name,
  description: c.desc,
  subcategories: JSON.stringify(['Umum', 'Standar']),
  default_team: 'IT Support',
  default_sla_response_minutes: 15,
  default_sla_resolve_hours: 4,
  is_active: 1
}));

const mockUsers = [
  {
    id: 'usr-admin-1',
    username: 'admin',
    employee_id: 'ADMIN-001',
    full_name: 'Administrator Ticketing',
    email: 'admin@corpu.pln.co.id',
    role: 'admin',
    unit_id: 'unit-pln-corpu',
    unit_code: 'PLN_CORPU',
    unit_name: 'PLN Corporate University (PLN Corpu)',
    unit_type: 'CORPU',
    account_status: 'active',
    is_active: 1,
    department: 'Corporate IT & HXMS Governance'
  },
  {
    id: 'usr-pic-1',
    username: 'pic_jaringan',
    employee_id: 'PIC-001',
    full_name: 'Ahmad Rizki (PIC Jaringan)',
    email: 'ahmad.rizki@corpu.pln.co.id',
    role: 'pic',
    unit_id: 'unit-pln-corpu',
    unit_code: 'PLN_CORPU',
    unit_name: 'PLN Corporate University (PLN Corpu)',
    unit_type: 'CORPU',
    team: 'IT Infrastructure',
    account_status: 'active',
    is_active: 1,
    department: 'Infrastruktur TI'
  },
  {
    id: 'usr-pelapor-1',
    username: 'pelapor_jkt',
    employee_id: 'PLP-001',
    full_name: 'Budi Santoso (Instruktur UPDL Jakarta)',
    email: 'budi.santoso@updljkt.pln.co.id',
    role: 'pelapor',
    unit_id: 'unit-updl-jkt',
    unit_code: 'UPDL_JKT',
    unit_name: 'PLN UPDL Jakarta',
    unit_type: 'UPDL',
    account_status: 'active',
    is_active: 1,
    department: 'Leadership Academy'
  }
];

const mockTickets: any[] = [
  {
    id: 'tkt-001',
    ticket_number: 'TKT-2026-0001',
    title: 'Kendala Koneksi Wi-Fi di Lab Simulasi Gedung Diklat',
    description: 'Koneksi Wi-Fi di Lab Komputer terputus secara berkala saat simulasi SCADA.',
    type: 'Gangguan (Incident)',
    category_id: 'cat-net',
    category_name: 'Jaringan dan Internet',
    subcategory_name: 'Wi-Fi Tidak Terdeteksi',
    department: 'Leadership Academy',
    location: 'Lab Komputer Lantai 2',
    impact: 'Signifikan / Departemen',
    urgency: 'Segera',
    priority: 'Tinggi',
    status: 'Dalam Proses',
    reporter_id: 'usr-pelapor-1',
    reporter_name: 'Budi Santoso (Instruktur UPDL Jakarta)',
    reporter_email: 'budi.santoso@updljkt.pln.co.id',
    reporter_unit_id: 'unit-updl-jkt',
    reporter_unit_code: 'UPDL_JKT',
    reporter_unit_name: 'PLN UPDL Jakarta',
    reporter_unit_type: 'UPDL',
    handling_unit_id: 'unit-pln-corpu',
    handling_unit_code: 'PLN_CORPU',
    handling_unit_name: 'PLN Corporate University (PLN Corpu)',
    handling_unit_type: 'CORPU',
    assigned_pic_id: 'usr-pic-1',
    assigned_pic_name: 'Ahmad Rizki (PIC Jaringan)',
    assigned_team: 'IT Infrastructure',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

const mockRegistrations: any[] = [];

export function handleMockApi(pathname: string, method: string, body: any): Response | null {
  const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });

  // Health
  if (pathname === '/api/health') {
    return json({ ok: true, status: 'healthy', mode: 'standalone_worker', message: 'Worker melayani API tanpa database eksternal.' });
  }

  // Auth me
  if (pathname === '/api/auth/me') {
    return json({ success: true, user: mockUsers[0] });
  }

  // Auth login
  if (pathname === '/api/auth/login' && method === 'POST') {
    const ident = (body?.identifier || '').toLowerCase();
    const found = mockUsers.find((u: any) => u.username.toLowerCase() === ident || u.email.toLowerCase() === ident) || mockUsers[0];
    return json({ success: true, user: found });
  }

  // Auth logout
  if (pathname === '/api/auth/logout') {
    return json({ success: true });
  }

  // Units
  if (pathname === '/api/units') {
    return json({ success: true, units: mockUnits });
  }

  // Categories
  if (pathname === '/api/ticket_categories') {
    return json({ success: true, categories: mockCategories });
  }

  // Tickets
  if (pathname === '/api/tickets') {
    if (method === 'POST') {
      const newT = {
        id: `tkt-${Date.now()}`,
        ticket_number: `TKT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        title: body?.title || 'Tiket Layanan',
        description: body?.description || '',
        type: body?.type || 'Permintaan Layanan',
        category_id: body?.categoryId || 'cat-net',
        category_name: 'Jaringan dan Internet',
        subcategory_name: body?.subcategoryName || 'Umum',
        department: body?.department || 'Operasional',
        location: body?.location || 'Ruang Diklat',
        impact: body?.impact || 'Rendah / Individu',
        urgency: body?.urgency || 'Normal',
        priority: body?.priority || 'Sedang',
        status: 'Baru',
        reporter_id: mockUsers[0].id,
        reporter_name: mockUsers[0].full_name,
        reporter_email: mockUsers[0].email,
        reporter_unit_id: mockUsers[0].unit_id,
        reporter_unit_code: mockUsers[0].unit_code,
        reporter_unit_name: mockUsers[0].unit_name,
        reporter_unit_type: mockUsers[0].unit_type,
        handling_unit_id: 'unit-pln-corpu',
        handling_unit_code: 'PLN_CORPU',
        handling_unit_name: 'PLN Corporate University (PLN Corpu)',
        handling_unit_type: 'CORPU',
        assigned_pic_id: 'usr-pic-1',
        assigned_pic_name: 'Ahmad Rizki (PIC Jaringan)',
        assigned_team: 'IT Infrastructure',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockTickets.unshift(newT);
      return json({ success: true, ticket: newT }, 201);
    }
    return json({ success: true, tickets: mockTickets });
  }

  // Users
  if (pathname === '/api/users') {
    return json({ success: true, users: mockUsers });
  }

  // Registration Requests
  if (pathname === '/api/registration_requests') {
    return json({ success: true, requests: mockRegistrations });
  }

  // Register
  if (pathname === '/api/auth/register' && method === 'POST') {
    const reg = {
      id: `reg-${Date.now()}`,
      username: body?.username,
      full_name: body?.fullName,
      employee_number: body?.employeeId,
      email: body?.email,
      department: body?.department,
      position: body?.position,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    mockRegistrations.unshift(reg);
    return json({ success: true, submitted: true, requestId: reg.id }, 201);
  }

  // Assignment rules, SLA, Audit logs
  if (pathname === '/api/assignment_rules') return json({ success: true, rules: [] });
  if (pathname === '/api/sla_configs') {
    return json({ success: true, configs: slaList.map((s: any) => ({ priority: s.priority, responseMinutes: s.response, resolutionTimeHours: s.resolve, description: s.desc })) });
  }
  if (pathname === '/api/audit_logs') return json({ success: true, logs: [] });
  if (pathname === '/api/notifications') return json({ success: true, notifications: [] });

  return null;
}
