import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Edit2,
  Power,
  Trash2,
  AlertCircle,
  Building,
  GraduationCap,
  Users,
  Ticket,
  ChevronRight,
  ShieldAlert,
  Info,
  Clock,
  Check,
  X,
} from 'lucide-react';
import { Unit, UnitType, User } from '../types';
import { storageService } from '../services/storageService';

interface MasterDataUnitViewProps {
  currentUser: User;
  onNavigate: (view: string) => void;
}

export const MasterDataUnitView: React.FC<MasterDataUnitViewProps> = ({
  currentUser,
  onNavigate,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const [units, setUnits] = useState<Unit[]>(() => storageService.getUnits());
  const [users, setUsers] = useState<User[]>(() => storageService.getUsers());
  const [tickets, setTickets] = useState(() => storageService.getTickets());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);

  // Form states
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<UnitType>('UPDL');
  const [formRegion, setFormRegion] = useState<string>('Jawa');
  const [formFocus, setFormFocus] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const refreshData = () => {
    setUnits(storageService.getUnits());
    setUsers(storageService.getUsers());
    setTickets(storageService.getTickets());
  };

  useEffect(() => {
    const unsub = storageService.subscribe(refreshData);
    return () => unsub();
  }, []);

  const triggerToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Metrics
  const stats = useMemo(() => {
    const total = units.length;
    const updlCount = units.filter((u) => u.unitType === 'UPDL').length;
    const corpuCount = units.filter((u) => u.unitType === 'CORPU').length;
    const nonUpdlCount = units.filter((u) => u.unitType === 'NON_UPDL').length;
    const activeCount = units.filter((u) => u.isActive).length;
    return { total, updlCount, corpuCount, nonUpdlCount, activeCount };
  }, [units]);

  // Relation counts per unit
  const relationCounts = useMemo(() => {
    const userMap: Record<string, number> = {};
    const ticketMap: Record<string, number> = {};

    users.forEach((u) => {
      const uId = (u.unitId || '').toLowerCase();
      if (uId) {
        userMap[uId] = (userMap[uId] || 0) + 1;
      }
    });

    tickets.forEach((t) => {
      const tId = (t.reporterUnitId || '').toLowerCase();
      if (tId) {
        ticketMap[tId] = (ticketMap[tId] || 0) + 1;
      }
    });

    return { userMap, ticketMap };
  }, [users, tickets]);

  // Filtered units
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (categoryFilter !== 'ALL' && u.unitType !== categoryFilter) {
        return false;
      }
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.unitName.toLowerCase().includes(q);
        const matchesCode = u.unitCode.toLowerCase().includes(q);
        const matchesRegion = (u.unitRegion || '').toLowerCase().includes(q);
        const matchesFocus = (u.unitFocus || '').toLowerCase().includes(q);
        return matchesName || matchesCode || matchesRegion || matchesFocus;
      }
      return true;
    });
  }, [units, categoryFilter, statusFilter, searchQuery]);

  // Handle Open Add
  const handleOpenAdd = () => {
    setFormCode('');
    setFormName('');
    setFormType('UPDL');
    setFormRegion('Luar Jawa');
    setFormFocus('');
    setFormError(null);
    setShowAddModal(true);
  };

  // Handle Open Edit
  const handleOpenEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setFormCode(unit.unitCode);
    setFormName(unit.unitName);
    setFormType(unit.unitType);
    setFormRegion(unit.unitRegion);
    setFormFocus(unit.unitFocus || '');
    setFormError(null);
  };

  // Handle Save Add
  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanCode = formCode.trim().toUpperCase();
    const cleanName = formName.trim();

    if (!cleanCode || !cleanName) {
      setFormError('Kode unit dan nama unit wajib diisi.');
      return;
    }

    const res = await storageService.addUnit(
      {
        unitCode: cleanCode,
        unitName: cleanName,
        unitType: formType,
        unitRegion: formRegion,
        unitFocus: formFocus.trim(),
        isActive: true,
      },
      currentUser
    );

    if (res.success && res.unit) {
      triggerToast(`Unit "${res.unit.unitName}" (${res.unit.unitCode}) berhasil ditambahkan ke Master Data.`);
      setShowAddModal(false);
      refreshData();
    } else {
      setFormError(res.error || 'Gagal menambahkan unit.');
    }
  };

  // Handle Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit) return;
    setFormError(null);

    const cleanCode = formCode.trim().toUpperCase();
    const cleanName = formName.trim();

    if (!cleanCode || !cleanName) {
      setFormError('Kode unit dan nama unit wajib diisi.');
      return;
    }

    // Check duplicate if changed
    const allUnits = storageService.getUnits();
    const dup = allUnits.find(
      (u) =>
        u.unitId !== editingUnit.unitId &&
        (u.unitCode.toUpperCase() === cleanCode || u.unitName.toLowerCase() === cleanName.toLowerCase())
    );
    if (dup) {
      setFormError(`Kode atau nama unit sudah digunakan oleh unit "${dup.unitName}".`);
      return;
    }

    const updated: Unit = {
      ...editingUnit,
      unitCode: cleanCode,
      unitName: cleanName,
      unitType: formType,
      unitRegion: formRegion as any,
      unitFocus: formFocus.trim(),
      updatedAt: new Date().toISOString(),
    };

    try { await storageService.saveUnit(updated, currentUser); } catch (error) { window.alert(error instanceof Error ? error.message : 'Gagal menyimpan ke server.'); return; }
    triggerToast(`Data unit "${updated.unitName}" berhasil diperbarui.`);
    setEditingUnit(null);
    refreshData();
  };

  // Handle Toggle Status
  const handleToggleStatus = async (unit: Unit) => {
    const res = await storageService.toggleUnitActive(unit.unitId, currentUser);
    if (res.success && res.unit) {
      triggerToast(
        `Status unit "${res.unit.unitName}" diubah menjadi ${res.unit.isActive ? 'AKTIF' : 'NONAKTIF'}.`,
        res.unit.isActive ? 'success' : 'info'
      );
      refreshData();
    } else {
      triggerToast(res.error || 'Gagal mengubah status unit.', 'error');
    }
  };

  // Handle Delete Unit
  const handleExecuteDelete = async () => {
    if (!unitToDelete) return;
    const res = await storageService.deleteUnit(unitToDelete.unitId, currentUser);
    if (res.success) {
      triggerToast(`Unit "${unitToDelete.unitName}" berhasil dihapus dari sistem.`, 'success');
      setUnitToDelete(null);
      refreshData();
    } else {
      triggerToast(res.error || 'Gagal menghapus unit.', 'error');
      setUnitToDelete(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white p-8 sm:p-12 text-center rounded-2xl border border-rose-200 shadow-sm max-w-lg mx-auto my-8 space-y-4">
        <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-slate-900">Akses Ditolak (403 Forbidden)</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Modul Master Data Unit hanya diperuntukkan bagi Administrator Ticketing sistem.
        </p>
        <button
          onClick={() => onNavigate('dashboard')}
          className="px-4 py-2 bg-[#417F85] text-white rounded-lg text-xs font-bold hover:bg-[#326A70] transition-colors cursor-pointer"
        >
          Kembali ke Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-page-enter">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : toastMessage.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-300'
              : 'bg-[#E7EFF1] text-[#35666D] border-[#D5E0E3]'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-[#417F85] shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-[#F5FAFA] p-6 rounded-2xl border border-[#D5E0E3] shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#69777D] mb-1">
            <button
              onClick={() => onNavigate('dashboard')}
              className="hover:text-[#417F85] transition-colors cursor-pointer"
            >
              Dashboard
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-[#69777D]/60" />
            <span className="font-bold text-[#20272B]">Master Data Unit</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#417F85] text-white flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#20272B] tracking-tight">
                Master Data Unit Kerja PLN
              </h1>
              <p className="text-xs text-[#69777D]">
                Pengelolaan 11 UPDL, PLN Corporate University, dan Unit Umum Non-UPDL terdaftar (Puslitbang, Pusharlis, UID, dsb.)
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-[#417F85] hover:bg-[#326A70] active:scale-[0.98] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer btn-press"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Unit Baru</span>
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 bg-white rounded-xl border border-[#D5E0E3] shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-[#69777D] uppercase tracking-wider block">
            Total Unit
          </span>
          <div className="text-2xl font-black text-[#20272B] font-mono-numbers">{stats.total}</div>
          <span className="text-[10px] text-[#69777D] block">Terdaftar di sistem</span>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-[#D5E0E3] shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-[#35666D] uppercase tracking-wider block flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-[#417F85]" /> 11 UPDL
          </span>
          <div className="text-2xl font-black text-[#35666D] font-mono-numbers">{stats.updlCount}</div>
          <span className="text-[10px] text-[#69777D] block">Jawa & Luar Jawa</span>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-[#D5E0E3] shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block flex items-center gap-1">
            <GraduationCap className="w-3.5 h-3.5 text-purple-600" /> PLN Corpu
          </span>
          <div className="text-2xl font-black text-purple-900 font-mono-numbers">{stats.corpuCount}</div>
          <span className="text-[10px] text-[#69777D] block">Unit Korporat</span>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-[#D5E0E3] shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block flex items-center gap-1">
            <Building className="w-3.5 h-3.5 text-amber-600" /> Non-UPDL
          </span>
          <div className="text-2xl font-black text-amber-900 font-mono-numbers">{stats.nonUpdlCount}</div>
          <span className="text-[10px] text-[#69777D] block">Puslitbang, Pusharlis, UID</span>
        </div>

        <div className="p-3.5 bg-white rounded-xl border border-[#D5E0E3] shadow-2xs space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Unit Aktif
          </span>
          <div className="text-2xl font-black text-emerald-900 font-mono-numbers">{stats.activeCount}</div>
          <span className="text-[10px] text-[#69777D] block">Siap melayani tiket</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#F5FAFA] p-4 rounded-xl border border-[#D5E0E3] shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-[#69777D] absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama unit, kode, atau wilayah..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D] font-medium shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-[#69777D] hover:text-[#20272B] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#69777D] font-medium hidden sm:inline">Kategori:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs bg-white border border-[#D5E0E3] rounded-xl px-3 py-2 text-[#20272B] font-bold focus:outline-hidden focus:ring-2 focus:ring-[#417F85] cursor-pointer shadow-2xs"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="UPDL">11 Unit UPDL</option>
              <option value="CORPU">PLN Corporate University</option>
              <option value="NON_UPDL">Unit Umum / Non-UPDL</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#69777D] font-medium hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-white border border-[#D5E0E3] rounded-xl px-3 py-2 text-[#20272B] font-bold focus:outline-hidden focus:ring-2 focus:ring-[#417F85] cursor-pointer shadow-2xs"
            >
              <option value="ALL">Semua Status</option>
              <option value="active">Aktif Saja</option>
              <option value="inactive">Nonaktif Saja</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-[#69777D]">
          Menampilkan <strong className="text-[#20272B]">{filteredUnits.length}</strong> dari {units.length} unit
        </div>
      </div>

      {/* Units Table */}
      <div className="bg-white rounded-xl border border-[#D5E0E3] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#E7EFF1] border-b border-[#D5E0E3] text-[#20272B] font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3 text-center w-12">No</th>
                <th className="py-3 px-4">Nama Resmi Unit</th>
                <th className="py-3 px-3">Kode Unit</th>
                <th className="py-3 px-3">Kategori</th>
                <th className="py-3 px-3">Wilayah</th>
                <th className="py-3 px-3 text-center">Pengguna / Tiket</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5E0E3]">
              {filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#69777D]">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Building2 className="w-8 h-8 text-[#69777D]/50 mx-auto" />
                      <p className="font-semibold text-xs text-[#20272B]">Tidak ada unit yang cocok</p>
                      <p className="text-[11px]">Coba ubah kata kunci pencarian atau filter kategori yang dipilih.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUnits.map((unit, index) => {
                  const uId = unit.unitId.toLowerCase();
                  const userCount = relationCounts.userMap[uId] || 0;
                  const ticketCount = relationCounts.ticketMap[uId] || 0;

                  return (
                    <tr
                      key={unit.unitId}
                      className={`hover:bg-[#F5FAFA] transition-colors ${
                        !unit.isActive ? 'opacity-65 bg-slate-50/50' : ''
                      }`}
                    >
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-[#69777D]">
                        {index + 1}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#20272B]">{unit.unitName}</div>
                        {unit.unitFocus && (
                          <div className="text-[11px] text-[#69777D] line-clamp-1 mt-0.5">
                            {unit.unitFocus}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="font-mono text-[11px] font-bold text-[#35666D] bg-[#E7EFF1] px-2 py-0.5 rounded border border-[#D5E0E3]">
                          {unit.unitCode}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            unit.unitType === 'UPDL'
                              ? 'bg-[#E7EFF1] text-[#35666D] border border-[#D5E0E3]'
                              : unit.unitType === 'CORPU'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {unit.unitType === 'UPDL' ? 'UPDL' : unit.unitType === 'CORPU' ? 'PLN Corpu' : 'Non-UPDL'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-[#69777D]">
                        {unit.unitRegion || '-'}
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#20272B] bg-[#E7EFF1] px-2 py-0.5 rounded">
                          <Users className="w-3 h-3 text-[#417F85]" />
                          <span>{userCount}</span>
                          <span className="text-[#69777D]">·</span>
                          <Ticket className="w-3 h-3 text-[#417F85]" />
                          <span>{ticketCount}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            unit.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {unit.isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Aktif</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-slate-500" />
                              <span>Nonaktif</span>
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(unit)}
                            title="Edit Unit"
                            className="p-1.5 rounded-lg text-[#35666D] hover:bg-[#E7EFF1] border border-[#D5E0E3] transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active Status */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(unit)}
                            title={unit.isActive ? 'Nonaktifkan Unit' : 'Aktifkan Unit'}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              unit.isActive
                                ? 'text-amber-700 hover:bg-amber-50 border-amber-300'
                                : 'text-emerald-700 hover:bg-emerald-50 border-emerald-300'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button (Protected) */}
                          <button
                            type="button"
                            onClick={() => setUnitToDelete(unit)}
                            title="Hapus Unit"
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Unit Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#F5FAFA] rounded-2xl border border-[#D5E0E3] shadow-xl max-w-lg w-full overflow-hidden animate-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-[#D5E0E3] bg-[#E7EFF1] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#417F85]" />
                <h2 className="text-sm font-bold text-[#20272B]">Tambah Master Data Unit Baru</h2>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#69777D] hover:text-[#20272B] cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#20272B] mb-1">
                  Nama Resmi Unit <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Contoh: PLN UPDL Padang atau PLN Puslitbang"
                  className="w-full text-xs px-3 py-2 bg-white border border-[#D5E0E3] rounded-xl focus:ring-2 focus:ring-[#417F85] text-[#20272B] font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#20272B] mb-1">
                    Kode Unit <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="Contoh: UPDL_PDG"
                    className="w-full text-xs px-3 py-2 bg-white border border-[#D5E0E3] rounded-xl font-mono uppercase focus:ring-2 focus:ring-[#417F85] text-[#20272B] font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#20272B] mb-1">
                    Kategori Unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => {
                      const t = e.target.value as UnitType;
                      setFormType(t);
                      if (t === 'CORPU') setFormRegion('Korporat');
                      else if (t === 'NON_UPDL') setFormRegion('Non-UPDL');
                      else setFormRegion('Jawa');
                    }}
                    className="w-full text-xs px-3 py-2 bg-white border border-[#D5E0E3] rounded-xl font-bold cursor-pointer"
                  >
                    <option value="UPDL">11 UPDL</option>
                    <option value="CORPU">PLN Corporate University</option>
                    <option value="NON_UPDL">Unit Umum / Non-UPDL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#20272B] mb-1">
                  Wilayah Unit
                </label>
                <select
                  value={formRegion}
                  onChange={(e) => setFormRegion(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-[#D5E0E3] rounded-xl font-semibold cursor-pointer"
                >
                  <option value="Jawa">Jawa</option>
                  <option value="Luar Jawa">Luar Jawa</option>
                  <option value="Korporat">Korporat</option>
                  <option value="Non-UPDL">Non-UPDL</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#20272B] mb-1">
                  Fokus Pembelajaran / Deskripsi Unit
                </label>
                <textarea
                  rows={2}
                  value={formFocus}
                  onChange={(e) => setFormFocus(e.target.value)}
                  placeholder="Keterangan academy, spesialisasi pelatihan, atau bidang kerja unit..."
                  className="w-full text-xs p-2.5 bg-white border border-[#D5E0E3] rounded-xl focus:ring-2 focus:ring-[#417F85] text-[#20272B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#D5E0E3]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-[#69777D] hover:text-[#20272B] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#417F85] hover:bg-[#326A70] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Simpan Unit Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Unit */}
      {editingUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[#F5FAFA] rounded-2xl border border-[#D5E0E3] shadow-xl max-w-lg w-full overflow-hidden animate-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-[#D5E0E3] bg-[#E7EFF1] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[#417F85]" />
                <h2 className="text-sm font-bold text-[#20272B]">Edit Master Data Unit</h2>
              </div>
              <button
                onClick={() => setEditingUnit(null)}
                className="text-[#69777D] hover:text-[#20272B] cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#20272B] mb-1">
                  Nama Resmi Unit <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-[#D5E0E3] rounded-xl focus:ring-2 focus:ring-[#417F85] text-[#20272B] font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#20272B] mb-1">
                    Kode Unit <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    className="w-full text-xs px-3 py-2 bg-white border border-[#D5E0E3] rounded-xl font-mono uppercase focus:ring-2 focus:ring-[#417F85] text-[#20272B] font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#20272B] mb-1">
                    Kategori Unit <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as UnitType)}
                    className="w-full text-xs px-3 py-2 bg-white border border-[#D5E0E3] rounded-xl font-bold cursor-pointer"
                  >
                    <option value="UPDL">11 UPDL</option>
                    <option value="CORPU">PLN Corporate University</option>
                    <option value="NON_UPDL">Unit Umum / Non-UPDL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#20272B] mb-1">
                  Wilayah Unit
                </label>
                <select
                  value={formRegion}
                  onChange={(e) => setFormRegion(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-[#D5E0E3] rounded-xl font-semibold cursor-pointer"
                >
                  <option value="Jawa">Jawa</option>
                  <option value="Luar Jawa">Luar Jawa</option>
                  <option value="Korporat">Korporat</option>
                  <option value="Non-UPDL">Non-UPDL</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#20272B] mb-1">
                  Fokus Pembelajaran / Deskripsi Unit
                </label>
                <textarea
                  rows={2}
                  value={formFocus}
                  onChange={(e) => setFormFocus(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-[#D5E0E3] rounded-xl focus:ring-2 focus:ring-[#417F85] text-[#20272B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#D5E0E3]">
                <button
                  type="button"
                  onClick={() => setEditingUnit(null)}
                  className="px-3.5 py-2 text-xs font-bold text-[#69777D] hover:text-[#20272B] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#417F85] hover:bg-[#326A70] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Unit (Protected Integrity) */}
      {unitToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            {(() => {
              const check = storageService.canDeleteUnit(unitToDelete.unitId);
              return (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#20272B]">
                        Hapus Unit: {unitToDelete.unitName}
                      </h3>
                      <p className="text-[11px] text-[#69777D]">
                        Kode: {unitToDelete.unitCode} ({unitToDelete.unitType})
                      </p>
                    </div>
                  </div>

                  {!check.canDelete ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5 leading-relaxed">
                      <div className="font-bold flex items-center gap-1.5 text-amber-800">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Unit Tidak Dapat Dihapus Permanen</span>
                      </div>
                      <p>{check.reason}</p>
                      <p className="text-[11px] font-semibold text-amber-800">
                        Saran: Gunakan tombol Nonaktifkan agar unit tidak muncul di pilihan pendaftaran baru tanpa merusak data riwayat lama.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-[#69777D] leading-relaxed">
                      Apakah Anda yakin ingin menghapus unit ini? Unit tidak memiliki relasi pengguna atau tiket aktif.
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setUnitToDelete(null)}
                      className="px-3.5 py-2 text-xs font-bold text-[#69777D] hover:text-[#20272B] cursor-pointer"
                    >
                      Tutup
                    </button>
                    {check.canDelete ? (
                      <button
                        type="button"
                        onClick={handleExecuteDelete}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                      >
                        Ya, Hapus Permanen
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          handleToggleStatus(unitToDelete);
                          setUnitToDelete(null);
                        }}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{unitToDelete.isActive ? 'Nonaktifkan Unit' : 'Aktifkan Unit'}</span>
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
