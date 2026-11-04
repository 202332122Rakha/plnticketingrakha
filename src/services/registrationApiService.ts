import type { RegistrationRequest, Role, Unit, UnitRegion, UnitType } from '../types';
import { apiFetch } from './http';

interface RegistrationRow {
  id: string;
  user_id: string | null;
  requested_unit_id: string | null;
  requested_unit_name: string | null;
  username: string | null;
  full_name: string;
  employee_number: string;
  email: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  unit_legacy_key: string | null;
  unit_code: string | null;
  unit_name: string | null;
  unit_type: UnitType | null;
  assigned_role: Role | null;
}

async function readApiResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) {
    throw new Error(body.message || `Permintaan gagal (${response.status}).`);
  }
  return body;
}

function toRegistrationRequest(row: RegistrationRow): RegistrationRequest {
  const isManualUnit = !row.requested_unit_id && Boolean(row.requested_unit_name);
  return {
    id: row.id,
    username: row.username || undefined,
    fullName: row.full_name,
    employeeId: row.employee_number,
    corporateEmail: row.email,
    unitId: row.unit_legacy_key || row.requested_unit_id || 'unit-pending-custom',
    unitName: row.unit_name || row.requested_unit_name || '',
    unitCode: row.unit_code || (isManualUnit ? 'UNIT_PENGAJUAN' : ''),
    unitType: row.unit_type || undefined,
    requestedUnitCategory: row.unit_type || undefined,
    requestedUnitId: row.unit_legacy_key || undefined,
    requestedUnitName: row.requested_unit_name || undefined,
    isManualUnit,
    manualUnitVerified: row.status === 'approved' && !isManualUnit,
    position: row.position || '',
    phone: row.phone || undefined,
    passwordHash: '',
    agreedToTerms: true,
    status: row.status === 'pending' ? 'Menunggu Verifikasi' : row.status === 'approved' ? 'Disetujui' : 'Ditolak',
    rejectionReason: row.status === 'rejected' ? row.review_note || undefined : undefined,
    assignedRole: row.assigned_role || undefined,
    submittedAt: row.created_at,
    processedAt: row.reviewed_at || undefined,
    processedByAdminId: row.reviewed_by || undefined,
  };
}

export async function listRegistrationRequests(): Promise<RegistrationRequest[]> {
  const response = await apiFetch('/api/registration_requests', { headers: { Accept: 'application/json' } });
  const body = await readApiResponse(response);
  return (body.requests as RegistrationRow[]).map(toRegistrationRequest);
}

export async function listRegistrationUnits(): Promise<Unit[]> {
  const response = await apiFetch('/api/units', { headers: { Accept: 'application/json' } });
  const body = await readApiResponse(response);
  return (body.units as Array<Record<string, any>>).map((unit) => ({
    unitId: unit.legacy_key || unit.id,
    unitCode: unit.unit_code,
    unitName: unit.unit_name,
    unitRegion: (unit.unit_region || 'Non-UPDL') as UnitRegion,
    unitFocus: unit.unit_focus || '',
    unitType: unit.unit_type as UnitType,
    isActive: Boolean(unit.is_active),
    createdAt: unit.created_at,
    updatedAt: unit.updated_at,
  }));
}

export async function approveRegistration(
  request: RegistrationRequest,
  role: Role,
  selectedUnitKey: string
): Promise<string> {
  const response = await apiFetch(`/api/registration_requests/${encodeURIComponent(request.id)}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ role, unitKey: selectedUnitKey }),
  });
  const body = await readApiResponse(response);
  return body.unitName as string;
}

export async function rejectRegistration(requestId: string, reason: string): Promise<void> {
  const response = await apiFetch(`/api/registration_requests/${encodeURIComponent(requestId)}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ reason }),
  });
  await readApiResponse(response);
}