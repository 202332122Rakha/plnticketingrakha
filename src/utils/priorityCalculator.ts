import { ImpactLevel, UrgencyLevel, PriorityLevel } from '../types';

export function calculatePriority(impact: ImpactLevel, urgency: UrgencyLevel): PriorityLevel {
  if (impact === 'Banyak Pengguna') {
    if (urgency === 'Tinggi') return 'Kritis';
    if (urgency === 'Sedang') return 'Tinggi';
    return 'Sedang';
  }

  if (impact === 'Departemen') {
    if (urgency === 'Tinggi') return 'Kritis';
    if (urgency === 'Sedang') return 'Tinggi';
    return 'Sedang';
  }

  if (impact === 'Tim') {
    if (urgency === 'Tinggi') return 'Tinggi';
    if (urgency === 'Sedang') return 'Sedang';
    return 'Rendah';
  }

  // Individu
  if (urgency === 'Tinggi') return 'Sedang';
  if (urgency === 'Sedang') return 'Rendah';
  return 'Rendah';
}

export function getPriorityColor(priority: PriorityLevel): {
  bg: string;
  text: string;
  border: string;
  badgeBg: string;
  indicator: string;
} {
  switch (priority) {
    case 'Kritis':
      return {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        badgeBg: 'bg-rose-100',
        indicator: 'bg-rose-600',
      };
    case 'Tinggi':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        badgeBg: 'bg-amber-100',
        indicator: 'bg-amber-500',
      };
    case 'Sedang':
      return {
        bg: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-200',
        badgeBg: 'bg-yellow-100',
        indicator: 'bg-yellow-500',
      };
    case 'Rendah':
    default:
      return {
        bg: 'bg-slate-50',
        text: 'text-slate-600',
        border: 'border-slate-200',
        badgeBg: 'bg-slate-100',
        indicator: 'bg-slate-400',
      };
  }
}
