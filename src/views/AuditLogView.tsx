import React, { useState } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  Clock,
  User,
  ArrowRight,
  Download,
} from 'lucide-react';
import { ActivityLog } from '../types';
import { storageService } from '../services/storageService';
import { formatTicketNumberDisplay } from '../utils/ticketHelpers';

interface AuditLogViewProps {
  onNavigate: (view: string, ticketId?: string) => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ onNavigate }) => {
  const [logs, setLogs] = useState<ActivityLog[]>(() => storageService.getActivityLogs());
  React.useEffect(() => storageService.subscribe(() => setLogs(storageService.getActivityLogs())), []);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const mNum = log.ticketNumber.toLowerCase().includes(q);
      const mActor = log.actorName.toLowerCase().includes(q);
      const mDetails = log.details?.toLowerCase().includes(q) || false;
      const mAction = log.action.toLowerCase().includes(q);
      if (!mNum && !mActor && !mDetails && !mAction) return false;
    }
    return true;
  });

  const actions = Array.from(new Set(logs.map((l) => l.action)));

  const handleExportAuditCSV = () => {
    const headers = ['Timestamp', 'Nomor Tiket', 'Aktor', 'Peran', 'Aksi', 'Keterangan'];
    const rows = filteredLogs.map((l) => [
      new Date(l.createdAt).toLocaleString('id-ID'),
      l.ticketNumber,
      l.actorName,
      l.actorRole,
      l.action,
      `"${(l.details || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `Audit_Trail_PLN_CorpU_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            Audit Trail & Log Kepatuhan
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Rekam jejak seluruh aktivitas sistem, perubahan status tiket, penugasan PIC, dan penyesuaian SLA.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-medium"
          >
            <option value="ALL">Semua Jenis Aksi</option>
            {actions.map((act) => (
              <option key={act} value={act}>
                {act.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari log atau aktor..."
              className="text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
          </div>

          <button
            onClick={handleExportAuditCSV}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Waktu Kejadian</th>
                <th className="py-3 px-4">Nomor Tiket</th>
                <th className="py-3 px-4">Aktor Pengubah</th>
                <th className="py-3 px-4">Aksi / Aktivitas</th>
                <th className="py-3 px-4">Detail Perubahan</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4 font-mono-numbers text-slate-500 whitespace-nowrap text-[11px]">
                    {new Date(log.createdAt).toLocaleString('id-ID')}
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="font-mono font-bold text-xs text-[#1765B3] bg-[#EFF8FF] border border-[#B8DEFF] px-2 py-0.5 rounded-md">
                      {formatTicketNumberDisplay(log.ticketNumber)}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-900 block">{log.actorName}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      ({log.actorRole})
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>

                  <td className="py-3 px-4 max-w-md text-slate-600 leading-relaxed">
                    {log.details}
                  </td>

                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    {log.ticketId ? (
                      <button
                        onClick={() => onNavigate('ticket-detail', log.ticketId)}
                        className="px-2.5 py-1 text-xs font-semibold text-[#417F85] hover:text-[#326A70] hover:bg-[#E7EFF1] rounded-md transition-colors cursor-pointer"
                      >
                        Buka Tiket →
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
