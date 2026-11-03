import React from 'react';
import { TicketStatus } from '../../types';

interface StatusBadgeProps {
  status: TicketStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  let dotColor = 'bg-slate-400';
  let textColor = 'text-slate-700';
  let bgColor = 'bg-slate-100';
  let borderColor = 'border-slate-200';

  switch (status) {
    case 'Baru':
      dotColor = 'bg-[#417F85]';
      textColor = 'text-[#35666D]';
      bgColor = 'bg-[#E7EFF1]';
      borderColor = 'border-[#D5E0E3]';
      break;
    case 'Diverifikasi':
      dotColor = 'bg-indigo-600';
      textColor = 'text-indigo-700';
      bgColor = 'bg-indigo-50';
      borderColor = 'border-indigo-200';
      break;
    case 'Ditugaskan':
      dotColor = 'bg-purple-600';
      textColor = 'text-purple-700';
      bgColor = 'bg-purple-50';
      borderColor = 'border-purple-200';
      break;
    case 'Dalam Proses':
      dotColor = 'bg-sky-500';
      textColor = 'text-sky-700';
      bgColor = 'bg-sky-50';
      borderColor = 'border-sky-200';
      break;
    case 'Menunggu Pelapor':
      dotColor = 'bg-amber-500';
      textColor = 'text-amber-700';
      bgColor = 'bg-amber-50';
      borderColor = 'border-amber-200';
      break;
    case 'Menunggu Pihak Ketiga':
      dotColor = 'bg-orange-500';
      textColor = 'text-orange-700';
      bgColor = 'bg-orange-50';
      borderColor = 'border-orange-200';
      break;
    case 'Menunggu Persetujuan':
      dotColor = 'bg-violet-600';
      textColor = 'text-violet-700';
      bgColor = 'bg-violet-50';
      borderColor = 'border-violet-200';
      break;
    case 'Selesai':
      dotColor = 'bg-emerald-600';
      textColor = 'text-emerald-700';
      bgColor = 'bg-emerald-50';
      borderColor = 'border-emerald-200';
      break;
    case 'Ditutup':
      dotColor = 'bg-slate-400';
      textColor = 'text-slate-700';
      bgColor = 'bg-slate-100';
      borderColor = 'border-slate-300';
      break;
    case 'Ditolak':
      dotColor = 'bg-rose-600';
      textColor = 'text-rose-700';
      bgColor = 'bg-rose-50';
      borderColor = 'border-rose-200';
      break;
  }

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border ${bgColor} ${textColor} ${borderColor} ${sizeClasses} whitespace-nowrap`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
      <span>{status}</span>
    </span>
  );
};
