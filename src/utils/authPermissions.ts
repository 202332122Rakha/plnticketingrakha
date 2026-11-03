import { User, Ticket, UnitType, Unit, Role } from '../types';
import { UPDL_UNITS, CORPU_UNIT, NON_UPDL_UNITS, ALL_REGISTERED_UNITS } from '../data/unitsData';
import { isUpdlUnit, isCorpuUnit, isNonUpdlUnit, getUnitByIdOrCode } from './unitHelpers';

/**
 * PLN Corporate University - Centralized Authorization & Unit Access Control
 * 
 * Sesuai Aturan Bagian 4, 7, 8, 9, 10, 11, 12 Master Prompt:
 * 1. Setiap akun wajib memiliki satu unit kerja utama yang konsisten.
 * 2. Menu unit lain disembunyikan dan diisolasi sepenuhnya di level data & routing.
 * 3. Pelapor hanya dapat melihat tiket miliknya sendiri (reporterId === user.uid).
 * 4. PIC hanya dapat mengakses tiket yang ditugaskan dalam cakupan unitnya.
 * 5. Admin & Manajemen memiliki akses lintas unit sesuai kewenangan eksekutif/sistem.
 */

/**
 * Menentukan tipe unit kerja akun pengguna secara deterministik
 */
export function getUserUnitType(user: User): UnitType {
  // 1. Resolve through primary master unit if available
  const primary = getUserPrimaryUnit(user);
  if (primary) {
    return primary.unitType;
  }

  // 2. Direct unitType field if strictly valid
  if (user.unitType === 'UPDL' || user.unitType === 'CORPU' || user.unitType === 'NON_UPDL') {
    return user.unitType;
  }

  // 3. Inspection of unitId, unitName, unitCode, or department text
  const cleanId = (user.unitId || '').toLowerCase();
  const cleanName = (user.unitName || '').toLowerCase();
  const cleanCode = (user.unitCode || '').toLowerCase();
  const cleanDept = (user.department || '').toLowerCase();

  if (isUpdlUnit(cleanId) || isUpdlUnit(cleanName) || isUpdlUnit(cleanCode) || isUpdlUnit(cleanDept)) {
    return 'UPDL';
  }

  if (isCorpuUnit(cleanId) || isCorpuUnit(cleanName) || isCorpuUnit(cleanCode) || isCorpuUnit(cleanDept)) {
    return 'CORPU';
  }

  if (cleanId || cleanName || cleanCode) {
    return 'NON_UPDL';
  }

  // Admin/Manajemen fallback to CORPU if completely unassigned
  if (user.role === 'admin' || user.role === 'manajemen') {
    return 'CORPU';
  }

  return 'UPDL';
}

/**
 * Mengambil objek master unit resmi untuk pengguna
 */
export function getUserPrimaryUnit(user: User): Unit | undefined {
  if (user.unitId) {
    const byId = getUnitByIdOrCode(user.unitId);
    if (byId) return byId;
  }
  if (user.unitCode) {
    const byCode = getUnitByIdOrCode(user.unitCode);
    if (byCode) return byCode;
  }
  if (user.unitName) {
    const byName = getUnitByIdOrCode(user.unitName);
    if (byName) return byName;
  }
  if (user.department) {
    const byDept = getUnitByIdOrCode(user.department);
    if (byDept) return byDept;
  }
  return undefined;
}

/**
 * Memeriksa apakah pengguna memiliki hak akses ke kelompok unit (UnitType)
 * - Admin & Manajemen: Berhak mengakses semua kelompok ('UPDL', 'CORPU', 'NON_UPDL')
 * - Akun UPDL (misal UPDL Padang, UPDL Jakarta): HANYA berhak mengakses 'UPDL'
 * - Akun Corpu: HANYA berhak mengakses 'CORPU'
 * - Akun Non-UPDL (misal PLN Kantor Pusat, UID Jakarta): HANYA berhak mengakses 'NON_UPDL'
 */
export function canAccessUnitType(user: User, unitType: UnitType): boolean {
  if (user.role === 'admin' || user.role === 'manajemen') {
    return true;
  }

  const userType = getUserUnitType(user);
  return userType === unitType;
}

