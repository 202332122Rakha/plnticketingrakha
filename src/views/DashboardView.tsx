import React, { useState, useMemo, useEffect } from 'react';
import {
  Ticket as TicketIcon,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Hourglass,
  Flame,
  PlusCircle,
  TrendingUp,
  ShieldAlert,
  ChevronRight,
  ClipboardList,
  Wrench,
  User,
  HelpCircle,
  FileText,
  Activity,
  Layers,
  MapPin,
  Building2,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { Ticket, User as UserType } from '../types';
import { listRegistrationRequests } from '../services/registrationApiService';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { getSlaStatus } from '../utils/slaCalculator';
import { formatTicketNumberDisplay } from '../utils/ticketHelpers';
import {
  ALL_REGISTERED_UNITS,
  UPDL_UNITS,
  CORPU_UNIT,
  NON_UPDL_UNITS,
} from '../data/unitsData';
import { OriginUnitBadge } from '../utils/unitHelpers';
import { getScopedTickets } from '../utils/authPermissions';

interface DashboardViewProps {
  tickets: Ticket[];
  currentUser: UserType;
  onNavigate: (view: string, ticketId?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  tickets,
  currentUser,
  onNavigate,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const isManajemen = currentUser.role === 'manajemen';
  const isPic = currentUser.role === 'pic';
  const isPelapor = currentUser.role === 'pelapor';

  const [selectedAsalUnit, setSelectedAsalUnit] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');

  const [regStats, setRegStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  useEffect(() => {
    if (!isAdmin) {
      setRegStats({ total: 0, pending: 0, approved: 0, rejected: 0 });
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const requests = await listRegistrationRequests();
        if (!cancelled) {
          setRegStats({
            total: requests.length,
            pending: requests.filter((request) => request.status === 'PENDING' || request.status === 'Menunggu Verifikasi').length,
            approved: requests.filter((request) => request.status === 'APPROVED' || request.status === 'Disetujui').length,
            rejected: requests.filter((request) => request.status === 'REJECTED' || request.status === 'Ditolak').length,
          });
        }
      } catch {
        if (!cancelled) setRegStats({ total: 0, pending: 0, approved: 0, rejected: 0 });
      }
    };
    const refreshOnChange = () => void refresh();
    void refresh();
    window.addEventListener('ticket-data-changed', refreshOnChange);
    return () => {
      cancelled = true;
      window.removeEventListener('ticket-data-changed', refreshOnChange);
    };
  }, [isAdmin]);

  // Handle Asal Unit change with contextual reset
  const handleAsalUnitChange = (newAsal: string) => {
    setSelectedAsalUnit(newAsal);
    if (selectedUnit !== 'ALL') {
      const unitObj = ALL_REGISTERED_UNITS.find(
        (u) => u.unitId === selectedUnit || u.unitCode === selectedUnit
      );
      if (!unitObj) {
        setSelectedUnit('ALL');
      } else if (newAsal === 'UPDL' && unitObj.unitType !== 'UPDL') {
        setSelectedUnit('ALL');
      } else if (newAsal === 'CORPU' && unitObj.unitType !== 'CORPU') {
        setSelectedUnit('ALL');
      } else if (newAsal === 'NON_UPDL' && unitObj.unitType !== 'NON_UPDL') {
        setSelectedUnit('ALL');
      }
    }
  };

  // Strict data access scoping combined with Asal Unit and Unit filtering
  const accessibleTickets = useMemo(() => {
    return getScopedTickets(currentUser, tickets).filter((t) => {

      // Filter by Asal Unit (Requirement 1, 4, 8)
      if (selectedAsalUnit !== 'ALL') {
        if (selectedAsalUnit === 'UPDL' && t.reporterUnitType !== 'UPDL') return false;
        if (selectedAsalUnit === 'CORPU' && t.reporterUnitType !== 'CORPU') return false;
        if (selectedAsalUnit === 'NON_UPDL' && t.reporterUnitType !== 'NON_UPDL') return false;
        if (selectedAsalUnit === 'UNCLASSIFIED' && t.reporterUnitType !== 'UNCLASSIFIED') return false;
      }

      // Filter by specific Unit (Requirement 5)
      if (selectedUnit !== 'ALL') {
        const targetUnit = ALL_REGISTERED_UNITS.find(
          (u) => u.unitId === selectedUnit || u.unitCode === selectedUnit
        );
        const uId = selectedUnit.toLowerCase();
        const uCode = targetUnit?.unitCode.toLowerCase() || '';
        const uName = targetUnit?.unitName.toLowerCase() || '';

        const matchesUnit =
          t.reporterUnitId === selectedUnit ||
          (t.reporterUnitCode && uCode && t.reporterUnitCode.toLowerCase() === uCode) ||
          (t.reporterUnitName && uName && t.reporterUnitName.toLowerCase().includes(uName));

        if (!matchesUnit) return false;
      }

      return true;
    });
  }, [tickets, currentUser, selectedAsalUnit, selectedUnit]);

  // Overall metrics
  const total = accessibleTickets.length;
  const newTickets = accessibleTickets.filter((t) => t.status === 'Baru').length;
  const inProgress = accessibleTickets.filter((t) => t.status === 'Dalam Proses').length;
  const waiting = accessibleTickets.filter((t) =>
    ['Menunggu Pelapor', 'Menunggu Pihak Ketiga', 'Menunggu Persetujuan'].includes(t.status)
  ).length;
  const resolved = accessibleTickets.filter((t) => ['Selesai', 'Ditutup'].includes(t.status)).length;
  const critical = accessibleTickets.filter((t) => t.priority === 'Kritis').length;

  // Origin Unit Metrics computed dynamically from accessibleTickets (Requirement 8)
  const originUnitStats = useMemo(() => {
    const updlCount = accessibleTickets.filter((t) => t.reporterUnitType === 'UPDL').length;
    const corpuCount = accessibleTickets.filter((t) => t.reporterUnitType === 'CORPU').length;
    const nonUpdlCount = accessibleTickets.filter((t) => t.reporterUnitType === 'NON_UPDL').length;
    const unclassifiedCount = accessibleTickets.filter(
      (t) => t.reporterUnitType === 'UNCLASSIFIED' || !t.reporterUnitType
    ).length;

    // Per UPDL breakdown
    const updlBreakdown = UPDL_UNITS.map((unit) => {
      const count = accessibleTickets.filter(
        (t) =>
          t.reporterUnitId === unit.unitId ||
          t.reporterUnitCode === unit.unitCode ||
          (t.reporterUnitName && t.reporterUnitName.toLowerCase().includes(unit.unitName.toLowerCase()))
      ).length;
      return {
        unitId: unit.unitId,
        unitName: unit.unitName,
        region: unit.unitRegion,
        count,
      };
    });

    return {
      updlCount,
      corpuCount,
      nonUpdlCount,
      unclassifiedCount,
      updlBreakdown,
    };
  }, [accessibleTickets]);

  // Overdue check
  const overdueTickets = accessibleTickets.filter((t) => {
    const sla = getSlaStatus(t.createdAt, t.dueAt, t.status, t.resolvedAt);
    return sla.isOverdue;
  });

  // SLA Compliance rate (%)
  const completed = accessibleTickets.filter((t) => t.status === 'Selesai' || t.status === 'Ditutup');
  const onTimeCompleted = completed.filter((t) => {
    const sla = getSlaStatus(t.createdAt, t.dueAt, t.status, t.resolvedAt);
    return !sla.isOverdue;
  });
  const slaCompliance =
    completed.length > 0 ? Math.round((onTimeCompleted.length / completed.length) * 100) : 100;

  // Unassigned tickets for Admin
  const unassignedTickets = accessibleTickets.filter(
    (t) => !t.currentPicId && t.status !== 'Ditolak'
  );

  // Priority counts
  const priorityCounts = {
    Kritis: accessibleTickets.filter((t) => t.priority === 'Kritis').length,
    Tinggi: accessibleTickets.filter((t) => t.priority === 'Tinggi').length,
    Sedang: accessibleTickets.filter((t) => t.priority === 'Sedang').length,
    Rendah: accessibleTickets.filter((t) => t.priority === 'Rendah').length,
  };

  // Urgent list for table
  const urgentTickets = [...accessibleTickets]
    .sort((a, b) => {
      const pWeight = { Kritis: 4, Tinggi: 3, Sedang: 2, Rendah: 1 };
      const diff = pWeight[b.priority] - pWeight[a.priority];
      if (diff !== 0) return diff;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Banner Personalized with Soft Corporate Teal Palette & Filter Controls */}
      <div className="bg-[#F5FAFA] p-6 rounded-2xl border border-[#D5E0E3] shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-[#20272B] tracking-tight">
              {isAdmin && `Selamat datang, ${currentUser.name}`}
              {isManajemen && `Executive Dashboard — ${currentUser.name}`}
              {isPic && `Halo, ${currentUser.name}`}
              {isPelapor && `Portal Layanan Pegawai — ${currentUser.name}`}
            </h1>
            <span
              className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${
                isAdmin
                  ? 'bg-[#E7EFF1] text-[#35666D] border border-[#D5E0E3]'
                  : isManajemen
                  ? 'bg-purple-100 text-purple-900 border border-purple-200'
                  : isPic
                  ? 'bg-[#E7EFF1] text-[#35666D] border border-[#D5E0E3]'
                  : 'bg-white text-[#20272B] border border-[#D5E0E3]'
              }`}
            >
              {isPic
                ? currentUser.uid === 'user-pic-1'
                  ? 'PIC 1 (Network)'
                  : currentUser.uid === 'user-pic-2'
                  ? 'PIC 2 (Hardware)'
                  : currentUser.uid === 'user-pic-3'
                  ? 'PIC 3 (Aplikasi)'
                  : 'Petugas PIC'
                : currentUser.role === 'admin'
                ? 'Admin Ticketing'
                : currentUser.role}
            </span>
          </div>
          <p className="text-xs text-[#69777D] mt-1.5 max-w-3xl leading-relaxed">
            {isAdmin &&
              'Monitoring tiket layanan terintegrasi dengan pemisahan sumber asal pelapor dari 11 UPDL, PLN Corpu, dan Unit Umum.'}
            {isManajemen &&
              'Ringkasan eksekutif performa helpdesk, kepatuhan SLA, dan sebaran asal unit pelapor se-Indonesia.'}
            {isPic &&
              `Akun Petugas PIC · Tim: ${
                currentUser.team || 'Teknis TI'
              } · Menampilkan tiket yang ditugaskan khusus kepada akun Anda.`}
            {isPelapor &&
              `Unit Asal: ${currentUser.unitName || 'PLN UPDL'} · Pantau status penanganan tiket Anda.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {isAdmin || isManajemen ? (
          <>
            {/* Asal Unit Filter */}
            <div className="flex items-center gap-1.5 bg-[#FFFFFF] px-3 py-2 rounded-xl border border-[#D5E0E3] shadow-2xs">
              <Building2 className="w-3.5 h-3.5 text-[#417F85]" />
              <span className="text-[11px] font-bold text-[#69777D]">Asal:</span>
              <select
                value={selectedAsalUnit}
                onChange={(e) => handleAsalUnitChange(e.target.value)}
                className="text-xs bg-transparent text-[#35666D] font-bold focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">Semua Asal Unit</option>
                <option value="UPDL">11 UPDL</option>
                <option value="CORPU">PLN Corpu</option>
                <option value="NON_UPDL">Unit Umum / Non-UPDL</option>
              </select>
            </div>

            {/* Unit Filter */}
            <div className="flex items-center gap-1.5 bg-[#FFFFFF] px-3 py-2 rounded-xl border border-[#D5E0E3] shadow-2xs">
              <MapPin className="w-3.5 h-3.5 text-[#417F85]" />
              <span className="text-[11px] font-bold text-[#69777D]">Unit:</span>
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="text-xs bg-transparent text-[#20272B] font-bold focus:outline-hidden cursor-pointer max-w-[170px] truncate"
              >
                <option value="ALL">
                  {selectedAsalUnit === 'UPDL'
                    ? 'Semua 11 UPDL'
                    : selectedAsalUnit === 'CORPU'
                    ? 'PLN Corpu'
                    : selectedAsalUnit === 'NON_UPDL'
                    ? 'Semua Unit Umum'
                    : 'Semua Unit'}
                </option>

                {(selectedAsalUnit === 'ALL' || selectedAsalUnit === 'UPDL') && (
                  <optgroup label="Wilayah Pulau Jawa (6 UPDL)">
                    {UPDL_UNITS.filter((u) => u.unitRegion === 'Jawa').map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.unitName}
                      </option>
                    ))}
                  </optgroup>
                )}

                {(selectedAsalUnit === 'ALL' || selectedAsalUnit === 'UPDL') && (
                  <optgroup label="Wilayah Luar Jawa (5 UPDL)">
                    {UPDL_UNITS.filter((u) => u.unitRegion === 'Luar Jawa').map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.unitName}
                      </option>
                    ))}
                  </optgroup>
                )}

                {(selectedAsalUnit === 'ALL' || selectedAsalUnit === 'CORPU') && (
                  <optgroup label="Unit Korporat (Bukan UPDL)">
                    <option value={CORPU_UNIT.unitId}>{CORPU_UNIT.unitName}</option>
                  </optgroup>
                )}

                {(selectedAsalUnit === 'ALL' || selectedAsalUnit === 'NON_UPDL') && (
                  <optgroup label="Unit Umum / Non-UPDL">
                    {NON_UPDL_UNITS.map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.unitName}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5 bg-[#FFFFFF] px-3.5 py-2 rounded-xl border border-[#D5E0E3] shadow-2xs">
            <Building2 className="w-3.5 h-3.5 text-[#417F85]" />
            <span className="text-[11px] font-bold text-[#69777D]">Unit Kerja:</span>
            <span className="text-xs font-extrabold text-[#35666D]">
              {currentUser.unitName || 'PLN UPDL'}
            </span>
          </div>
        )}

          {(isAdmin || isPelapor) && (
            <button
              onClick={() => onNavigate('create-ticket')}
              className="px-4 py-2.5 bg-[#417F85] hover:bg-[#326A70] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap btn-press"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Buat Tiket Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Ringkasan Permohonan Registrasi Karyawan (Admin Ticketing) */}
      {isAdmin && (
        <div className="bg-[#F5FAFA] p-5 rounded-2xl border border-[#D5E0E3] shadow-2xs space-y-4 animate-card-enter">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#D5E0E3] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[#417F85] text-white flex items-center justify-center shadow-xs">
                <FileText className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#20272B]">
                  Ringkasan Permohonan Registrasi Karyawan
                </h2>
                <p className="text-[11px] text-[#69777D]">
                  Pemeriksaan akun baru, verifikasi NIP, dan disposisi hak akses helpdesk PLN Corporate University.
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('registration-requests')}
              className="text-xs text-[#417F85] hover:text-[#326A70] font-bold flex items-center gap-1 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-[#D5E0E3] shadow-2xs"
            >
              <span>Buka Permohonan Registrasi</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div
              onClick={() => onNavigate('registration-requests')}
              className="bg-white p-4 rounded-xl border border-[#D5E0E3] shadow-2xs hover:border-[#417F85] transition-all cursor-pointer"
            >
              <div className="text-[11px] font-bold text-[#69777D] uppercase tracking-wider">
                Total Permohonan
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#20272B] font-mono-numbers">
                  {regStats.total}
                </span>
                <span className="text-[11px] text-[#69777D]">Karyawan</span>
              </div>
            </div>

            <div
              onClick={() => onNavigate('registration-requests')}
              className="bg-white p-4 rounded-xl border border-amber-300 shadow-2xs bg-amber-50/20 hover:border-amber-500 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                  Menunggu Verifikasi
                </span>
                {regStats.pending > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-900 font-mono-numbers">
                  {regStats.pending}
                </span>
                <span className="text-[11px] text-amber-800 font-medium">Butuh Approval</span>
              </div>
            </div>

            <div
              onClick={() => onNavigate('registration-requests')}
              className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs bg-emerald-50/20 hover:border-emerald-400 transition-all cursor-pointer"
            >
              <div className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                Permohonan Disetujui
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-900 font-mono-numbers">
                  {regStats.approved}
                </span>
                <span className="text-[11px] text-emerald-700 font-medium">Akun Aktif</span>
              </div>
            </div>

            <div
              onClick={() => onNavigate('registration-requests')}
              className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs bg-rose-50/20 hover:border-rose-400 transition-all cursor-pointer"
            >
              <div className="text-[11px] font-bold text-rose-900 uppercase tracking-wider">
                Permohonan Ditolak
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-rose-900 font-mono-numbers">
                  {regStats.rejected}
                </span>
                <span className="text-[11px] text-rose-700 font-medium">Tidak Lolos</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ringkasan Tiket Berdasarkan Asal Unit */}
      <div className="bg-[#F5FAFA] p-5 rounded-2xl border border-[#D5E0E3] shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#D5E0E3] pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#417F85]" />
            <div>
              <h2 className="text-sm font-bold text-[#20272B]">
                Ringkasan Tiket Berdasarkan Asal Unit Pelapor
              </h2>
              <p className="text-[11px] text-[#69777D]">
                Pemisahan data tiket dari 11 UPDL, PLN Corpu, dan Unit Umum/Non-UPDL terdaftar.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('all-tickets')}
            className="text-xs text-[#417F85] hover:text-[#326A70] font-bold flex items-center gap-1 cursor-pointer"
          >
            <span>Buka di Daftar Tiket</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {isAdmin || isManajemen ? (
          <>
            {/* 4 Cards Ringkasan Asal Unit */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              {/* 1. Tiket 11 UPDL */}
              <div
                onClick={() => {
                  setSelectedAsalUnit('UPDL');
                  onNavigate('all-tickets');
                }}
                className="p-4 rounded-xl border border-[#D5E0E3] bg-[#E7EFF1] hover:bg-[#D5E0E3] transition-all cursor-pointer shadow-2xs group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#35666D] uppercase tracking-wider">
                    Tiket 11 UPDL
                  </span>
                  <OriginUnitBadge unitType="UPDL" size="sm" showDot={false} />
                </div>
                <div className="text-3xl font-black text-[#35666D] font-mono-numbers mt-1.5">
                  {originUnitStats.updlCount}
                </div>
                <div className="text-[10px] text-[#69777D] mt-1 flex items-center justify-between">
                  <span>Dari 11 UPDL se-Indonesia</span>
                  <span className="font-bold text-[#35666D]">
                    {total > 0 ? Math.round((originUnitStats.updlCount / total) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* 2. Tiket PLN Corpu */}
              <div
                onClick={() => {
                  setSelectedAsalUnit('CORPU');
                  onNavigate('all-tickets');
                }}
                className="p-4 rounded-xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100/60 transition-all cursor-pointer shadow-2xs group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider">
                    Tiket PLN Corpu
                  </span>
                  <OriginUnitBadge unitType="CORPU" size="sm" showDot={false} />
                </div>
                <div className="text-3xl font-black text-purple-900 font-mono-numbers mt-1.5">
                  {originUnitStats.corpuCount}
                </div>
                <div className="text-[10px] text-[#64748B] mt-1 flex items-center justify-between">
                  <span>Korporat (Bukan UPDL)</span>
                  <span className="font-bold text-purple-800">
                    {total > 0 ? Math.round((originUnitStats.corpuCount / total) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* 3. Tiket Unit Umum / Non-UPDL */}
              <div
                onClick={() => {
                  setSelectedAsalUnit('NON_UPDL');
                  onNavigate('all-tickets');
                }}
                className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100/60 transition-all cursor-pointer shadow-2xs group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                    Unit Non-UPDL
                  </span>
                  <OriginUnitBadge unitType="NON_UPDL" size="sm" showDot={false} />
                </div>
                <div className="text-3xl font-black text-amber-900 font-mono-numbers mt-1.5">
                  {originUnitStats.nonUpdlCount}
                </div>
                <div className="text-[10px] text-[#64748B] mt-1 flex items-center justify-between">
                  <span>Unit Umum / PLN Lainnya</span>
                  <span className="font-bold text-amber-800">
                    {total > 0 ? Math.round((originUnitStats.nonUpdlCount / total) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* 4. Belum Terklasifikasi */}
              <div
                onClick={() => {
                  if (isAdmin) {
                    onNavigate('all-tickets');
                  }
                }}
                className={`p-4 rounded-xl border transition-all shadow-2xs ${
                  originUnitStats.unclassifiedCount > 0
                    ? 'border-rose-200 bg-rose-50/60 text-rose-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Belum Terklasifikasi
                  </span>
                  <OriginUnitBadge unitType="UNCLASSIFIED" size="sm" showDot={false} />
                </div>
                <div
                  className={`text-3xl font-black font-mono-numbers mt-1.5 ${
                    originUnitStats.unclassifiedCount > 0 ? 'text-rose-700' : 'text-slate-800'
                  }`}
                >
                  {originUnitStats.unclassifiedCount}
                </div>
                <div className="text-[10px] text-[#64748B] mt-1 flex items-center justify-between">
                  <span>Perlu verifikasi Admin</span>
                  {isAdmin && originUnitStats.unclassifiedCount > 0 && (
                    <span className="font-bold text-rose-700 underline cursor-pointer">
                      Perbaiki &gt;
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Visual Proportional Comparison Bar & Individual UPDL Breakdown (Requirement 8) */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#172B4D]">
                  Proporsi Sumber Tiket: 11 UPDL vs PLN Corpu vs Non-UPDL
                </span>
                <span className="text-[11px] text-[#69777D] font-mono-numbers">
                  Total {total} Tiket
                </span>
              </div>

              {/* Multi-segmented Progress Bar */}
              <div className="w-full h-3 rounded-full bg-[#FFFFFF] border border-[#D5E0E3] overflow-hidden flex shadow-inner">
                <div
                  style={{
                    width: `${total > 0 ? (originUnitStats.updlCount / total) * 100 : 0}%`,
                  }}
                  className="bg-[#417F85] transition-all duration-500"
                  title={`UPDL: ${originUnitStats.updlCount} tiket`}
                />
                <div
                  style={{
                    width: `${total > 0 ? (originUnitStats.corpuCount / total) * 100 : 0}%`,
                  }}
                  className="bg-purple-600 transition-all duration-500"
                  title={`PLN Corpu: ${originUnitStats.corpuCount} tiket`}
                />
                <div
                  style={{
                    width: `${total > 0 ? (originUnitStats.nonUpdlCount / total) * 100 : 0}%`,
                  }}
                  className="bg-amber-500 transition-all duration-500"
                  title={`Non-UPDL: ${originUnitStats.nonUpdlCount} tiket`}
                />
                <div
                  style={{
                    width: `${total > 0 ? (originUnitStats.unclassifiedCount / total) * 100 : 0}%`,
                  }}
                  className="bg-rose-500 transition-all duration-500"
                  title={`Belum Terklasifikasi: ${originUnitStats.unclassifiedCount} tiket`}
                />
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold pt-1">
                <div className="flex items-center gap-1.5 text-[#35666D]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#417F85]" />
                  <span>11 UPDL ({originUnitStats.updlCount})</span>
                </div>
                <div className="flex items-center gap-1.5 text-purple-800">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                  <span>PLN Corpu ({originUnitStats.corpuCount})</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-800">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Unit Non-UPDL ({originUnitStats.nonUpdlCount})</span>
                </div>
                {originUnitStats.unclassifiedCount > 0 && (
                  <div className="flex items-center gap-1.5 text-rose-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span>Belum Terklasifikasi ({originUnitStats.unclassifiedCount})</span>
                  </div>
                )}
              </div>
            </div>

            {/* 11 UPDL Comparison Grid (Requirement 8) */}
            <div className="pt-2 border-t border-[#DCEAF7]/80">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-bold text-[#172B4D] uppercase tracking-wider">
                  Distribusi Tiket per Unit UPDL Resmi (11 UPDL)
                </h3>
                <span className="text-[10px] text-[#64748B]">
                  6 Jawa · 5 Luar Jawa
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {originUnitStats.updlBreakdown.map((item) => (
                  <div
                    key={item.unitId}
                    onClick={() => {
                      setSelectedAsalUnit('UPDL');
                      setSelectedUnit(item.unitId);
                    }}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      selectedUnit === item.unitId
                        ? 'bg-[#E7EFF1] border-[#417F85] shadow-2xs'
                        : 'bg-[#F5FAFA] border-[#D5E0E3] hover:border-[#417F85] hover:bg-white'
                    }`}
                  >
                    <div className="text-[10px] font-semibold text-[#69777D] truncate" title={item.unitName}>
                      {item.unitName.replace('PLN UPDL ', '')}
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-base font-bold text-[#20272B] font-mono-numbers">
                        {item.count}
                      </span>
                      <span className="text-[9px] text-[#417F85] font-bold">
                        {item.region}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Khusus Pelapor & PIC: Isolasi data - Tampilkan hanya informasi unit kerja akun sendiri */
          <div className="p-4 rounded-xl border border-[#D5E0E3] bg-[#E7EFF1] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-[#417F85] text-white flex items-center justify-center font-bold shadow-2xs">
                  <Building2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-extrabold text-[#20272B]">
                    {currentUser.unitName || 'Unit Kerja Terdaftar'}
                  </h3>
                  <p className="text-[11px] text-[#69777D]">
                    Kode Unit: <strong className="text-[#35666D]">{currentUser.unitCode || '-'}</strong> · Ruang Lingkup Data Terikat
                  </p>
                </div>
              </div>
              <OriginUnitBadge unitType={currentUser.unitType || 'UPDL'} size="sm" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
              <div className="p-3 bg-white rounded-xl border border-[#D5E0E3] shadow-2xs">
                <span className="text-[10px] text-[#69777D] font-bold uppercase block">Tiket Terkait</span>
                <span className="text-xl font-black text-[#20272B] font-mono-numbers">{total}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-sky-200 bg-sky-50/30 shadow-2xs">
                <span className="text-[10px] text-sky-800 font-bold uppercase block">Tiket Baru</span>
                <span className="text-xl font-black text-sky-900 font-mono-numbers">{newTickets}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-amber-200 bg-amber-50/30 shadow-2xs">
                <span className="text-[10px] text-amber-800 font-bold uppercase block">Sedang Ditangani</span>
                <span className="text-xl font-black text-amber-900 font-mono-numbers">{inProgress}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-2xs">
                <span className="text-[10px] text-emerald-800 font-bold uppercase block">Selesai Ditangani</span>
                <span className="text-xl font-black text-emerald-900 font-mono-numbers">{resolved}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards Strip tailored to Role */}
      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5">
          <div className="bg-[#F5FAFA] p-4 rounded-xl border border-[#D5E0E3] shadow-2xs card-hover">
            <span className="text-[11px] font-medium text-[#69777D] block mb-1">Total Tiket</span>
            <span className="text-2xl font-black text-[#20272B] font-mono-numbers">{total}</span>
            <span className="text-[10px] text-[#69777D] block mt-1">Aktif difilter</span>
          </div>

          <div className="bg-[#FFFFFF] p-4 rounded-xl border border-[#D5E0E3] shadow-2xs card-hover">
            <span className="text-[11px] font-medium text-[#35666D] block mb-1">Tiket Baru</span>
            <span className="text-2xl font-black text-[#35666D] font-mono-numbers">{newTickets}</span>
            <span className="text-[10px] text-[#417F85] block mt-1">Perlu verifikasi</span>
          </div>

          <div className="bg-[#FFFFFF] p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs card-hover">
            <span className="text-[11px] font-medium text-amber-800 block mb-1">Belum Ada PIC</span>
            <span className="text-2xl font-black text-amber-700 font-mono-numbers">
              {unassignedTickets.length}
            </span>
            <span className="text-[10px] text-amber-600 block mt-1">Perlu penetapan</span>
          </div>

          <div className="bg-[#F5FAFA] p-4 rounded-xl border border-[#D5E0E3] shadow-2xs card-hover">
            <span className="text-[11px] font-medium text-[#35666D] block mb-1">Dalam Proses</span>
            <span className="text-2xl font-black text-[#35666D] font-mono-numbers">{inProgress}</span>
            <span className="text-[10px] text-[#417F85] block mt-1">Ditangani PIC</span>
          </div>

          <div className="bg-[#FFFFFF] p-4 rounded-xl border border-rose-200 bg-rose-50/20 shadow-2xs card-hover">
            <span className="text-[11px] font-medium text-rose-700 block mb-1">Terlambat SLA</span>
            <span className="text-2xl font-black text-rose-700 font-mono-numbers">
              {overdueTickets.length}
            </span>
            <span className="text-[10px] text-rose-600 block mt-1">Melebihi target</span>
          </div>

          <div className="bg-[#FFFFFF] p-4 rounded-xl border border-[#D5E0E3] shadow-2xs card-hover">
            <span className="text-[11px] font-medium text-emerald-700 block mb-1">Tiket Selesai</span>
            <span className="text-2xl font-black text-emerald-800 font-mono-numbers">{resolved}</span>
            <span className="text-[10px] text-emerald-600 block mt-1">Solusi diterapkan</span>
          </div>

          <div className="bg-[#F5FAFA] p-4 rounded-xl border border-[#D5E0E3] shadow-2xs card-hover">
            <span className="text-[11px] font-medium text-[#35666D] block mb-1">Kepatuhan SLA</span>
            <span className="text-2xl font-black text-[#35666D] font-mono-numbers">{slaCompliance}%</span>
            <span className="text-[10px] text-[#417F85] block mt-1">Target tercapai</span>
          </div>
        </div>
      )}

      {/* Priority Work Queue Table */}
      <div className="bg-[#F5FAFA] rounded-2xl border border-[#D5E0E3] shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#D5E0E3] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#E7EFF1]">
          <div>
            <h2 className="text-sm font-bold text-[#20272B] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              {isAdmin && 'Antrean Tiket Perlu Tindakan Segera (Helpdesk)'}
              {isPic && 'Daftar Tugas Prioritas Utama Saya'}
              {isPelapor && 'Tiket Aktif & Tindak Lanjut Terkini'}
            </h2>
            <p className="text-xs text-[#69777D] mt-0.5">
              Daftar tiket yang memiliki tingkat urgensi tinggi atau mendekati tenggat SLA.
            </p>
          </div>
          <button
            onClick={() =>
              onNavigate(isPelapor ? 'my-tickets' : isPic ? 'my-assignments' : 'all-tickets')
            }
            className="text-xs text-[#417F85] hover:text-[#326A70] font-bold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Lihat Semua ({total})</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          {urgentTickets.length === 0 ? (
            <div className="py-12 text-center text-[#69777D] text-xs">
              Tidak ada antrean tiket prioritas yang memerlukan tindakan segera.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#E7EFF1] border-b border-[#D5E0E3] text-[11px] font-bold text-[#69777D] uppercase tracking-wider">
                  <th className="py-3 px-4">Nomor Tiket</th>
                  <th className="py-3 px-4">Subjek Kendala</th>
                  <th className="py-3 px-4">Asal Unit</th>
                  <th className="py-3 px-4">Prioritas</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Petugas PIC</th>
                  <th className="py-3 px-4">SLA Deadline</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E0E3] text-xs text-[#20272B]">
                {urgentTickets.map((ticket) => {
                  const sla = getSlaStatus(
                    ticket.createdAt,
                    ticket.dueAt,
                    ticket.status,
                    ticket.resolvedAt
                  );
                  return (
                    <tr
                      key={ticket.id}
                      className="hover:bg-[#E7EFF1]/60 transition-colors cursor-pointer"
                      onClick={() => onNavigate('ticket-detail', ticket.id)}
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-xs text-[#35666D] bg-[#E7EFF1] border border-[#D5E0E3] px-2 py-0.5 rounded-md">
                          {formatTicketNumberDisplay(ticket.ticketNumber)}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-[#20272B] truncate">{ticket.title}</div>
                        <div className="text-[11px] text-[#69777D] truncate">
                          {ticket.categoryName} · {ticket.type}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-[#20272B] text-[11px] truncate max-w-[140px]">
                            {ticket.reporterUnitName || 'Unit Tidak Diketahui'}
                          </span>
                          <OriginUnitBadge unitType={ticket.reporterUnitType} size="sm" />
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <PriorityBadge priority={ticket.priority} size="sm" />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={ticket.status} size="sm" />
                      </td>
                      <td className="py-3 px-4">
                        {ticket.currentPicName ? (
                          <span className="font-medium text-[#20272B] flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-[#E7EFF1] text-[#35666D] text-[10px] flex items-center justify-center font-bold">
                              {ticket.currentPicName.charAt(0)}
                            </span>
                            {ticket.currentPicName}
                          </span>
                        ) : (
                          <span className="text-[#69777D] italic">Belum Ditugaskan</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono-numbers">
                        <span
                          className={`text-[11px] font-semibold ${
                            sla.isOverdue
                              ? 'text-rose-600'
                              : sla.isNearingBreach
                              ? 'text-amber-600'
                              : 'text-[#69777D]'
                          }`}
                        >
                          {sla.remainingFormatted}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('ticket-detail', ticket.id);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-[#35666D] bg-white border border-[#D5E0E3] rounded-lg hover:bg-[#E7EFF1] shadow-2xs transition-colors cursor-pointer"
                        >
                          Buka Tiket
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
