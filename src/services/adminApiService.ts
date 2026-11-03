import type { ActivityLog, AutoAssignmentRule, Category, Role, Ticket, Unit, UnitRegion, UnitType, User } from '../types';
import { apiFetch, notifyDataChanged, readApiResponse } from './http';

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function mapUnit(row: Record<string, any>): Unit {
  return {
    unitId: row.legacy_key || row.id,
    unitCode: row.unit_code,
    unitName: row.unit_name,
    unitRegion: (row.unit_region || 'Non-UPDL') as UnitRegion,
    unitFocus: row.unit_focus || '',
    unitType: row.unit_type as UnitType,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapUser(row: Record<string, any>): User {
  if (row.uid && row.employeeId !== undefined) return { ...row, expertise: parseJsonArray(row.expertise) } as User;
  return {
    uid: row.user_id || row.id || row.uid,
    username: row.username || undefined,
    employeeId: row.employee_id || row.employee_number || '',
    name: row.full_name || row.name,
    email: row.email,
    department: row.department || '',
    position: row.position || undefined,
    role: row.role,
    unitId: row.unit_legacy_key || row.unit_id || undefined,
    unitCode: row.unit_code || undefined,
    unitName: row.unit_name || undefined,
    unitType: row.unit_type || undefined,
    team: row.team || undefined,
    expertise: parseJsonArray(row.expertise),
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : row.account_status === 'active',
    phone: row.phone || undefined,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at || undefined,
  };
}

export function mapCategory(row: Record<string, any>): Category {
  return {
    id: row.legacy_key || row.id,
    code: row.category_code || row.legacy_key || row.id,
    name: row.category_name || row.name,
    description: row.description || '',
    subcategories: parseJsonArray(row.subcategories),
    defaultTeam: row.default_team || '',
    defaultSlaResponseMinutes: Number(row.default_sla_response_minutes || 15),
    defaultSlaResolveHours: Number(row.default_sla_resolve_hours || 4),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at || undefined,
  };
}

export async function listUnits(includeInactive = false): Promise<Unit[]> {
  const response = await apiFetch(`/api/units${includeInactive ? '?includeInactive=1' : ''}`);
  const body = await readApiResponse(response);
  return (body.units as Array<Record<string, any>>).map(mapUnit);
}

export async function createUnit(input: { unitCode: string; unitName: string; unitType: UnitType; unitRegion: string; unitFocus: string }): Promise<Unit> {
  const response = await apiFetch('/api/units', { method: 'POST', body: JSON.stringify(input) });
  const body = await readApiResponse(response);
  notifyDataChanged();
  return mapUnit(body.unit);
}

export async function updateUnit(unitId: string, input: Partial<Unit>): Promise<Unit> {
  const response = await apiFetch(`/api/units/${encodeURIComponent(unitId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      unitCode: input.unitCode,
      unitName: input.unitName,
      unitType: input.unitType,
      unitRegion: input.unitRegion,
      unitFocus: input.unitFocus,
      isActive: input.isActive,
    }),
  });
  const body = await readApiResponse(response);
  notifyDataChanged();
  return mapUnit(body.unit);
}

export async function toggleUnitActive(unitId: string): Promise<Unit> {
  const response = await apiFetch(`/api/units/${encodeURIComponent(unitId)}/toggle`, { method: 'POST' });
  const body = await readApiResponse(response);
  notifyDataChanged();
  return mapUnit(body.unit);
}

export async function deleteUnit(unitId: string): Promise<void> {
  const response = await apiFetch(`/api/units/${encodeURIComponent(unitId)}`, { method: 'DELETE' });
  await readApiResponse(response);
  notifyDataChanged();
}

export async function listAdminUsers(): Promise<User[]> {
  const response = await apiFetch('/api/users?includeInactive=1');
  const body = await readApiResponse(response);
  return (body.users as Array<Record<string, any>>).map(mapUser);
}

export async function createAdminUser(input: {
  username: string;
  employeeId: string;
  name: string;
  email: string;
  password: string;
  department: string;
  position?: string;
  role: Role;
  unitId: string;
  team?: string;
  expertise?: string[];
  phone?: string;
  isActive: boolean;
}): Promise<User> {
  const response = await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(input) });
  const body = await readApiResponse(response);
  notifyDataChanged();
  return mapUser(body.user);
}

export async function updateAdminUser(userId: string, input: Record<string, unknown>): Promise<User> {
  const response = await apiFetch(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  const body = await readApiResponse(response);
  notifyDataChanged();
  return mapUser(body.user);
}

export async function resetUserPassword(userId: string, password: string): Promise<void> {
  const response = await apiFetch(`/api/users/${encodeURIComponent(userId)}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  await readApiResponse(response);
  notifyDataChanged();
}

export async function reassignPicTickets(fromPicId: string, toPicId: string, reason: string): Promise<void> {
  const response = await apiFetch(`/api/users/${encodeURIComponent(fromPicId)}/reassign-tickets`, {
    method: 'POST',
    body: JSON.stringify({ toPicId, reason }),
  });
  await readApiResponse(response);
  notifyDataChanged();
}

export async function listAdminCategories(): Promise<Category[]> {
  const response = await apiFetch('/api/ticket_categories?includeInactive=1');
  const body = await readApiResponse(response);
  return (body.categories as Array<Record<string, any>>).map(mapCategory);
}

export async function saveAdminCategory(category: Category, existing = Boolean(category.createdAt && category.id)): Promise<Category> {
  const response = await apiFetch('/api/ticket_categories', {
    method: existing ? 'PUT' : 'POST',
    body: JSON.stringify({
      id: category.id,
      code: category.code,
      name: category.name,
      description: category.description,
      subcategories: category.subcategories,
      defaultTeam: category.defaultTeam,
      defaultSlaResponseMinutes: category.defaultSlaResponseMinutes,
      defaultSlaResolveHours: category.defaultSlaResolveHours,
      isActive: category.isActive,
    }),
  });
  const body = await readApiResponse(response);
  notifyDataChanged();
  return mapCategory(body.category);
}

export async function deleteAdminCategory(categoryId: string): Promise<void> {
  const response = await apiFetch(`/api/ticket_categories/${encodeURIComponent(categoryId)}`, { method: 'DELETE' });
  await readApiResponse(response);
  notifyDataChanged();
}

export async function listAuditLogs(): Promise<ActivityLog[]> {
  const response = await apiFetch('/api/audit_logs');
  const body = await readApiResponse(response);
  return (body.logs as Array<Record<string, any>>).map((row) => ({
    id: row.id,
    ticketId: row.target_id || '',
    ticketNumber: row.ticket_number || row.target_id || '',
    actorId: row.actor_id || '',
    actorName: row.actor_name || 'Sistem',
    actorRole: row.actor_role || 'admin',
    action: row.action,
    details: row.details || undefined,
    createdAt: row.created_at,
  }));
}

export async function classifyTicketUnit(ticketId: string, unitKey: string): Promise<Ticket> {
  const response = await apiFetch(`/api/tickets/${encodeURIComponent(ticketId)}/classify-unit`, {
    method: 'PATCH',
    body: JSON.stringify({ unitKey }),
  });
  const body = await readApiResponse(response);
  notifyDataChanged();
  return body.ticket;
}

export async function listAssignmentRules(): Promise<AutoAssignmentRule[]> {
  const response = await apiFetch('/api/assignment_rules');
  const body = await readApiResponse(response);
  return (body.rules as Array<Record<string, any>>).map((row) => ({
    id: row.id,
    categoryId: row.category_legacy_key || row.category_id,
    categoryName: row.category_name,
    targetTeam: row.target_team,
    defaultPicId: row.default_pic_id || undefined,
    defaultPicName: row.default_pic_name || undefined,
    loadBalancingStrategy: row.load_balancing_strategy,
    isActive: Boolean(row.is_active),
    notes: row.notes || undefined,
  }));
}

export async function saveAssignmentRule(rule: AutoAssignmentRule): Promise<void> {
  const response = await apiFetch(`/api/assignment_rules/${encodeURIComponent(rule.id)}`, {
    method: 'PUT',
    body: JSON.stringify({
      targetTeam: rule.targetTeam,
      defaultPicId: rule.defaultPicId || null,
      loadBalancingStrategy: rule.loadBalancingStrategy,
      isActive: rule.isActive,
      notes: rule.notes || null,
    }),
  });
  await readApiResponse(response);
  notifyDataChanged();
}

export async function getDatabaseHealth(): Promise<{ ok: boolean; message?: string; database?: string }> {
  const response = await apiFetch('/api/health');
  return response.json().catch(() => ({ ok: false, message: 'Gagal menghubungi API.' }));
}