/**
 * Memeriksa apakah pengguna berhak mengakses satu unit kerja spesifik
 * - Admin & Manajemen: Berhak mengakses unit mana pun serta 'ALL'
 * - Pengguna Biasa (Pelapor/PIC):
 *   - 'ALL' TIDAK DIPERBOLEHKAN (hanya admin yang dapat melihat semua unit)
 *   - Hanya berhak mengakses unit yang cocok dengan unitId / unitCode akun sendiri
 */
export function canAccessUnit(user: User, unitId?: string | null): boolean {
  if (!unitId) return false;

  const cleanTarget = unitId.trim().toLowerCase();

  // Admin & Manajemen have global unit access
  if (user.role === 'admin' || user.role === 'manajemen') {
    return true;
  }

  // Non-admin can NEVER access 'ALL' across units
  if (cleanTarget === 'all') {
    return false;
  }

  const userUnit = getUserPrimaryUnit(user);
  const userUnitId = (user.unitId || '').toLowerCase();
  const userUnitCode = (user.unitCode || userUnit?.unitCode || '').toLowerCase();

  const targetUnit = getUnitByIdOrCode(cleanTarget);
  const targetUnitId = (targetUnit?.unitId || cleanTarget).toLowerCase();
  const targetUnitCode = (targetUnit?.unitCode || '').toLowerCase();

  return (
    userUnitId === targetUnitId ||
    (userUnitCode !== '' && userUnitCode === targetUnitCode) ||
    Boolean(userUnit && userUnit.unitId.toLowerCase() === targetUnitId)
  );
}

/**
 * Memeriksa apakah pengguna memiliki otorisasi mengakses suatu menu / halaman aplikasi
 */
export function canAccessView(user: User, viewName: string): boolean {
  const clean = viewName.trim().toLowerCase();

  // 1. Dashboard, profil, notifikasi, buat tiket terbuka untuk semua pengguna aktif
  if (
    clean === 'dashboard' ||
    clean === 'profile' ||
    clean === 'notifications' ||
    clean === 'create-ticket'
  ) {
    return true;
  }

  // 2. Tiket Saya (khusus pelapor atau admin)
  if (clean === 'my-tickets') {
    return user.role === 'pelapor' || user.role === 'admin';
  }

  // 3. Penugasan Saya (khusus PIC atau admin)
  if (clean === 'my-assignments') {
    return user.role === 'pic' || user.role === 'admin';
  }

  // 4. Semua Tiket (dengan pemfilteran data sesuai role)
  if (clean === 'all-tickets' || clean === 'tickets') {
    return true;
  }

  // 5. Tiket Unit UPDL
  if (
    clean === 'unit-tickets' ||
    clean === 'updl-tickets' ||
    clean === 'units-overview'
  ) {
    return canAccessUnitType(user, 'UPDL');
  }

  // 6. Tiket Unit PLN Corpu
  if (clean === 'corpu-tickets') {
    return canAccessUnitType(user, 'CORPU');
  }

  // 7. Tiket Unit PLN Umum (Non-UPDL)
  if (clean === 'umum-tickets' || clean === 'non-updl' || clean === 'non-updl-tickets') {
    return canAccessUnitType(user, 'NON_UPDL');
  }

  // 8. Halaman Detail Tiket (validasi dilakukan per tiket di level data)
  if (clean === 'ticket-detail' || clean === 'ticket') {
    return true;
  }

  // 9. Administrasi Helpdesk & Sistem (Admin Only)
  if (
    clean === 'registration-requests' ||
    clean === 'pic-management' ||
    clean === 'auto-assignment' ||
    clean === 'user-management' ||
    clean === 'category-management' ||
    clean === 'sla-management' ||
    clean === 'master-units' ||
    clean === 'units-master' ||
    clean === 'settings'
  ) {
    return user.role === 'admin';
  }

  // 10. Laporan Eksekutif & Audit Trail (Admin & Manajemen)
  if (clean === 'audit-log') return user.role === 'admin';
  if (clean === 'reports') {
    return user.role === 'admin' || user.role === 'manajemen';
  }

  return false;
}

