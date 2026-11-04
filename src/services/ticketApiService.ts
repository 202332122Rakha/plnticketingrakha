import type { ActivityLog, Category, Comment, PriorityLevel, Progress, Ticket, TicketStatus, TicketType, Unit, UnitType, User } from '../types';
import { apiFetch, notifyDataChanged } from './http';
import { canAccessUnitType } from '../utils/authPermissions';

interface NewTicketInput {
  title: string;
  description: string;
  type: TicketType;
  categoryId: string;
  componentId?: string;
  componentName?: string;
  subcategoryName: string;
  department: string;
  location: string;
  assetReference?: string;
  impact: Ticket['impact'];
  urgency: Ticket['urgency'];
  priority: PriorityLevel;
  tags?: string[];
  targetUnitId?: string;
}

async function readApiResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) {
    throw new Error(body.message || `Permintaan gagal (${response.status}).`);
  }
  return body;
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function mapTicket(row: Record<string, any>): Ticket {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    title: row.title,
    description: row.description,
    type: row.ticket_type || 'Insiden',
    categoryId: row.category_legacy_key || row.category_id || '',
    categoryName: row.category_name || 'Kategori tidak tersedia',
    categoryCode: row.category_code || row.category_legacy_key || undefined,
    componentId: row.component_id || undefined,
    componentName: row.component_name || undefined,
    subcategoryId: row.subcategory_name || '',
    subcategoryName: row.subcategory_name || 'Umum',
    reporterId: row.reporter_id || '',
    reporterName: row.reporter_name || '',
    reporterEmail: row.reporter_email || '',
    reporterUnitId: row.reporter_unit_legacy_key || row.reporter_unit_id || undefined,
    reporterUnitName: row.reporter_unit_name || undefined,
    reporterUnitCode: row.reporter_unit_code || undefined,
    reporterUnitType: row.reporter_unit_type || 'UNCLASSIFIED',
    handlingUnitId: row.handling_unit_legacy_key || row.target_unit_id || undefined,
    department: row.department || '',
    location: row.location || '',
    assetReference: row.asset_reference || undefined,
    impact: row.impact,
    urgency: row.urgency,
    priority: row.priority,
    status: row.status,
    currentPicId: row.assigned_pic_id || undefined,
    currentPicName: row.current_pic_name || undefined,
    currentPicTeam: row.current_pic_team || undefined,
    assignedPicId: row.assigned_pic_id || undefined,
    assignedTeam: row.assigned_team_id || undefined,
    assignmentMethod: row.assignment_method || undefined,
    assignmentStatus: row.assignment_status || (row.assigned_pic_id ? 'assigned' : 'unassigned'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignedAt: row.assigned_at || undefined,
    acceptedAt: row.accepted_at || undefined,
    inProgressAt: row.in_progress_at || undefined,
    resolvedAt: row.resolved_at || undefined,
    closedAt: row.closed_at || undefined,
    dueAt: row.due_at || row.resolution_due_at || row.created_at,
    slaResponseDueAt: row.response_due_at || undefined,
    firstResponseAt: row.first_response_at || undefined,
    resolution: row.resolution || undefined,
    resolutionProofUrl: row.resolution_proof_path || undefined,
    reopenedCount: Number(row.reopened_count || 0),
    rejectionReason: row.rejection_reason || undefined,
    priorityChangeReason: row.priority_change_reason || undefined,
    tags: parseTags(row.tags),
  };
}

function mapComment(row: Record<string, any>): Comment {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    authorId: row.author_id,
    authorName: row.author_name || '',
    authorRole: row.author_role,
    message: row.message,
    visibility: row.visibility,
    createdAt: row.created_at,
  };
}

export async function listTickets(): Promise<Ticket[]> {
  const response = await apiFetch('/api/tickets', { headers: { Accept: 'application/json' } });
  const body = await readApiResponse(response);
  return (body.tickets as Array<Record<string, any>>).map(mapTicket);
}

