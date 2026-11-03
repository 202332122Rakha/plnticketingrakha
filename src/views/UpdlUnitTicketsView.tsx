import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Search,
  Filter,
  PlusCircle,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Shield,
  ShieldAlert,
  ArrowRight,
  Copy,
  Check,
  MapPin,
  Calendar,
  Layers,
  ChevronRight as BreadcrumbChevron,
  SlidersHorizontal,
} from 'lucide-react';
import { Ticket, User as UserType } from '../types';
import { Unit } from '../types';
import { listTicketsByUnitType } from '../services/ticketApiService';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { OriginUnitBadge } from '../utils/unitHelpers';
import { formatPicDisplayName } from '../utils/picHelpers';
import { formatTicketNumberDisplay } from '../utils/ticketHelpers';
import { canAccessUnitType } from '../utils/authPermissions';

interface UpdlUnitTicketsViewProps {
  unitId?: string;
  currentUser: UserType;
  onNavigate: (view: string, ticketIdOrUnitId?: string) => void;
  initialSearch?: string;
}

export const UpdlUnitTicketsView: React.FC<UpdlUnitTicketsViewProps> = ({
  unitId = 'ALL',
  currentUser,
  onNavigate,
  initialSearch = '',
}) => {
  const isGlobalUser = currentUser.role === 'admin' || currentUser.role === 'manajemen';
  const effectiveInitialUnit = isGlobalUser ? (unitId || 'ALL') : (currentUser.unitId || 'unit-updl-pdg');
  // Unit filter state within UPDL (defaults to 'ALL' for admin, or user's assigned unit)
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>(effectiveInitialUnit);

  // Keep internal state in sync if prop changes
  useEffect(() => {
    if (isGlobalUser) {
      if (unitId && unitId !== selectedUnitFilter) {
        setSelectedUnitFilter(unitId);
        setCurrentPage(1);
      }
    } else {
      // Non-admin is strictly locked to their approved unit
      const safeUnit = currentUser.unitId || 'unit-updl-pdg';
      if (selectedUnitFilter !== safeUnit) {
        setSelectedUnitFilter(safeUnit);
        setCurrentPage(1);
      }
    }
  }, [unitId, currentUser.unitId, isGlobalUser]);

  // Query UPDL tickets & validate authorization strictly from storageService
  const [updlResult, setUpdlResult] = useState<{
    authorized: boolean;
    notFound: boolean;
    unit: Unit | null;
    units: Unit[];
    tickets: Ticket[];
    error?: string;
  }>({ authorized: false, notFound: false, unit: null, units: [], tickets: [] });

  useEffect(() => {
    let cancelled = false;
    const refreshResult = () => listTicketsByUnitType(currentUser, 'UPDL', selectedUnitFilter)
      .then((result) => {
        if (!cancelled) setUpdlResult({ ...result, notFound: !result.authorized && Boolean(result.error) });
      })
      .catch((error) => {
        if (!cancelled) setUpdlResult({ authorized: false, notFound: false, unit: null, units: [], tickets: [], error: error instanceof Error ? error.message : 'Gagal memuat tiket UPDL.' });
      });
    const refresh = () => void refreshResult();
    refresh();
    window.addEventListener('ticket-data-changed', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('ticket-data-changed', refresh);
    };
  }, [currentUser.uid, currentUser.role, currentUser.unitId, selectedUnitFilter]);

  const { unit, units, tickets, authorized, notFound, error } = updlResult;

  // Filter States
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const itemsPerPage = 8;
  const isAdmin = currentUser.role === 'admin';
  const isPelapor = currentUser.role === 'pelapor';

  // Handle unit dropdown change and update URL hash
  const handleUnitFilterChange = (newUnit: string) => {
    setSelectedUnitFilter(newUnit);
    setCurrentPage(1);
    if (newUnit === 'ALL') {
      window.history.replaceState(null, '', '#/tickets/updl');
    } else {
      window.history.replaceState(null, '', `#/units/${newUnit}/tickets`);
    }
  };

  const handleCopyTicketNumber = (e: React.MouseEvent, ticketNumber: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(formatTicketNumberDisplay(ticketNumber));
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Base tickets filtered by dropdowns except status tab (for dynamic tab counts)
  const filterMatchedTicketsBeforeStatus = useMemo(() => {
    if (!authorized || !tickets) return [];

    return tickets.filter((t) => {
      if (selectedPriority !== 'ALL' && t.priority !== selectedPriority) return false;
      if (selectedCategory !== 'ALL' && t.categoryName !== selectedCategory) return false;
      if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNumber = t.ticketNumber.toLowerCase().includes(q);
        const matchesLegacy = t.legacyTicketNumber?.toLowerCase().includes(q) || false;
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesReporter = t.reporterName.toLowerCase().includes(q);
        const matchesDept = t.department.toLowerCase().includes(q);
        const matchesCat = t.categoryName.toLowerCase().includes(q);
        const matchesPic = t.currentPicName?.toLowerCase().includes(q) || false;
        const matchesUnit = t.reporterUnitName?.toLowerCase().includes(q) || false;

        if (
          !matchesNumber &&
          !matchesLegacy &&
          !matchesTitle &&
          !matchesReporter &&
          !matchesDept &&
          !matchesCat &&
          !matchesPic &&
          !matchesUnit
        ) {
          return false;
        }
      }

      return true;
    });
  }, [tickets, authorized, selectedPriority, selectedCategory, selectedStatus, searchQuery]);

  // Tab counts dynamically calculated from the filtered dataset
  const tabCounts = useMemo(() => {
    return {
      all: filterMatchedTicketsBeforeStatus.length,
      new_assigned: filterMatchedTicketsBeforeStatus.filter((t) =>
        ['Baru', 'Diverifikasi', 'Ditugaskan'].includes(t.status)
      ).length,
      in_progress: filterMatchedTicketsBeforeStatus.filter((t) => t.status === 'Dalam Proses').length,
      waiting: filterMatchedTicketsBeforeStatus.filter((t) =>
        ['Menunggu Pelapor', 'Menunggu Pihak Ketiga', 'Menunggu Persetujuan'].includes(t.status)
      ).length,
      resolved: filterMatchedTicketsBeforeStatus.filter((t) => t.status === 'Selesai').length,
      closed: filterMatchedTicketsBeforeStatus.filter((t) => t.status === 'Ditutup').length,
    };
  }, [filterMatchedTicketsBeforeStatus]);

  // Final filtered tickets respecting active status tab
  const filteredTickets = useMemo(() => {
    return filterMatchedTicketsBeforeStatus.filter((t) => {
      if (activeTab === 'new_assigned' && !['Baru', 'Diverifikasi', 'Ditugaskan'].includes(t.status)) return false;
      if (activeTab === 'in_progress' && t.status !== 'Dalam Proses') return false;
      if (
        activeTab === 'waiting' &&
        !['Menunggu Pelapor', 'Menunggu Pihak Ketiga', 'Menunggu Persetujuan'].includes(t.status)
      )
        return false;
      if (activeTab === 'resolved' && t.status !== 'Selesai') return false;
      if (activeTab === 'closed' && t.status !== 'Ditutup') return false;
      return true;
    });
  }, [filterMatchedTicketsBeforeStatus, activeTab]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / itemsPerPage));
  const paginatedTickets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTickets.slice(start, start + itemsPerPage);
  }, [filteredTickets, currentPage, itemsPerPage]);

  // Dynamic statistics specifically for UPDL based on dropdown filter
  const updlStats = useMemo(() => {
    const activeTickets = tickets.filter((ticket) => !['Selesai', 'Ditutup', 'Ditolak'].includes(ticket.status));
    return {
      total: tickets.length,
      baru: tickets.filter((ticket) => ticket.status === 'Baru').length,
      dalamProses: tickets.filter((ticket) => ticket.status === 'Dalam Proses').length,
      menunggu: tickets.filter((ticket) => ['Menunggu Pelapor', 'Menunggu Pihak Ketiga', 'Menunggu Persetujuan'].includes(ticket.status)).length,
      selesai: tickets.filter((ticket) => ticket.status === 'Selesai').length,
      ditutup: tickets.filter((ticket) => ticket.status === 'Ditutup').length,
      kritis: tickets.filter((ticket) => ticket.priority === 'Kritis').length,
      active: activeTickets.length,
    };
  }, [tickets]);

  // Categories list extracted from tickets for filtering
  const availableCategories = useMemo(() => {
    if (!tickets) return [];
    return Array.from(new Set(tickets.map((t) => t.categoryName))).filter(Boolean);
  }, [tickets]);

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!filteredTickets || filteredTickets.length === 0) return;

    const headers = [
      'No. Tiket',
      'Judul Kendala',
      'Asal Unit',
      'Kode Unit',
      'Kategori',
      'Prioritas',
      'Status',
      'Petugas PIC',
      'Pelapor',
      'Email Pelapor',
      'Departemen',
      'Tanggal Dibuat',
    ];

    const rows = filteredTickets.map((t) => [
      `"${t.ticketNumber}"`,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.reporterUnitName || unit?.unitName || 'PLN UPDL'}"`,
      `"${t.reporterUnitCode || unit?.unitCode || 'UPDL'}"`,
      `"${t.categoryName}"`,
      `"${t.priority}"`,
      `"${t.status}"`,
      `"${t.currentPicName || 'Belum Ditugaskan'}"`,
      `"${t.reporterName}"`,
      `"${t.reporterEmail}"`,
      `"${t.department}"`,
      `"${new Date(t.createdAt).toLocaleDateString('id-ID')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);

    const safeUnitName = unit ? unit.unitName.replace(/\s+/g, '_') : 'Semua_UPDL';
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `Tiket_${safeUnitName}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Auto-redirect if unauthorized (avoid showing Access Suspended screen)
  useEffect(() => {
    if (!authorized) {
      if (currentUser && canAccessUnitType(currentUser, 'UPDL') && currentUser.unitId) {
        setSelectedUnitFilter(currentUser.unitId);
      } else {
        onNavigate('dashboard');
      }
    }
  }, [authorized, currentUser, onNavigate]);

  // Error State: Unit Not Found (e.g. invalid query param)
  if (notFound && selectedUnitFilter !== 'ALL') {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center animate-page-enter">
        <div className="bg-white p-8 rounded-2xl border border-[#D5E0E3] shadow-xs space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-[#20272B]">
            Unit UPDL Tidak Ditemukan
          </h2>
          <p className="text-xs text-[#69777D] max-w-md mx-auto leading-relaxed">
            Unit dengan identifier <code className="bg-[#E7EFF1] px-1.5 py-0.5 rounded text-[#35666D] font-mono font-bold">{selectedUnitFilter}</code> tidak terdaftar dalam Master Data 11 UPDL resmi PT PLN (Persero).
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            {isGlobalUser && (
              <button
                onClick={() => handleUnitFilterChange('ALL')}
                className="px-4 py-2 bg-[#417F85] hover:bg-[#326A70] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs"
              >
                Tampilkan Semua Unit UPDL
              </button>
            )}
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-4 py-2 bg-white hover:bg-[#E7EFF1] text-[#35666D] border border-[#D5E0E3] rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              Kembali ke Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If not authorized, return null while redirect effect runs
  if (!authorized) {
    return null;
  }

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-[#69777D]">
        <button
          onClick={() => onNavigate('dashboard')}
          className="hover:text-[#417F85] transition-colors cursor-pointer"
        >
          Dashboard
        </button>
        <BreadcrumbChevron className="w-3.5 h-3.5 text-[#69777D]/60" />
        {selectedUnitFilter !== 'ALL' && unit ? (
          <>
            <button
              onClick={() => handleUnitFilterChange('ALL')}
              className="hover:text-[#417F85] transition-colors cursor-pointer"
            >
              Tiket Unit UPDL
            </button>
            <BreadcrumbChevron className="w-3.5 h-3.5 text-[#69777D]/60" />
            <span className="font-bold text-[#20272B]">{unit.unitName}</span>
          </>
        ) : (
          <span className="font-bold text-[#20272B]">Tiket Unit UPDL</span>
        )}
      </nav>

      {/* Header Banner */}
      <div className="bg-[#F5FAFA] p-6 rounded-2xl border border-[#D5E0E3] shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#417F85] text-white flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-[#20272B] tracking-tight">
                  {unit ? `Tiket ${unit.unitName}` : 'Tiket Unit UPDL'}
                </h1>
                <span className="text-[10px] uppercase font-mono font-extrabold px-2 py-0.5 rounded-full bg-[#E7EFF1] text-[#35666D] border border-[#D5E0E3]">
                  {unit ? `${unit.unitCode} · Wilayah ${unit.unitRegion}` : '11 UPDL Terdaftar · Seluruh Wilayah'}
                </span>
              </div>
            </div>
          </div>
          <p className="text-xs text-[#69777D] leading-relaxed pl-11.5">
            {unit?.unitFocus ||
              'Pengelolaan terpusat kendala sistem pembelajaran digital HXMS, fasilitas sarana diklat, dan operasional seluruh Unit Pelaksana Pendidikan dan Pelatihan (UPDL) PT PLN (Persero).'}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full lg:w-auto">
          {/* Ekspor CSV */}
          <button
            onClick={handleExportCSV}
            disabled={filteredTickets.length === 0}
            className="flex-1 lg:flex-none px-3.5 py-2 bg-white hover:bg-[#E7EFF1] disabled:opacity-40 disabled:cursor-not-allowed text-[#35666D] border border-[#D5E0E3] rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="Ekspor daftar tiket ke format CSV"
          >
            <Download className="w-3.5 h-3.5 text-[#417F85]" />
            <span>Ekspor CSV</span>
          </button>

          {/* Buat Tiket Baru - Preconfigured with selected UPDL if available */}
          {(isAdmin || isPelapor) && (
            <button
              onClick={() => onNavigate('create-ticket', unit?.unitId || undefined)}
              className="flex-1 lg:flex-none px-4 py-2 bg-[#417F85] hover:bg-[#326A70] active:scale-95 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>{unit ? 'Buat Tiket Unit' : 'Buat Tiket Baru'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Ringkasan Statistik Khusus UPDL (Mengikuti filter dropdown) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Tiket */}
        <div className="bg-white p-3.5 rounded-xl border border-[#D5E0E3] shadow-2xs">
          <span className="text-[10px] font-bold text-[#69777D] uppercase tracking-wider block">
            Total Tiket
          </span>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-[#20272B] font-mono-numbers">
              {updlStats.total}
            </span>
            <span className="text-[10px] text-[#69777D]">Tiket</span>
          </div>
        </div>

        {/* Tiket Baru */}
        <div className="bg-white p-3.5 rounded-xl border border-sky-200 bg-sky-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block">
            Tiket Baru
          </span>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-sky-900 font-mono-numbers">
              {updlStats.baru}
            </span>
            <span className="text-[10px] text-sky-700">Menunggu PIC</span>
          </div>
        </div>

        {/* Dalam Proses */}
        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
            Dalam Proses
          </span>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-900 font-mono-numbers">
              {updlStats.dalamProses}
            </span>
            <span className="text-[10px] text-amber-700">Dikerjakan</span>
          </div>
        </div>

        {/* Menunggu */}
        <div className="bg-white p-3.5 rounded-xl border border-purple-200 bg-purple-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
            Menunggu
          </span>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-900 font-mono-numbers">
              {updlStats.menunggu}
            </span>
            <span className="text-[10px] text-purple-700">Pending</span>
          </div>
        </div>

        {/* Selesai */}
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
            Selesai
          </span>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-900 font-mono-numbers">
              {updlStats.selesai}
            </span>
            <span className="text-[10px] text-emerald-700">Terselesaikan</span>
          </div>
        </div>

        {/* Ditutup */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-[#69777D] uppercase tracking-wider block">
            Ditutup
          </span>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-700 font-mono-numbers">
              {updlStats.ditutup}
            </span>
            <span className="text-[10px] text-[#69777D]">Arsip</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-[#D5E0E3] shadow-2xs overflow-hidden">
        {/* Filter and Search Bar */}
        <div className="p-4 border-b border-[#D5E0E3] bg-[#F5FAFA] space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#69777D] absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={unit ? `Cari tiket di ${unit.unitName}...` : 'Cari tiket unit UPDL...'}
                className="w-full text-xs pl-9 pr-8 py-2 bg-white border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-[#69777D] hover:text-[#20272B] cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Unit UPDL Selector - Hanya dropdown untuk Admin/Manajemen. Akun biasa tampil sebagai badge unit tetap */}
              {isGlobalUser ? (
                <select
                  value={selectedUnitFilter}
                  onChange={(e) => handleUnitFilterChange(e.target.value)}
                  className="text-xs py-2 px-3 bg-white border border-[#417F85]/40 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#35666D] font-bold cursor-pointer"
                  aria-label="Pilih Unit UPDL"
                >
                  <option value="ALL">Semua Unit UPDL</option>
                  {units.map((u) => (
                    <option key={u.unitId} value={u.unitId}>
                      {u.unitName}
                    </option>
                  ))}
                </select>
              ) : (
                <div
                  className="flex items-center gap-1.5 py-2 px-3 bg-[#E7EFF1] border border-[#D5E0E3] rounded-xl text-xs text-[#35666D] font-bold shadow-2xs"
                  title="Unit kerja akun Anda"
                >
                  <Building2 className="w-3.5 h-3.5 text-[#417F85]" />
                  <span>{unit?.unitName || currentUser.unitName || 'PLN UPDL'}</span>
                </div>
              )}

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs py-2 px-3 bg-white border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] font-medium cursor-pointer"
              >
                <option value="ALL">Semua Kategori</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Priority Filter */}
              <select
                value={selectedPriority}
                onChange={(e) => {
                  setSelectedPriority(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs py-2 px-3 bg-white border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] font-medium cursor-pointer"
              >
                <option value="ALL">Semua Prioritas</option>
                <option value="Kritis">Kritis</option>
                <option value="Tinggi">Tinggi</option>
                <option value="Sedang">Sedang</option>
                <option value="Rendah">Rendah</option>
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs py-2 px-3 bg-white border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] font-medium cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="Baru">Baru</option>
                <option value="Ditugaskan">Ditugaskan</option>
                <option value="Dalam Proses">Dalam Proses</option>
                <option value="Menunggu Pelapor">Menunggu Pelapor</option>
                <option value="Menunggu Pihak Ketiga">Menunggu Pihak Ketiga</option>
                <option value="Selesai">Selesai</option>
                <option value="Ditutup">Ditutup</option>
              </select>

              {/* Reset Filter Button */}
              {(searchQuery || selectedCategory !== 'ALL' || selectedPriority !== 'ALL' || selectedStatus !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('ALL');
                    setSelectedPriority('ALL');
                    setSelectedStatus('ALL');
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-xl font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          </div>

          {/* Status Tabs with Dynamic Counts */}
          <div className="flex items-center gap-1 overflow-x-auto pt-1 border-t border-[#D5E0E3]">
            {[
              { id: 'all', label: 'Semua Tiket', count: tabCounts.all },
              { id: 'new_assigned', label: 'Baru & Ditugaskan', count: tabCounts.new_assigned },
              { id: 'in_progress', label: 'Dalam Proses', count: tabCounts.in_progress },
              { id: 'waiting', label: 'Menunggu', count: tabCounts.waiting },
              { id: 'resolved', label: 'Selesai', count: tabCounts.resolved },
              { id: 'closed', label: 'Ditutup', count: tabCounts.closed },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-[#417F85] text-white shadow-2xs'
                      : 'text-[#69777D] hover:bg-[#E7EFF1] hover:text-[#20272B]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[#E7EFF1] text-[#35666D]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#E7EFF1] border-b border-[#D5E0E3] text-[#35666D] font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">No. Tiket</th>
                <th className="py-3 px-4">Judul Kendala</th>
                <th className="py-3 px-4">Asal Unit</th>
                <th className="py-3 px-4 text-center">Prioritas</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Petugas PIC</th>
                <th className="py-3 px-4">Pelapor & Departemen</th>
                <th className="py-3 px-4">Tanggal Dibuat</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5E0E3]">
              {paginatedTickets.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#69777D]">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Building2 className="w-8 h-8 text-[#69777D]/60 mx-auto" />
                      <p className="font-bold text-[#20272B]">Tidak Ada Tiket Ditemukan</p>
                      <p className="text-[11px] text-[#69777D]">
                        {searchQuery || selectedCategory !== 'ALL' || selectedPriority !== 'ALL' || selectedStatus !== 'ALL'
                          ? 'Tidak ada tiket yang cocok dengan filter pencarian.'
                          : unit
                          ? `Belum ada tiket yang diterbitkan dari unit ${unit.unitName}.`
                          : 'Belum ada tiket yang diterbitkan dari seluruh Unit UPDL.'}
                      </p>
                      {(isAdmin || isPelapor) && (
                        <button
                          onClick={() => onNavigate('create-ticket', unit?.unitId || undefined)}
                          className="mt-2 px-3 py-1.5 bg-[#417F85] text-white rounded-lg text-xs font-bold hover:bg-[#326A70] cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Terbitkan Tiket Pertama</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTickets.map((t) => {
                  return (
                    <tr
                      key={t.id}
                      onClick={() => onNavigate('ticket-detail', t.id)}
                      className="hover:bg-[#E7EFF1]/50 transition-colors cursor-pointer"
                    >
                      {/* Nomor Tiket */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-[#35666D]">
                          <span>{t.ticketNumber}</span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyTicketNumber(e, t.ticketNumber, t.id)}
                            className="p-1 rounded text-[#69777D] hover:text-[#417F85] hover:bg-[#E7EFF1] cursor-pointer transition-colors"
                            title="Salin nomor tiket"
                          >
                            {copiedId === t.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <div className="text-[10px] text-[#69777D]">{t.categoryName}</div>
                      </td>

                      {/* Judul Kendala */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-bold text-[#20272B] line-clamp-1">{t.title}</div>
                        <div className="text-[11px] text-[#69777D] line-clamp-1">{t.description}</div>
                      </td>

                      {/* Asal Unit */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <OriginUnitBadge unitType="UPDL" />
                          <span className="font-semibold text-[#20272B]">
                            {t.reporterUnitName || unit?.unitName || 'PLN UPDL'}
                          </span>
                        </div>
                      </td>

                      {/* Prioritas */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <PriorityBadge priority={t.priority} />
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <StatusBadge status={t.status} />
                      </td>

                      {/* PIC */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {t.currentPicName ? (
                          <div>
                            <div className="font-medium text-[#20272B]">{formatPicDisplayName(t.currentPicName)}</div>
                            <div className="text-[10px] text-[#69777D]">{t.currentPicTeam || 'IT Helpdesk'}</div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#69777D] italic">Belum Ditugaskan</span>
                        )}
                      </td>

                      {/* Pelapor & Departemen */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#20272B]">{t.reporterName}</div>
                        <div className="text-[10px] text-[#69777D] truncate max-w-[150px]">{t.department}</div>
                      </td>

                      {/* Tanggal Dibuat */}
                      <td className="py-3 px-4 whitespace-nowrap text-[#69777D]">
                        <div>
                          {new Date(t.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[10px]">
                          {new Date(t.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          WIB
                        </div>
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('ticket-detail', t.id);
                          }}
                          className="px-2.5 py-1.5 bg-white hover:bg-[#E7EFF1] text-[#35666D] border border-[#D5E0E3] rounded-lg font-bold text-xs shadow-2xs inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detail</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 bg-[#F5FAFA] border-t border-[#D5E0E3] flex items-center justify-between text-xs text-[#69777D]">
            <span>
              Menampilkan {(currentPage - 1) * itemsPerPage + 1} -{' '}
              {Math.min(currentPage * itemsPerPage, filteredTickets.length)} dari{' '}
              {filteredTickets.length} tiket ({unit ? unit.unitName : 'Semua Unit UPDL'})
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-[#D5E0E3] bg-white hover:bg-[#E7EFF1] text-[#35666D] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-bold text-[#35666D]">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-[#D5E0E3] bg-white hover:bg-[#E7EFF1] text-[#35666D] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
