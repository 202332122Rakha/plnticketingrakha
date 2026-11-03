import React from 'react';
import { Unit, UnitType, Ticket, User } from '../types';
import { UPDL_UNITS, CORPU_UNIT, NON_UPDL_UNITS, ALL_REGISTERED_UNITS } from '../data/unitsData';

/**
 * UTILS & HELPERS UNTUK PEMISAHAN TIKET UPDL, PLN CORPU, DAN UNIT UMUM/NON-UPDL
 */

let dynamicUnitsList: Unit[] = ALL_REGISTERED_UNITS;

export function registerDynamicUnits(units: Unit[]): void {
  if (Array.isArray(units)) {
    dynamicUnitsList = units;
  }
}

export function getDynamicUnits(): Unit[] {
  return dynamicUnitsList;
}

/**
 * Mencari unit berdasarkan unitId atau unitCode
 */
export function getUnitByIdOrCode(identifier?: string): Unit | undefined {
  if (!identifier) return undefined;
  const clean = identifier.trim().toLowerCase();
  
  // 1. Exact match by unitId, unitCode, or unitName against dynamic & official units
  const pool = dynamicUnitsList.length > 0 ? dynamicUnitsList : ALL_REGISTERED_UNITS;
  const exact = pool.find(
    (u) =>
      u.unitId.toLowerCase() === clean ||
      u.unitCode.toLowerCase() === clean ||
      u.unitName.toLowerCase() === clean
  );
  if (exact) return exact;

  // 2. Specific city/location match for 11 UPDL units
  if (clean.includes('padang') || clean.includes('pdg')) return ALL_REGISTERED_UNITS.find(u => u.unitId === 'unit-updl-pdg');
  if (clean.includes('bogor') || clean.includes('bgr')) return ALL_REGISTERED_UNITS.find(u => u.unitId === 'unit-updl-bgr');
  if (clean.includes('suralaya') || clean.includes('srl')) return ALL_REGISTERED_UNITS.find(u => u.unitId === 'unit-updl-srl');
  if (clean.includes('semarang') || clean.includes('smg')) return ALL_REGISTERED_UNITS.find(u => u.unitId === 'unit-updl-smg');
  if (clean.includes('pandaan') || clean.includes('pdn')) return ALL_REGISTERED_UNITS.find(u => u.unitId === 'unit-updl-pdn');
  if (clean.includes('surabaya') || clean.includes('sby')) return ALL_REGISTERED_UNITS.find(u => u.unitId === 'unit-updl-sby');
  if (clean.includes('tuntungan') || clean.includes('ttg')) return ALL_REGISTERED_UNITS.find(u => u.unitId === 'unit-updl-ttg');
  if (clean.includes('palembang') || clean.includes('plb')) return ALL_REGISTERED_UNITS.find(u => u.unitId === 'unit-updl-plb');
  if (clean.includes('banjarbaru') || clean.includes('bjb')) return ALL_REGISTERED_UNITS.find(u => u.unitId === 'unit-updl-bjb');
  if (clean.includes('makassar') || clean.includes('mks')) return ALL_REGISTERED_UNITS.find(u => u.unitId === 'unit-updl-mks');
  if ((clean.includes('jakarta') && clean.includes('updl')) || clean.includes('jkt')) return ALL_REGISTERED_UNITS.find(u => u.unitId === 'unit-updl-jkt');

  // 3. Corpu match
  if (clean.includes('corpu') || clean.includes('corporate university')) {
    return ALL_REGISTERED_UNITS.find(u => u.unitId === 'unit-pln-corpu');
  }

  // 4. Non-UPDL matches
  if (clean.includes('pusat') || clean.includes('kantor pusat')) return ALL_REGISTERED_UNITS.find(u => u.unitId === 'unit-non-pusat');
  if (clean.includes('uid') || (clean.includes('jakarta') && !clean.includes('updl'))) return ALL_REGISTERED_UNITS.find(u => u.unitId === 'unit-non-uid-jkt');
  if (clean.includes('puslitbang') || clean.includes('litbang')) return ALL_REGISTERED_UNITS.find(u => u.unitId === 'unit-non-puslitbang');
  if (clean.includes('pusharlis') || clean.includes('harlis')) return ALL_REGISTERED_UNITS.find(u => u.unitId === 'unit-non-pusharlis');

  // 5. Partial fallback match
  return ALL_REGISTERED_UNITS.find(
    (u) =>
      u.unitName.toLowerCase().includes(clean) ||
      clean.includes(u.unitName.toLowerCase()) ||
      clean.includes(u.unitCode.toLowerCase())
  );
}

