import React, { useState } from 'react';
import {
  Users,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PlusCircle,
  Search,
  Edit,
  Tag,
  Phone,
  Mail,
  Shield,
} from 'lucide-react';
import { User, Ticket } from '../types';
import { storageService } from '../services/storageService';
import { sortPicUsers, formatPicDisplayName } from '../utils/picHelpers';

interface PicManagementViewProps {
  tickets: Ticket[];
  currentUser: User;
  onNavigate: (view: string, ticketId?: string) => void;
}

export const PicManagementView: React.FC<PicManagementViewProps> = ({
  tickets,
  currentUser,
  onNavigate,
}) => {
  const [users, setUsers] = useState<User[]>(() =>
    sortPicUsers(storageService.getUsers().filter((u) => u.role === 'pic'))
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPic, setEditingPic] = useState<User | null>(null);

  // Form states for modal
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [team, setTeam] = useState('Network & Infrastructure');
  const [expertiseStr, setExpertiseStr] = useState('');
  const [phone, setPhone] = useState('');

  const refreshData = () => {
    setUsers(sortPicUsers(storageService.getUsers().filter((u) => u.role === 'pic')));
  };

  const picStats = users.map((pic) => {
    const assignedTickets = tickets.filter((t) => t.currentPicId === pic.uid);
    const inProgress = assignedTickets.filter((t) => t.status === 'Dalam Proses').length;
    const resolved = assignedTickets.filter((t) => ['Selesai', 'Ditutup'].includes(t.status)).length;
    const overdue = assignedTickets.filter((t) => {
      const now = Date.now();
      const due = new Date(t.dueAt).getTime();
      return !['Selesai', 'Ditutup'].includes(t.status) && now > due;
    }).length;

    let workloadStatus: 'Normal' | 'Sibuk' | 'Overload' = 'Normal';
    if (inProgress >= 4) workloadStatus = 'Overload';
    else if (inProgress >= 2) workloadStatus = 'Sibuk';

    return {
      pic,
      totalAssigned: assignedTickets.length,
      inProgress,
      resolved,
      overdue,
      workloadStatus,
    };
  });

  const filteredStats = picStats.filter(({ pic }) => {
    if (teamFilter !== 'ALL' && pic.team !== teamFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const mName = pic.name.toLowerCase().includes(q);
      const mNip = pic.employeeId.toLowerCase().includes(q);
      const mTeam = pic.team?.toLowerCase().includes(q) || false;
      const mExp = pic.expertise?.some((e) => e.toLowerCase().includes(q)) || false;
      if (!mName && !mNip && !mTeam && !mExp) return false;
    }
    return true;
  });

  React.useEffect(() => storageService.subscribe(refreshData), []);

  const handleOpenEdit = (pic: User) => {
    setEditingPic(pic);
    setName(pic.name);
    setEmployeeId(pic.employeeId);
    setTeam(pic.team || 'IT Support & Hardware');
    setExpertiseStr(pic.expertise ? pic.expertise.join(', ') : '');
    setPhone(pic.phone || '');
    setShowEditModal(true);
  };

  const handleSavePic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPic) return;

    const updatedUser: User = {
      ...editingPic,
      name,
      employeeId,
      team,
      expertise: expertiseStr.split(',').map((s) => s.trim()).filter(Boolean),
      phone,
    };

    try { await storageService.saveUser(updatedUser); } catch (error) { window.alert(error instanceof Error ? error.message : 'Gagal menyimpan ke server.'); return; }
    refreshData();
    setShowEditModal(false);
  };

  const teams = Array.from(new Set(users.map((u) => u.team).filter(Boolean))) as string[];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Manajemen Petugas PIC
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola data petugas penanganan (PIC), keahlian teknis, dan pantau beban kerja aktif.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-medium"
          >
            <option value="ALL">Semua Tim Teknis</option>
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari PIC atau keahlian..."
              className="text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
          </div>
        </div>
      </div>

      {/* PIC Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Nama Petugas</th>
                <th className="py-3 px-4">NIP & Kontak</th>
                <th className="py-3 px-4">Tim Penugasan</th>
                <th className="py-3 px-4">Keahlian Teknis</th>
                <th className="py-3 px-4 text-center">Beban Aktif</th>
                <th className="py-3 px-4 text-center">Selesai</th>
                <th className="py-3 px-4 text-center">Status Beban</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredStats.map(({ pic, totalAssigned, inProgress, resolved, overdue, workloadStatus }) => (
                <tr key={pic.uid} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-800 text-white font-bold text-xs flex items-center justify-center">
                        {pic.name.charAt(0)}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 block">{formatPicDisplayName(pic.uid, pic.name)}</span>
                        <span className="text-[11px] text-slate-400">{pic.email}</span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-mono-numbers">
                    <span className="font-semibold text-slate-800 block text-[11px]">{pic.employeeId}</span>
                    <span className="text-slate-400 text-[11px]">{pic.phone || '-'}</span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="font-medium text-slate-800">{pic.team || '-'}</span>
                  </td>

                  <td className="py-3.5 px-4 max-w-xs">
                    <div className="flex flex-wrap gap-1">
                      {pic.expertise?.map((exp) => (
                        <span
                          key={exp}
                          className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium"
                        >
                          {exp}
                        </span>
                      ))}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-center font-mono-numbers">
                    <span className="font-bold text-emerald-800 text-sm">{inProgress}</span>
                    <span className="text-slate-400 text-[10px] block">sedang berjalan</span>
                  </td>

                  <td className="py-3.5 px-4 text-center font-mono-numbers">
                    <span className="font-bold text-teal-700 text-sm">{resolved}</span>
                    <span className="text-slate-400 text-[10px] block">tuntas</span>
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        workloadStatus === 'Overload'
                          ? 'bg-rose-100 text-rose-800'
                          : workloadStatus === 'Sibuk'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {workloadStatus}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleOpenEdit(pic)}
                      className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit PIC Modal */}
      {showEditModal && editingPic && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-backdrop">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DCEAF7] space-y-4 animate-modal-enter">
            <h3 className="text-base font-bold text-slate-900">
              Edit Data Petugas PIC
            </h3>

            <form onSubmit={handleSavePic} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">NIP Pegawai</label>
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono-numbers"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Tim Penugasan</label>
                <select
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="Network & Infrastructure">Network & Infrastructure</option>
                  <option value="IT Support & Hardware">IT Support & Hardware</option>
                  <option value="Application Support">Application Support</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Daftar Keahlian (pisahkan dengan koma)
                </label>
                <input
                  type="text"
                  value={expertiseStr}
                  onChange={(e) => setExpertiseStr(e.target.value)}
                  placeholder="Contoh: Cisco, Wi-Fi, Fiber Optic, Moodle LMS"
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Nomor Telepon / WhatsApp</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-lg hover:bg-emerald-800 cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