/**
 * Validasi otorisasi melihat suatu tiket (Section 7, 8 & 9)
 * - Admin & Manajemen: Berhak melihat seluruh tiket
 * - Pelapor: HANYA berhak melihat tiket yang dibuat oleh akunnya sendiri (reporterId === user.uid)
 * - PIC: HANYA berhak melihat tiket yang ditugaskan kepada dirinya (currentPicId === user.uid)
 */
export function canViewTicket(user: User, ticket: Ticket): boolean {
  if (user.role === 'admin' || user.role === 'manajemen') {
    return true;
  }

  if (user.role === 'pelapor') {
    return ticket.reporterId === user.uid;
  }

  if (user.role === 'pic') {
    const ticketUnitId = ticket.handlingUnitId || ticket.reporterUnitId;
    return ticket.currentPicId === user.uid && canAccessUnit(user, ticketUnitId);
  }

  return false;
}

/**
 * Validasi otorisasi mengubah tiket (Status, PIC, Solusi)
 * - Admin: Berhak mengubah tiket apa pun
 * - PIC: Berhak memperbarui progres & solusi pada tiket yang ditugaskan padanya
 * - Pelapor: TIDAK berhak mengubah status tiket atau menetapkan PIC
 */
export function canUpdateTicket(user: User, ticket: Ticket): boolean {
  if (user.role === 'admin') {
    return true;
  }

  if (user.role === 'pic') {
    return ticket.currentPicId === user.uid;
  }

  return false;
}

/**
 * Memfilter dataset tiket secara ketat sesuai kewenangan akun pengguna (Section 7 & 8)
 * Menjamin tidak ada data lintas pengguna / lintas unit yang bocor
 */
export function getScopedTickets(user: User, allTickets: Ticket[]): Ticket[] {
  if (user.role === 'admin' || user.role === 'manajemen') {
    return allTickets;
  }

  return allTickets.filter((ticket) => canViewTicket(user, ticket));
}

/**
 * Mengambil daftar unit UPDL yang berhak dilihat oleh pengguna di menu dropdown
 * - Admin & Manajemen: Semua 11 UPDL
 * - Pengguna UPDL biasa: HANYA unit UPDL tempatnya bertugas
 * - Pengguna Corpu / Non-UPDL: Kosong (tidak berhak mengakses menu UPDL)
 */
export function getAuthorizedUpdlUnits(user: User): Unit[] {
  if (user.role === 'admin' || user.role === 'manajemen') {
    return UPDL_UNITS;
  }

  if (getUserUnitType(user) === 'UPDL') {
    const userUnit = getUserPrimaryUnit(user);
    if (userUnit) {
      return [userUnit];
    }
    const matched = UPDL_UNITS.find(
      (u) => u.unitId === user.unitId || u.unitCode === user.unitCode
    );
    return matched ? [matched] : [];
  }

  return [];
}

/**
 * Mengambil daftar unit Non-UPDL yang berhak dilihat oleh pengguna di menu dropdown
 * - Admin & Manajemen: Semua unit umum
 * - Pengguna Non-UPDL biasa: HANYA unitnya sendiri
 * - Pengguna UPDL / Corpu: Kosong
 */
export function getAuthorizedNonUpdlUnits(user: User): Unit[] {
  if (user.role === 'admin' || user.role === 'manajemen') {
    return NON_UPDL_UNITS;
  }

  if (getUserUnitType(user) === 'NON_UPDL') {
    const userUnit = getUserPrimaryUnit(user);
    if (userUnit) {
      return [userUnit];
    }
    const matched = NON_UPDL_UNITS.find(
      (u) => u.unitId === user.unitId || u.unitCode === user.unitCode
    );
    return matched ? [matched] : [];
  }

  return [];
}

/**
 * Mendapatkan unit default saat pengguna membuka menu unit
 */
export function getDefaultUnitForUser(user: User): string {
  if (user.role === 'admin' || user.role === 'manajemen') {
    return 'ALL';
  }
  return user.unitId || 'ALL';
}