/**
 * Memeriksa apakah unit adalah salah satu dari 11 UPDL
 */
export function isUpdlUnit(unitIdOrCode?: string): boolean {
  if (!unitIdOrCode) return false;
  const unit = getUnitByIdOrCode(unitIdOrCode);
  if (unit) return unit.unitType === 'UPDL';

  const clean = unitIdOrCode.toLowerCase();
  return clean.includes('updl') && !clean.includes('corpu');
}

/**
 * Memeriksa apakah unit adalah PLN Corporate University (PLN Corpu - Bukan UPDL)
 */
export function isCorpuUnit(unitIdOrCode?: string): boolean {
  if (!unitIdOrCode) return false;
  const unit = getUnitByIdOrCode(unitIdOrCode);
  if (unit) return unit.unitType === 'CORPU';

  const clean = unitIdOrCode.toLowerCase();
  return clean.includes('corpu') || clean.includes('corporate university');
}

/**
 * Memeriksa apakah unit adalah Unit Umum / Non-UPDL
 */
export function isNonUpdlUnit(unitIdOrCode?: string): boolean {
  if (!unitIdOrCode) return false;
  const unit = getUnitByIdOrCode(unitIdOrCode);
  if (unit) return unit.unitType === 'NON_UPDL';

  return !isUpdlUnit(unitIdOrCode) && !isCorpuUnit(unitIdOrCode);
}

/**
 * Menentukan unitType secara deterministik dari data unit yang terverifikasi
 */
export function determineUnitType(unitIdOrCode?: string): UnitType | 'UNCLASSIFIED' {
  if (!unitIdOrCode) return 'UNCLASSIFIED';
  const unit = getUnitByIdOrCode(unitIdOrCode);
  if (unit) return unit.unitType;
  if (isUpdlUnit(unitIdOrCode)) return 'UPDL';
  if (isCorpuUnit(unitIdOrCode)) return 'CORPU';
  if (isNonUpdlUnit(unitIdOrCode)) return 'NON_UPDL';
  return 'UNCLASSIFIED';
}

/**
 * Konfigurasi badge Asal Unit: label, warna latar belakang, warna teks, dan border
 */
export interface UnitOriginBadgeConfig {
  label: string;
  shortLabel: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  description: string;
}

export function getUnitOriginBadgeConfig(unitType?: UnitType | 'UNCLASSIFIED'): UnitOriginBadgeConfig {
  switch (unitType) {
    case 'UPDL':
      return {
        label: 'UPDL',
        shortLabel: 'UPDL',
        bgClass: 'bg-[#E7EFF1]',
        textClass: 'text-[#35666D]',
        borderClass: 'border-[#D5E0E3]',
        description: 'Unit Pelaksana Pendidikan & Latihan (11 UPDL)',
      };
    case 'CORPU':
      return {
        label: 'PLN Corpu',
        shortLabel: 'Corpu',
        bgClass: 'bg-[#F5FAFA]',
        textClass: 'text-[#417F85]',
        borderClass: 'border-[#D5E0E3]',
        description: 'Unit Korporat PLN Corporate University (Bukan UPDL)',
      };
    case 'NON_UPDL':
      return {
        label: 'Non-UPDL',
        shortLabel: 'Non-UPDL',
        bgClass: 'bg-slate-100',
        textClass: 'text-[#69777D]',
        borderClass: 'border-[#D5E0E3]',
        description: 'Unit Umum / Non-UPDL Terdaftar',
      };
    case 'UNCLASSIFIED':
    default:
      return {
        label: 'Belum Terklasifikasi',
        shortLabel: 'Unclassified',
        bgClass: 'bg-slate-100',
        textClass: 'text-[#69777D]',
        borderClass: 'border-slate-300',
        description: 'Asal unit tidak dapat diverifikasi dari akun pelapor',
      };
  }
}

