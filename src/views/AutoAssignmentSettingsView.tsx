import React, { useState } from 'react';
import {
  Sparkles,
  Layers,
  Wrench,
  Users,
  CheckCircle2,
  AlertCircle,
  Edit,
  Save,
  RotateCcw,
  Shield,
  Clock,
  ArrowRight,
  TrendingDown,
} from 'lucide-react';
import { AutoAssignmentRule, User, Ticket } from '../types';
import { storageService } from '../services/storageService';
import { sortPicUsers, formatPicDisplayName } from '../utils/picHelpers';

interface AutoAssignmentSettingsViewProps {
  currentUser: User;
}

export const AutoAssignmentSettingsView: React.FC<AutoAssignmentSettingsViewProps> = ({ currentUser }) => {
  const [rules, setRules] = useState<AutoAssignmentRule[]>(() => storageService.getAssignmentRules());
  const [tickets, setTickets] = useState<Ticket[]>(() => storageService.getTickets());
  const [users, setUsers] = useState<User[]>(() => storageService.getUsers());
  const [selectedRule, setSelectedRule] = useState<AutoAssignmentRule | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Form states for modal
  const [editTargetTeam, setEditTargetTeam] = useState('');
  const [editDefaultPicId, setEditDefaultPicId] = useState('');
  const [editStrategy, setEditStrategy] = useState<'least_active_workload' | 'round_robin' | 'direct_pic'>('least_active_workload');
  const [editIsActive, setEditIsActive] = useState(true);

  const activePics = sortPicUsers(users.filter((u) => u.role === 'pic' && u.isActive));
  const activeTickets = tickets.filter((t) => !['Selesai', 'Ditutup', 'Ditolak'].includes(t.status));

  const refreshData = () => {
    setRules(storageService.getAssignmentRules());
    setTickets(storageService.getTickets());
    setUsers(storageService.getUsers());
  };

  React.useEffect(() => storageService.subscribe(refreshData), []);

  const handleOpenEdit = (rule: AutoAssignmentRule) => {
    setSelectedRule(rule);
    setEditTargetTeam(rule.targetTeam);
    setEditDefaultPicId(rule.defaultPicId || '');
    setEditStrategy(rule.loadBalancingStrategy);
    setEditIsActive(rule.isActive);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRule) return;

    const pic = activePics.find((p) => p.uid === editDefaultPicId);

    const updatedRule: AutoAssignmentRule = {
      ...selectedRule,
      targetTeam: editTargetTeam,
      defaultPicId: editDefaultPicId || undefined,
      defaultPicName: pic ? pic.name : undefined,
      loadBalancingStrategy: editStrategy,
      isActive: editIsActive,
    };

    try { await storageService.saveAssignmentRule(updatedRule); } catch (error) { window.alert(error instanceof Error ? error.message : 'Gagal menyimpan ke server.'); return; }
    refreshData();
    setShowEditModal(false);
    setSelectedRule(null);
    setNotificationMsg(`Aturan untuk kategori "${updatedRule.categoryName}" berhasil diperbarui.`);
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleToggleRuleStatus = async (rule: AutoAssignmentRule) => {
    const updated: AutoAssignmentRule = {
      ...rule,
      isActive: !rule.isActive,
    };
    try { await storageService.saveAssignmentRule(updated); } catch (error) { window.alert(error instanceof Error ? error.message : 'Gagal menyimpan ke server.'); return; }
    refreshData();
    setNotificationMsg(`Status aturan "${rule.categoryName}" diubah menjadi ${updated.isActive ? 'Aktif' : 'Nonaktif'}.`);
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  const handleResetDefaults = async () => {
    try { await storageService.refresh(); refreshData(); setNotificationMsg('Aturan dimuat ulang dari PostgreSQL. Tidak ada data yang direset.'); }
    catch(error) { window.alert(error instanceof Error ? error.message : 'Gagal memuat aturan.'); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Pengaturan Auto-Assignment & Pemetaan Tim
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Engine v2.0
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Konfigurasi pemetaan otomatis kategori tiket ke petugas PIC dan tim spesialis. Sistem secara otomatis menyeimbangkan beban penanganan berdasarkan tiket aktif terendah.
          </p>
        </div>

        <button
          onClick={handleResetDefaults}
          className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
        >
          <RotateCcw className="w-4 h-4 text-slate-400" />
          <span>Muat Ulang</span>
        </button>
      </div>

      {/* Notification Banner */}
      {notificationMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in-50">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{notificationMsg}</span>
        </div>
      )}

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Aturan Aktif</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono-numbers">
            {rules.filter((r) => r.isActive).length} <span className="text-xs font-normal text-slate-400">/ {rules.length} Kategori</span>
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 font-medium">
            ✓ 100% Kategori Terpetakan
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>PIC Aktif Siaga</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono-numbers">
            {activePics.length} <span className="text-xs font-normal text-slate-400">Petugas</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">
            Network, Hardware, Apps
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Beban Tiket Aktif</span>
            <Clock className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono-numbers">
            {activeTickets.length} <span className="text-xs font-normal text-slate-400">Tiket Berjalan</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Dalam Proses & Ditugaskan
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Metode Penugasan</span>
            <TrendingDown className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-sm font-bold text-slate-900 mt-2">
            Least Workload
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Penyeimbang Beban Otomatis
          </div>
        </div>
      </div>

      {/* Live PIC Workload Monitor */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm font-bold text-slate-900">
              Kapasitas & Beban Kerja Petugas PIC (Real-Time)
            </h2>
          </div>
          <span className="text-xs text-slate-400">Diperhitungkan saat tiket baru masuk</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {activePics.map((pic) => {
            const picWorkload = activeTickets.filter((t) => t.currentPicId === pic.uid).length;
            const completedCount = tickets.filter(
              (t) => t.currentPicId === pic.uid && ['Selesai', 'Ditutup'].includes(t.status)
            ).length;

            return (
              <div key={pic.uid} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                      {pic.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{formatPicDisplayName(pic.uid, pic.name)}</div>
                      <div className="text-[11px] text-slate-500">{pic.team}</div>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      picWorkload <= 2
                        ? 'bg-emerald-100 text-emerald-800'
                        : picWorkload <= 4
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {picWorkload <= 2 ? 'Kapasitas Longgar' : picWorkload <= 4 ? 'Sedang' : 'Tinggi'}
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg flex items-center justify-between text-xs font-mono-numbers">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Tiket Aktif:</span>
                    <strong className="text-slate-800 text-sm">{picWorkload} tiket</strong>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] block">Telah Selesai:</span>
                    <strong className="text-emerald-700 text-sm">{completedCount} tiket</strong>
                  </div>
                </div>

                <div className="text-[10px] text-slate-500">
                  Keahlian: {pic.expertise ? pic.expertise.slice(0, 2).join(', ') : 'Umum'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto-Assignment Rules Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm font-bold text-slate-900">
              Matriks Aturan Auto-Assignment Kategori Tiket
            </h2>
          </div>
          <span className="text-xs text-slate-400">Total {rules.length} Aturan</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Kategori Laporan</th>
                <th className="py-3 px-4">Tim Penanganan Tujuan</th>
                <th className="py-3 px-4">PIC Rekomendasi / Default</th>
                <th className="py-3 px-4">Strategi Penugasan</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rules.map((rule) => {
                return (
                  <tr key={rule.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{rule.categoryName}</div>
                      <div className="text-[11px] text-slate-400 max-w-xs truncate mt-0.5">
                        {rule.notes}
                      </div>
                    </td>

                    {/* Target Team */}
                    <td className="py-3.5 px-4 font-medium text-slate-800 whitespace-nowrap">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-semibold text-[11px]">
                        {rule.targetTeam}
                      </span>
                    </td>

                    {/* Default PIC */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {rule.defaultPicName ? (
                        <div className="flex items-center gap-1.5 font-medium text-slate-900">
                          <Wrench className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{formatPicDisplayName(rule.defaultPicId, rule.defaultPicName)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Otomatis Beban Terendah</span>
                      )}
                    </td>

                    {/* Strategy */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="text-[11px] text-slate-600 font-medium">
                        {rule.loadBalancingStrategy === 'least_active_workload'
                          ? 'Beban Aktif Terendah'
                          : rule.loadBalancingStrategy === 'round_robin'
                          ? 'Bergilir (Round-Robin)'
                          : 'Langsung ke PIC Default'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleRuleStatus(rule)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                          rule.isActive
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {rule.isActive ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(rule)}
                        className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 ml-auto cursor-pointer"
                      >
                        <Edit className="w-3 h-3 text-slate-500" />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Rule Modal */}
      {showEditModal && selectedRule && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4 animate-backdrop">
          <div className="bg-white rounded-2xl max-w-md w-full border border-[#DCEAF7] shadow-2xl p-6 space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Ubah Aturan Auto-Assignment
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kategori: <strong className="text-slate-800">{selectedRule.categoryName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Tim Penanganan Tujuan
                </label>
                <select
                  value={editTargetTeam}
                  onChange={(e) => setEditTargetTeam(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium"
                >
                  <option value="Network & Infrastructure">Network & Infrastructure</option>
                  <option value="IT Support & Hardware">IT Support & Hardware</option>
                  <option value="Application Support">Application Support</option>
                  <option value="General IT Support Queue">General IT Support Queue</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Petugas PIC Utama / Rekomendasi
                </label>
                <select
                  value={editDefaultPicId}
                  onChange={(e) => setEditDefaultPicId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium"
                >
                  <option value="">Otomatis (Sesuai Beban Terendah di Tim)</option>
                  {activePics.map((pic) => (
                    <option key={pic.uid} value={pic.uid}>
                      {formatPicDisplayName(pic.uid, pic.name)} — {pic.team}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Jika dipilih, sistem akan memprioritaskan PIC ini selagi aktif, atau memilih rekan satu tim dengan beban terendah.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Strategi Load Balancing
                </label>
                <select
                  value={editStrategy}
                  onChange={(e) => setEditStrategy(e.target.value as any)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium"
                >
                  <option value="least_active_workload">Least Active Workload (Beban Terendah)</option>
                  <option value="round_robin">Round-Robin (Bergilir Proporsional)</option>
                  <option value="direct_pic">Prioritas PIC Default</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="ruleActiveCheck"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded-sm cursor-pointer"
                />
                <label htmlFor="ruleActiveCheck" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Aktifkan Auto-Assignment untuk kategori ini
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