export async function getTicket(ticketId: string): Promise<Ticket | null> {
  const response = await apiFetch(`/api/tickets/${encodeURIComponent(ticketId)}`, { headers: { Accept: 'application/json' } });
  if (response.status === 404) return null;
  const body = await readApiResponse(response);
  return mapTicket(body.ticket);
}

export async function createTicket(input: NewTicketInput): Promise<Ticket> {
  const response = await apiFetch('/api/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await readApiResponse(response);
  window.dispatchEvent(new Event('ticket-data-changed'));
  return mapTicket(body.ticket);
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  details?: string,
  options: { resolution?: string; rejectionReason?: string; priority?: PriorityLevel; priorityChangeReason?: string } = {}
): Promise<Ticket> {
  const response = await apiFetch(`/api/tickets/${encodeURIComponent(ticketId)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ status, details, ...options }),
  });
  const body = await readApiResponse(response);
  window.dispatchEvent(new Event('ticket-data-changed'));
  return mapTicket(body.ticket);
}

export async function assignTicket(ticketId: string, picId: string, reason: string): Promise<Ticket> {
  const response = await apiFetch(`/api/tickets/${encodeURIComponent(ticketId)}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ picId, reason }),
  });
  const body = await readApiResponse(response);
  window.dispatchEvent(new Event('ticket-data-changed'));
  return mapTicket(body.ticket);
}

export async function listAssignablePics(ticketId: string): Promise<User[]> {
  const response = await apiFetch(`/api/tickets/${encodeURIComponent(ticketId)}/assignable-pics`, { headers: { Accept: 'application/json' } });
  const body = await readApiResponse(response);
  return (body.users as Array<Record<string, any>>).map((user) => ({
    uid: user.id,
    username: user.username || undefined,
    employeeId: user.employee_number || '',
    name: user.full_name,
    email: user.email,
    department: user.department || '',
    position: user.position || undefined,
    role: 'pic',
    unitId: user.unit_id || undefined,
    isActive: true,
    phone: user.phone || undefined,
    createdAt: user.created_at,
  }));
}

export async function addTicketComment(input: { ticketId: string; authorId: string; message: string; visibility: 'public' | 'internal' }): Promise<Comment> {
  const response = await apiFetch(`/api/tickets/${encodeURIComponent(input.ticketId)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ message: input.message, visibility: input.visibility }),
  });
  const body = await readApiResponse(response);
  window.dispatchEvent(new Event('ticket-data-changed'));
  return mapComment(body.comment);
}

export async function listTicketComments(ticketId: string): Promise<Comment[]> {
  const response = await apiFetch(`/api/tickets/${encodeURIComponent(ticketId)}/comments`, { headers: { Accept: 'application/json' } });
  const body = await readApiResponse(response);
  return (body.comments as Array<Record<string, any>>).map(mapComment);
}

export async function addTicketProgress(input: {
  ticketId: string;
  authorId: string;
  message: string;
  statusBefore: TicketStatus;
  statusAfter: TicketStatus;
  visibility: 'public' | 'internal';
}): Promise<Progress> {
  const response = await apiFetch(`/api/tickets/${encodeURIComponent(input.ticketId)}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ message: input.message, visibility: input.visibility }),
  });
  const body = await readApiResponse(response);
  window.dispatchEvent(new Event('ticket-data-changed'));
  const entry = body.progress;
  return { ...mapComment(entry), statusBefore: input.statusBefore, statusAfter: input.statusAfter };
}

export async function listTicketProgress(ticketId: string): Promise<Progress[]> {
  const response = await apiFetch(`/api/tickets/${encodeURIComponent(ticketId)}/progress`, { headers: { Accept: 'application/json' } });
  const body = await readApiResponse(response);
  return (body.progresses as Array<Record<string, any>>).map((entry) => ({ ...mapComment(entry), statusBefore: undefined, statusAfter: undefined }));
}