/**
 * Komponen Visual Badge Asal Unit
 */
export const OriginUnitBadge: React.FC<{
  unitType?: UnitType | 'UNCLASSIFIED';
  size?: 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}> = ({ unitType, size = 'sm', showDot = true, className = '' }) => {
  const config = getUnitOriginBadgeConfig(unitType);

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  const dotColor =
    unitType === 'UPDL'
      ? 'bg-[#417F85]'
      : unitType === 'CORPU'
      ? 'bg-[#35666D]'
      : unitType === 'NON_UPDL'
      ? 'bg-[#69777D]'
      : 'bg-[#B3BDC9]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-md border font-sans tracking-tight shrink-0 shadow-2xs ${config.bgClass} ${config.textClass} ${config.borderClass} ${sizeClasses} ${className}`}
      title={`${config.label} — ${config.description}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />}
      <span>{config.label}</span>
    </span>
  );
};

/**
 * Memigrasikan atau mengaudit tiket lama secara aman tanpa mengubah riwayat,
 * nomor tiket, penugasan, tanggal, prioritas, atau isi tiket.
 */
export function auditAndMigrateTicketUnit(
  ticket: Ticket,
  users: User[]
): { updated: boolean; ticket: Ticket; auditNote?: string } {
  // Jika sudah memiliki reporterUnitType yang valid, tidak perlu dimigrasikan
  if (ticket.reporterUnitType) {
    return { updated: false, ticket };
  }

  // Cari akun pelapor berdasarkan reporterId yang terdaftar
  const reporter = users.find((u) => u.uid === ticket.reporterId);

  // Jika akun pelapor ditemukan dan memiliki data unit terverifikasi
  if (reporter && reporter.unitId) {
    const verifiedUnit = getUnitByIdOrCode(reporter.unitId);
    const unitType: UnitType =
      reporter.unitType ||
      (verifiedUnit ? verifiedUnit.unitType : isUpdlUnit(reporter.unitId) ? 'UPDL' : 'NON_UPDL');

    const migrated: Ticket = {
      ...ticket,
      reporterUnitId: reporter.unitId,
      reporterUnitName: reporter.unitName || verifiedUnit?.unitName || ticket.reporterUnitName || 'Unit Terverifikasi',
      reporterUnitCode: reporter.unitCode || verifiedUnit?.unitCode || ticket.reporterUnitCode,
      reporterUnitType: unitType,
    };

    return {
      updated: true,
      ticket: migrated,
      auditNote: `Asal unit dimigrasikan dari akun pelapor ${reporter.name}: ${migrated.reporterUnitName} (${unitType})`,
    };
  }

  // Jika tiket memiliki snapshot reporterUnitId yang cocok dengan master unit
  if (ticket.reporterUnitId) {
    const verifiedUnit = getUnitByIdOrCode(ticket.reporterUnitId);
    if (verifiedUnit) {
      const migrated: Ticket = {
        ...ticket,
        reporterUnitName: verifiedUnit.unitName,
        reporterUnitCode: verifiedUnit.unitCode,
        reporterUnitType: verifiedUnit.unitType,
      };

      return {
        updated: true,
        ticket: migrated,
        auditNote: `Asal unit dimigrasikan dari snapshot unit id ${ticket.reporterUnitId}: ${verifiedUnit.unitName} (${verifiedUnit.unitType})`,
      };
    }
  }

  // Jika akun pelapor tidak dapat diverifikasi, tandai sebagai UNCLASSIFIED (Jangan menebak!)
  const unclassifiedTicket: Ticket = {
    ...ticket,
    reporterUnitType: 'UNCLASSIFIED',
    reporterUnitName: ticket.reporterUnitName || 'Belum Terklasifikasi',
  };

  return {
    updated: true,
    ticket: unclassifiedTicket,
    auditNote: `Asal unit ditandai UNCLASSIFIED karena akun pelapor tidak dapat diverifikasi dari master data unit.`,
  };
}
