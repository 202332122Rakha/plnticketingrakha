/**
 * picHelpers.ts
 * Utilitas terpusat untuk standardisasi identifikasi & penamaan PIC (PIC 1, PIC 2, PIC 3)
 * di seluruh aplikasi PLN Corporate University Ticketing System.
 */

import { User } from '../types';

export interface PicInfo {
  tag: 'PIC 1' | 'PIC 2' | 'PIC 3' | 'PIC';
  fullLabel: string;
  defaultTeam: string;
  specialization: string;
}

const PIC_MAP: Record<string, PicInfo> = {
  'user-pic-1': {
    tag: 'PIC 1',
    fullLabel: 'PIC 1 · Budi Santoso',
    defaultTeam: 'Network & Infrastructure',
    specialization: 'Jaringan & Fiber Optic',
  },
  'user-pic-2': {
    tag: 'PIC 2',
    fullLabel: 'PIC 2 · Rina Wijaya',
    defaultTeam: 'IT Support & Hardware',
    specialization: 'Perangkat Keras & Multimedia',
  },
  'user-pic-3': {
    tag: 'PIC 3',
    fullLabel: 'PIC 3 · Dimas Aditya',
    defaultTeam: 'Application Support',
    specialization: 'Aplikasi Internal & LMS',
  },
};

/**
 * Mendapatkan tag PIC ('PIC 1', 'PIC 2', 'PIC 3', atau 'PIC')
 */
export function getPicTag(uidOrEmployeeId?: string | null): string | null {
  if (!uidOrEmployeeId) return null;
  const id = uidOrEmployeeId.trim();
  if (id === 'user-pic-1' || id.includes('PIC1') || id.includes('NET')) return 'PIC 1';
  if (id === 'user-pic-2' || id.includes('PIC2') || id.includes('HDW')) return 'PIC 2';
  if (id === 'user-pic-3' || id.includes('PIC3') || id.includes('APP')) return 'PIC 3';
  return null;
}

/**
 * Format nama PIC yang sinkron dan terstandardisasi:
 * Jika PIC 1/2/3: "PIC 1 · Budi Santoso"
 * Jika PIC umum: "PIC · [Nama]"
 * Jika belum ada: "Belum Ditugaskan"
 */
export function formatPicDisplayName(
  picId?: string | null,
  fallbackName?: string | null
): string {
  if (!picId && !fallbackName) return 'Belum Ditugaskan';

  const tag = getPicTag(picId);
  const name = fallbackName || (picId && PIC_MAP[picId]?.fullLabel) || 'Petugas PIC';

  // Jika nama sudah ada prefix PIC 1 / PIC 2 / PIC 3, kembalikan langsung
  if (/^PIC\s*[1-3]/i.test(name)) {
    return name;
  }

  if (tag) {
    return `${tag} · ${name}`;
  }

  return name;
}

/**
 * Urutkan daftar user PIC secara deterministik (PIC 1, PIC 2, PIC 3, dst.)
 */
export function sortPicUsers(users: User[]): User[] {
  const orderMap: Record<string, number> = {
    'user-pic-1': 1,
    'user-pic-2': 2,
    'user-pic-3': 3,
  };

  return [...users].sort((a, b) => {
    const oA = orderMap[a.uid] || 99;
    const oB = orderMap[b.uid] || 99;
    if (oA !== oB) return oA - oB;
    return (a.name || '').localeCompare(b.name || '');
  });
}