export async function listTicketActivity(ticketId: string): Promise<ActivityLog[]> {
  const response = await apiFetch(`/api/tickets/${encodeURIComponent(ticketId)}/activity`, { headers: { Accept: 'application/json' } });
  const body = await readApiResponse(response);
  return (body.activity as Array<Record<string, any>>).map((entry) => ({
    id: entry.id,
    ticketId: entry.ticket_id,
    ticketNumber: '',
    actorId: entry.changed_by || '',
    actorName: entry.actor_name || 'Sistem',
    actorRole: entry.actor_role || 'admin',
    action: entry.old_status ? 'STATUS_DIUBAH' : 'TIKET_DIBUAT',
    beforeValue: entry.old_status || undefined,
    afterValue: entry.new_status,
    details: entry.note || undefined,
    createdAt: entry.created_at,
  }));
}

export async function uploadTicketAttachment(ticket: Ticket, _userId: string, file: File): Promise<void> {
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'application/pdf', 'text/plain']);
  if (!allowedTypes.has(file.type)) throw new Error(`Jenis file ${file.name} tidak diizinkan.`);
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error(`Ukuran file ${file.name} melebihi batas 10 MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  const response = await apiFetch(`/api/tickets/${encodeURIComponent(ticket.id)}/attachments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ fileName: file.name, contentType: file.type, dataBase64: btoa(binary) }),
  });
  await readApiResponse(response);
}

export async function listCategories(): Promise<Category[]> {
  const response = await apiFetch('/api/ticket_categories', { headers: { Accept: 'application/json' } });
  const body = await readApiResponse(response);
  return (body.categories as Array<Record<string, any>>).map((row) => ({
    id: row.legacy_key || row.id,
    code: row.category_code || row.legacy_key || row.id,
    name: row.category_name,
    description: row.description || '',
    subcategories: parseTags(row.subcategories),
    defaultTeam: row.default_team || '',
    defaultSlaResponseMinutes: Number(row.default_sla_response_minutes || 15),
    defaultSlaResolveHours: Number(row.default_sla_resolve_hours || 4),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at || undefined,
  }));
}

export async function listTicketsByUnitType(
  currentUser: User,
  unitType: UnitType,
  selectedUnitId?: string
): Promise<{ authorized: boolean; unit: Unit | null; units: Unit[]; tickets: Ticket[]; error?: string }> {
  if (!canAccessUnitType(currentUser, unitType)) {
    return { authorized: false, unit: null, units: [], tickets: [], error: 'Akses ke kelompok unit ini tidak diizinkan.' };
  }
  const [unitResponse, tickets] = await Promise.all([
    apiFetch('/api/units', { headers: { Accept: 'application/json' } }).then(readApiResponse),
    listTickets(),
  ]);
  const units: Unit[] = (unitResponse.units as Array<Record<string, any>>)
    .filter((unit) => unit.unit_type === unitType && unit.is_active)
    .map((unit) => ({
      unitId: unit.legacy_key || unit.id,
      unitCode: unit.unit_code,
      unitName: unit.unit_name,
      unitRegion: unit.unit_region || 'Non-UPDL',
      unitFocus: unit.unit_focus || '',
      unitType: unit.unit_type,
      isActive: Boolean(unit.is_active),
      createdAt: unit.created_at,
      updatedAt: unit.updated_at,
    }));
  const canSeeAll = currentUser.role === 'admin' || currentUser.role === 'manajemen';
  const effectiveUnitId = canSeeAll ? selectedUnitId : currentUser.unitId;
  const unit = effectiveUnitId && effectiveUnitId !== 'ALL'
    ? units.find((item) => item.unitId === effectiveUnitId || item.unitCode === effectiveUnitId) || null
    : null;
  if (effectiveUnitId && effectiveUnitId !== 'ALL' && !unit) {
    return { authorized: false, unit: null, units: [], tickets: [], error: 'Unit tidak ditemukan atau berada di luar kelompok yang diizinkan.' };
  }
  let scopedTickets = tickets.filter((ticket) => ticket.reporterUnitType === unitType);
  if (unit) scopedTickets = scopedTickets.filter((ticket) => ticket.reporterUnitId === unit.unitId || ticket.reporterUnitCode === unit.unitCode);
  return { authorized: true, unit, units: canSeeAll ? units : unit ? [unit] : [], tickets: scopedTickets };
}
