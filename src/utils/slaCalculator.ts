import { PriorityLevel, TicketStatus } from '../types';

export interface SlaStatus {
  isOverdue: boolean;
  isNearingBreach: boolean; // < 25% time remaining
  remainingFormatted: string;
  percentElapsed: number;
  totalDurationHours: number;
}

export function calculateDueDates(
  createdAt: string,
  priority: PriorityLevel,
  customResolveHours?: number
): { dueAt: string; responseDueAt: string } {
  const created = new Date(createdAt);
  
  let resolveHours = customResolveHours;
  let responseMinutes = 60;

  if (!resolveHours) {
    switch (priority) {
      case 'Kritis':
        resolveHours = 4;
        responseMinutes = 15;
        break;
      case 'Tinggi':
        resolveHours = 12;
        responseMinutes = 30;
        break;
      case 'Sedang':
        resolveHours = 24;
        responseMinutes = 60;
        break;
      case 'Rendah':
      default:
        resolveHours = 48;
        responseMinutes = 120;
        break;
    }
  }

  const dueDate = new Date(created.getTime() + resolveHours * 60 * 60 * 1000);
  const responseDueDate = new Date(created.getTime() + responseMinutes * 60 * 1000);

  return {
    dueAt: dueDate.toISOString(),
    responseDueAt: responseDueDate.toISOString(),
  };
}

export function getSlaStatus(createdAt: string, dueAt: string, status: TicketStatus, resolvedAt?: string): SlaStatus {
  const start = new Date(createdAt).getTime();
  const end = new Date(dueAt).getTime();
  const now = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  
  const total = end - start;
  const elapsed = now - start;
  const remaining = end - now;

  const isCompleted = status === 'Selesai' || status === 'Ditutup';

  if (isCompleted) {
    const wasOverdue = now > end;
    return {
      isOverdue: wasOverdue,
      isNearingBreach: false,
      remainingFormatted: wasOverdue ? 'Terlambat saat selesai' : 'Selesai tepat waktu',
      percentElapsed: Math.min(100, Math.round((elapsed / total) * 100)),
      totalDurationHours: Math.round(total / (1000 * 60 * 60)),
    };
  }

  if (remaining <= 0) {
    const overdueHours = Math.abs(Math.round(remaining / (1000 * 60 * 60)));
    return {
      isOverdue: true,
      isNearingBreach: true,
      remainingFormatted: `Terlambat ${overdueHours === 0 ? '< 1' : overdueHours} jam`,
      percentElapsed: 100,
      totalDurationHours: Math.round(total / (1000 * 60 * 60)),
    };
  }

  const hoursRemaining = Math.floor(remaining / (1000 * 60 * 60));
  const minutesRemaining = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  const percentElapsed = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  const isNearingBreach = percentElapsed >= 75;

  let remainingFormatted = '';
  if (hoursRemaining > 24) {
    const days = Math.floor(hoursRemaining / 24);
    remainingFormatted = `Sisa ${days} hari ${hoursRemaining % 24} jam`;
  } else if (hoursRemaining > 0) {
    remainingFormatted = `Sisa ${hoursRemaining} jam ${minutesRemaining} m`;
  } else {
    remainingFormatted = `Sisa ${minutesRemaining} menit`;
  }

  return {
    isOverdue: false,
    isNearingBreach,
    remainingFormatted,
    percentElapsed,
    totalDurationHours: Math.round(total / (1000 * 60 * 60)),
  };
}
