import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  PlusCircle,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
  SlidersHorizontal,
  Clock,
  UserCheck,
  Tag,
  Calendar,
  Copy,
  Check,
  Building2,
  AlertCircle,
  HelpCircle,
  X,
} from 'lucide-react';
import { Ticket, User as UserType, TicketStatus, PriorityLevel, UnitType } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { getSlaStatus } from '../utils/slaCalculator';
import { formatPicDisplayName } from '../utils/picHelpers';
import { formatTicketNumberDisplay } from '../utils/ticketHelpers';
import {
  ALL_REGISTERED_UNITS,
  UPDL_UNITS,
  CORPU_UNIT,
  NON_UPDL_UNITS,
} from '../data/unitsData';
import { OriginUnitBadge } from '../utils/unitHelpers';
import { storageService } from '../services/storageService';
import { getScopedTickets } from '../utils/authPermissions';

interface TicketListViewProps {
  mode: 'all' | 'my-tickets' | 'my-assignments';
  tickets: Ticket[];
  currentUser: UserType;
  onNavigate: (view: string, ticketId?: string) => void;
  initialSearch?: string;
}

export const TicketListView: React.FC<TicketListViewProps> = ({
  mode,
  tickets,
  currentUser,
  onNavigate,
  initialSearch = '',
}) => {
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPic, setSelectedPic] = useState<string>('ALL');
  const [selectedAsalUnit, setSelectedAsalUnit] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Admin Classification Modal State (Requirement 6 & 9)
  const [ticketToClassify, setTicketToClassify] = useState<Ticket | null>(null);
  const [targetClassifyUnitId, setTargetClassifyUnitId] = useState<string>('unit-updl-jkt');
  const [classifyFeedback, setClassifyFeedback] = useState<string | null>(null);

  const itemsPerPage = 8;
  const isAdmin = currentUser.role === 'admin';
  const isManajemen = currentUser.role === 'manajemen';
  const isPelapor = currentUser.role === 'pelapor';
  const isGlobalUser = isAdmin || isManajemen;
  const hideUnitFilters = !isGlobalUser;

  const handleCopyTicketNumber = (e: React.MouseEvent, ticketNumber: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(formatTicketNumberDisplay(ticketNumber));
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Filter based on page mode with strict Role-Based Access Control (Requirement 9)
  const baseTickets = useMemo(() => {
    const scopedTickets = getScopedTickets(currentUser, tickets);
    // Admin can see everything, or filter by specific mode
    if (mode === 'my-tickets') {
      return scopedTickets.filter((t) => t.reporterId === currentUser.uid);
    }
    if (mode === 'my-assignments') {
      return scopedTickets.filter((t) => t.currentPicId === currentUser.uid);
    }
    return scopedTickets;
  }, [tickets, mode, currentUser]);

  // Contextual units list based on Asal Unit selection (Requirement 5)
  const contextualUnits = useMemo(() => {
    if (selectedAsalUnit === 'UPDL') {
      return UPDL_UNITS;
    }
    if (selectedAsalUnit === 'CORPU') {
      return [CORPU_UNIT];
    }
    if (selectedAsalUnit === 'NON_UPDL') {
      return NON_UPDL_UNITS;
    }
    return ALL_REGISTERED_UNITS;
  }, [selectedAsalUnit]);

  // Handle Asal Unit Change & Reset Unit Filter if incompatible (Requirement 5)
  const handleAsalUnitChange = (newAsal: string) => {
    setSelectedAsalUnit(newAsal);
    setCurrentPage(1);

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

  // Base tickets filtered by active dropdown filters EXCEPT status/tab
  // This ensures tab counts dynamically adapt to active filters (Requirement 5)
  const filterMatchedTicketsBeforeStatus = useMemo(() => {
    return baseTickets.filter((t) => {
      // Priority
      if (selectedPriority !== 'ALL' && t.priority !== selectedPriority) return false;
      // Category
      if (selectedCategory !== 'ALL' && t.categoryName !== selectedCategory) return false;
      // PIC
      if (selectedPic !== 'ALL' && t.currentPicId !== selectedPic) return false;

      // Asal Unit & Unit Filter (Requirement 1 & 4, bypassed on Pelapor Tiket Saya)
      if (!hideUnitFilters) {
        if (selectedAsalUnit !== 'ALL') {
          if (selectedAsalUnit === 'UPDL' && t.reporterUnitType !== 'UPDL') return false;
          if (selectedAsalUnit === 'CORPU' && t.reporterUnitType !== 'CORPU') return false;
          if (selectedAsalUnit === 'NON_UPDL' && t.reporterUnitType !== 'NON_UPDL') return false;
          if (selectedAsalUnit === 'UNCLASSIFIED' && t.reporterUnitType !== 'UNCLASSIFIED') return false;
        }

        // Unit Filter (Requirement 5)
        if (selectedUnit !== 'ALL') {
          const targetUnit = ALL_REGISTERED_UNITS.find(
            (u) => u.unitId === selectedUnit || u.unitCode === selectedUnit
          );
          const uCode = targetUnit?.unitCode.toLowerCase() || '';
          const uName = targetUnit?.unitName.toLowerCase() || '';

          const matchesUnit =
            t.reporterUnitId === selectedUnit ||
            (t.reporterUnitCode && uCode && t.reporterUnitCode.toLowerCase() === uCode) ||
            (t.reporterUnitName && uName && t.reporterUnitName.toLowerCase().includes(uName));

          if (!matchesUnit) return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNumber = t.ticketNumber.toLowerCase().includes(q);
        const matchesLegacy = t.legacyTicketNumber?.toLowerCase().includes(q) || false;
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesReporter = t.reporterName.toLowerCase().includes(q);
        const matchesDept = t.department.toLowerCase().includes(q);
        const matchesCat = t.categoryName.toLowerCase().includes(q);
        const matchesCatCode = t.categoryCode?.toLowerCase().includes(q) || false;
        const matchesPic = t.currentPicName?.toLowerCase().includes(q) || false;
        const matchesUnitName = t.reporterUnitName?.toLowerCase().includes(q) || false;
        if (
          !matchesNumber &&
          !matchesLegacy &&
          !matchesTitle &&
          !matchesReporter &&
          !matchesDept &&
          !matchesCat &&
          !matchesCatCode &&
          !matchesPic &&
          !matchesUnitName
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    baseTickets,
    selectedPriority,
    selectedCategory,
    selectedPic,
    selectedAsalUnit,
    selectedUnit,
    searchQuery,
  ]);

  // Tab counts dynamically calculated from the filtered dataset (Requirement 5)
  const tabCounts = useMemo(() => {
    return {
      all: filterMatchedTicketsBeforeStatus.length,
      new: filterMatchedTicketsBeforeStatus.filter((t) => t.status === 'Baru').length,
      new_assigned: filterMatchedTicketsBeforeStatus.filter((t) =>
        ['Ditugaskan', 'Baru'].includes(t.status)
      ).length,
      open: filterMatchedTicketsBeforeStatus.filter((t) =>
        ['Diverifikasi', 'Ditugaskan'].includes(t.status)
      ).length,
      in_progress: filterMatchedTicketsBeforeStatus.filter((t) => t.status === 'Dalam Proses').length,
      waiting_reporter: filterMatchedTicketsBeforeStatus.filter((t) => t.status === 'Menunggu Pelapor').length,
      waiting_third_party: filterMatchedTicketsBeforeStatus.filter((t) => t.status === 'Menunggu Pihak Ketiga').length,
      on_hold: filterMatchedTicketsBeforeStatus.filter((t) =>
        ['Menunggu Pelapor', 'Menunggu Pihak Ketiga', 'Menunggu Persetujuan'].includes(t.status)
      ).length,
      resolved: filterMatchedTicketsBeforeStatus.filter((t) => ['Selesai', 'Ditutup'].includes(t.status)).length,
      closed: filterMatchedTicketsBeforeStatus.filter((t) => t.status === 'Ditutup').length,
    };
  }, [filterMatchedTicketsBeforeStatus]);

  // Final Filter logic with active Tab & selectedStatus
  const filteredTickets = useMemo(() => {
    return filterMatchedTicketsBeforeStatus.filter((t) => {
      // Tab filter
      if (activeTab === 'new' && t.status !== 'Baru') return false;
      if (activeTab === 'new_assigned' && !['Ditugaskan', 'Baru'].includes(t.status)) return false;
      if (activeTab === 'open' && !['Diverifikasi', 'Ditugaskan'].includes(t.status)) return false;
      if (activeTab === 'in_progress' && t.status !== 'Dalam Proses') return false;
      if (activeTab === 'waiting_reporter' && t.status !== 'Menunggu Pelapor') return false;
      if (activeTab === 'waiting_third_party' && t.status !== 'Menunggu Pihak Ketiga') return false;
      if (
        activeTab === 'on_hold' &&
        !['Menunggu Pelapor', 'Menunggu Pihak Ketiga', 'Menunggu Persetujuan'].includes(t.status)
      )
        return false;
      if (activeTab === 'resolved' && !['Selesai', 'Ditutup'].includes(t.status)) return false;
      if (activeTab === 'closed' && t.status !== 'Ditutup') return false;

      // Status dropdown filter
      if (selectedStatus !== 'ALL' && t.status !== selectedStatus) return false;

      return true;
    });
  }, [filterMatchedTicketsBeforeStatus, activeTab, selectedStatus]);

  // Reset filters
  const handleResetFilters = () => {
    setActiveTab('all');
    setSelectedPriority('ALL');
    setSelectedCategory('ALL');
    setSelectedStatus('ALL');
    setSelectedPic('ALL');
    setSelectedAsalUnit('ALL');
    setSelectedUnit('ALL');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / itemsPerPage));
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Categories & PICs for dropdown
  const categoryNames = Array.from(new Set(tickets.map((t) => t.categoryName)));

  // Admin Manual Classification of Legacy / Unclassified Ticket (Requirement 6)
  const handleOpenClassifyModal = (ticket: Ticket) => {
    setTicketToClassify(ticket);
    setTargetClassifyUnitId(ticket.reporterUnitId || 'unit-updl-jkt');
    setClassifyFeedback(null);
  };

  const handleConfirmClassify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketToClassify) return;

    try {
      await storageService.classifyTicketUnit(ticketToClassify.id, targetClassifyUnitId, currentUser);
      setClassifyFeedback('Asal unit berhasil diklasifikasikan dan riwayat audit diperbarui.');
      setTimeout(() => {
        setTicketToClassify(null);
        setClassifyFeedback(null);
      }, 1000);
    } catch (err: any) {
      alert(err.message || 'Gagal mengklasifikasikan unit.');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Nomor Tiket',
      'Judul',
      'Jenis',
      'Kode Kategori',
      'Kategori',
      'Pelapor',
      'Asal Unit',
      'Jenis Asal Unit (UPDL/Corpu/Non-UPDL)',
      'Departemen',
      'Prioritas',
      'Status',
      'PIC',
      'Tanggal Dibuat',
      'Target SLA',
    ];
    const rows = filteredTickets.map((t) => [
      t.ticketNumber,
      `"${t.title.replace(/"/g, '""')}"`,
      t.type,
      t.categoryCode || '',
      t.categoryName,
      t.reporterName,
      t.reporterUnitName || 'Belum Terklasifikasi',
      t.reporterUnitType || 'UNCLASSIFIED',
      t.department,
      t.priority,
      t.status,
      t.currentPicName || 'Belum Ditugaskan',
      new Date(t.createdAt).toLocaleDateString('id-ID'),
      new Date(t.dueAt).toLocaleDateString('id-ID'),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Tiket_PLN_CorpU_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pageTitle = {
    all: 'Daftar Semua Tiket',
    'my-tickets': 'Tiket Pelaporan Saya',
    'my-assignments': 'Tiket Penugasan Saya (PIC)',
  }[mode];

  const pageSubtitle = {
    all: 'Kelola seluruh tiket layanan dan filter berdasarkan Asal Unit (11 UPDL, PLN Corpu, dan Unit Umum/Non-UPDL).',
    'my-tickets': 'Pantau status dan tindak lanjut laporan yang telah Anda ajukan ke Helpdesk CorpU.',
    'my-assignments': 'Daftar tiket yang ditugaskan kepada Anda untuk ditangani dan diselesaikan.',
  }[mode];

  return (
    <div className="space-y-4">
      {/* Page Title & Top CTA Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#F5FAFA] p-5 rounded-xl border border-[#D5E0E3] shadow-2xs">
        <div>
          <h1 className="text-xl font-extrabold text-[#20272B] tracking-tight">{pageTitle}</h1>
          <p className="text-xs text-[#69777D] mt-1">{pageSubtitle}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-semibold text-[#20272B] bg-[#FFFFFF] border border-[#D5E0E3] rounded-lg hover:bg-[#E7EFF1] flex items-center gap-2 shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#69777D]" />
            <span>Ekspor CSV</span>
          </button>
          <button
            onClick={() => onNavigate('create-ticket')}
            className="px-4 py-2 text-xs font-bold text-white bg-[#417F85] hover:bg-[#326A70] rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer btn-press"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Buat Tiket Baru</span>
          </button>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="bg-[#F5FAFA] rounded-xl border border-[#D5E0E3] shadow-2xs overflow-hidden">
        <div className="flex items-center border-b border-[#D5E0E3] overflow-x-auto px-4 gap-1 py-1 bg-[#E7EFF1]/60">
          {(mode === 'my-assignments'
            ? [
                { id: 'all', label: 'Semua Penugasan Saya', count: tabCounts.all },
                { id: 'new_assigned', label: 'Penugasan Baru', count: tabCounts.new_assigned },
                { id: 'in_progress', label: 'Dalam Proses', count: tabCounts.in_progress },
                { id: 'waiting_reporter', label: 'Menunggu Pelapor', count: tabCounts.waiting_reporter },
                { id: 'waiting_third_party', label: 'Menunggu Pihak Ketiga', count: tabCounts.waiting_third_party },
                { id: 'resolved', label: 'Selesai', count: tabCounts.resolved },
              ]
            : [
                { id: 'all', label: 'Semua Tiket', count: tabCounts.all },
                { id: 'new', label: 'Baru', count: tabCounts.new },
                { id: 'open', label: 'Terbuka', count: tabCounts.open },
                { id: 'in_progress', label: 'Dalam Proses', count: tabCounts.in_progress },
                { id: 'on_hold', label: 'Menunggu', count: tabCounts.on_hold },
                { id: 'resolved', label: 'Selesai', count: tabCounts.resolved },
                { id: 'closed', label: 'Ditutup', count: tabCounts.closed },
              ]
          ).map((tab) => {
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-2 py-2 px-3 text-xs font-semibold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                  isTabActive
                    ? 'border-[#417F85] text-[#35666D] bg-[#F5FAFA] rounded-t-lg font-bold'
                    : 'border-transparent text-[#69777D] hover:text-[#20272B] hover:bg-[#E7EFF1] rounded-lg'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full font-mono-numbers ${
                    isTabActive ? 'bg-[#417F85] text-white' : 'bg-[#D5E0E3] text-[#20272B]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filter Toolbar (Requirement 1: Urutan Prioritas, Kategori, Status, Asal Unit, Unit, Pencarian tiket) */}
        <div className="p-4 border-b border-[#D5E0E3] flex flex-wrap items-center justify-between gap-3 bg-[#F5FAFA]">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* 1. Priority Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#69777D] font-medium hidden sm:inline">Prioritas:</span>
              <select
                value={selectedPriority}
                onChange={(e) => {
                  setSelectedPriority(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs bg-[#FFFFFF] border border-[#D5E0E3] rounded-lg px-2.5 py-1.5 text-[#20272B] focus:outline-hidden focus:ring-2 focus:ring-[#417F85] font-medium cursor-pointer shadow-2xs"
              >
                <option value="ALL">Semua Prioritas</option>
                <option value="Kritis">Kritis</option>
                <option value="Tinggi">Tinggi</option>
                <option value="Sedang">Sedang</option>
                <option value="Rendah">Rendah</option>
              </select>
            </div>

            {/* 2. Category Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#69777D] font-medium hidden sm:inline">Kategori:</span>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs bg-[#FFFFFF] border border-[#D5E0E3] rounded-lg px-2.5 py-1.5 text-[#20272B] focus:outline-hidden focus:ring-2 focus:ring-[#417F85] font-medium max-w-[160px] truncate cursor-pointer shadow-2xs"
              >
                <option value="ALL">Semua Kategori</option>
                {categoryNames.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#69777D] font-medium hidden sm:inline">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-xs bg-[#FFFFFF] border border-[#D5E0E3] rounded-lg px-2.5 py-1.5 text-[#20272B] focus:outline-hidden focus:ring-2 focus:ring-[#417F85] font-medium cursor-pointer shadow-2xs"
              >
                <option value="ALL">Semua Status</option>
                <option value="Baru">Baru</option>
                <option value="Diverifikasi">Diverifikasi</option>
                <option value="Ditugaskan">Ditugaskan</option>
                <option value="Dalam Proses">Dalam Proses</option>
                <option value="Menunggu Pelapor">Menunggu Pelapor</option>
                <option value="Menunggu Pihak Ketiga">Menunggu Pihak Ketiga</option>
                <option value="Menunggu Persetujuan">Menunggu Persetujuan</option>
                <option value="Selesai">Selesai</option>
                <option value="Ditutup">Ditutup</option>
                <option value="Ditolak">Ditolak</option>
              </select>
            </div>

            {/* 4. Asal Unit Filter & 5. Unit Filter (Hanya untuk Admin/Manajemen, non-admin tampil badge unit) */}
            {!hideUnitFilters ? (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#20272B] font-bold hidden sm:inline flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-[#417F85]" />
                    Asal Unit:
                  </span>
                  <select
                    value={selectedAsalUnit}
                    onChange={(e) => handleAsalUnitChange(e.target.value)}
                    className="text-xs bg-[#E7EFF1] border border-[#D5E0E3] hover:border-[#417F85] rounded-lg px-2.5 py-1.5 text-[#35666D] focus:outline-hidden focus:ring-2 focus:ring-[#417F85] font-bold shadow-2xs cursor-pointer"
                  >
                    <option value="ALL">Semua Asal Unit</option>
                    <option value="UPDL">UPDL (11 Unit)</option>
                    <option value="CORPU">PLN Corpu</option>
                    <option value="NON_UPDL">Unit Umum / Non-UPDL</option>
                    {isAdmin && <option value="UNCLASSIFIED">Belum Terklasifikasi</option>}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#69777D] font-medium hidden sm:inline">Unit:</span>
                  <select
                    value={selectedUnit}
                    onChange={(e) => {
                      setSelectedUnit(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="text-xs bg-[#FFFFFF] border border-[#D5E0E3] rounded-lg px-2.5 py-1.5 text-[#20272B] focus:outline-hidden focus:ring-2 focus:ring-[#417F85] font-medium max-w-[210px] truncate cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">
                      {selectedAsalUnit === 'UPDL'
                        ? 'Semua 11 Unit UPDL'
                        : selectedAsalUnit === 'CORPU'
                        ? 'PLN Corporate University'
                        : selectedAsalUnit === 'NON_UPDL'
                        ? 'Semua Unit Umum / Non-UPDL'
                        : 'Semua Unit (11 UPDL, Corpu & Non-UPDL)'}
                    </option>

                    {/* Show UPDL Jawa if Asal Unit is ALL or UPDL */}
                    {(selectedAsalUnit === 'ALL' || selectedAsalUnit === 'UPDL') && (
                      <optgroup label="Wilayah Pulau Jawa (6 UPDL)">
                        {UPDL_UNITS.filter((u) => u.unitRegion === 'Jawa').map((u) => (
                          <option key={u.unitId} value={u.unitId}>
                            {u.unitName}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {/* Show UPDL Luar Jawa if Asal Unit is ALL or UPDL */}
                    {(selectedAsalUnit === 'ALL' || selectedAsalUnit === 'UPDL') && (
                      <optgroup label="Wilayah Luar Jawa (5 UPDL)">
                        {UPDL_UNITS.filter((u) => u.unitRegion === 'Luar Jawa').map((u) => (
                          <option key={u.unitId} value={u.unitId}>
                            {u.unitName}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {/* Show PLN Corpu if Asal Unit is ALL or CORPU */}
                    {(selectedAsalUnit === 'ALL' || selectedAsalUnit === 'CORPU') && (
                      <optgroup label="Unit Korporat (Bukan UPDL)">
                        <option value={CORPU_UNIT.unitId}>{CORPU_UNIT.unitName}</option>
                      </optgroup>
                    )}

                    {/* Show Non-UPDL if Asal Unit is ALL or NON_UPDL */}
                    {(selectedAsalUnit === 'ALL' || selectedAsalUnit === 'NON_UPDL') && (
                      <optgroup label="Unit Umum / Non-UPDL Terdaftar">
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
              <div className="flex items-center gap-1.5 py-1.5 px-3 bg-[#E7EFF1] border border-[#D5E0E3] rounded-lg text-xs text-[#35666D] font-bold">
                <Building2 className="w-3.5 h-3.5 text-[#417F85]" />
                <span>{currentUser.unitName || 'Unit Terdaftar'}</span>
              </div>
            )}

            {/* Reset Button */}
            {(selectedPriority !== 'ALL' ||
              selectedCategory !== 'ALL' ||
              selectedStatus !== 'ALL' ||
              selectedPic !== 'ALL' ||
              (!hideUnitFilters && (selectedAsalUnit !== 'ALL' || selectedUnit !== 'ALL')) ||
              searchQuery) && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                title="Kembalikan semua filter ke kondisi awal"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>

          {/* 6. Search Box */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari tiket, nomor, pelapor, unit..."
              className="w-full pl-8 pr-4 py-1.5 text-xs bg-[#FFFFFF] border border-[#D5E0E3] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D] transition-all shadow-2xs"
            />
            <Search className="w-3.5 h-3.5 text-[#69777D] absolute left-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Data Table with Prominent ASAL UNIT Column (Requirement 7) */}
        <div className="overflow-x-auto">
          {filteredTickets.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-[#E7EFF1] flex items-center justify-center mx-auto text-[#69777D] mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#20272B]">Tidak ada tiket ditemukan</h3>
              <p className="text-xs text-[#69777D] max-w-sm mx-auto mt-1">
                {hideUnitFilters
                  ? 'Kriteria filter Prioritas, Kategori, Status, atau pencarian Anda tidak cocok dengan tiket yang tersedia.'
                  : 'Kriteria filter Asal Unit, Unit, Prioritas, atau pencarian Anda tidak cocok dengan tiket yang tersedia.'}
              </p>
              <button
                onClick={handleResetFilters}
                className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-[#35666D] bg-[#E7EFF1] border border-[#D5E0E3] rounded-lg hover:bg-[#D5E0E3] transition-all cursor-pointer btn-press"
              >
                Reset Semua Filter
              </button>
            </div>
          ) : (
            <>
              {/* Mobile Card List View (Visible on screens smaller than md) */}
              <div className="md:hidden divide-y divide-[#D5E0E3]">
                {paginatedTickets.map((ticket) => {
                  const sla = getSlaStatus(
                    ticket.createdAt,
                    ticket.dueAt,
                    ticket.status,
                    ticket.resolvedAt
                  );
                  return (
                    <div
                      key={ticket.id}
                      onClick={() => onNavigate('ticket-detail', ticket.id)}
                      className="p-3.5 hover:bg-[#E7EFF1]/70 active:bg-[#E7EFF1] transition-colors cursor-pointer space-y-2.5 bg-[#FFFFFF]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs text-[#35666D] bg-[#E7EFF1] px-2 py-0.5 rounded border border-[#D5E0E3]">
                            {formatTicketNumberDisplay(ticket.ticketNumber)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyTicketNumber(e, ticket.ticketNumber, ticket.id)}
                            className="p-1 rounded text-[#417F85] hover:bg-[#D5E0E3]/50 transition-colors"
                            title="Salin nomor tiket"
                          >
                            {copiedId === ticket.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        <StatusBadge status={ticket.status} size="sm" />
                      </div>

                      <div>
                        <h4 className="font-semibold text-xs text-[#20272B] line-clamp-2 leading-snug">
                          {ticket.title}
                        </h4>
                        <div className="text-[11px] text-[#69777D] mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-[#417F85]">{ticket.categoryName}</span>
                          <span>·</span>
                          <span>{ticket.type}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-[#D5E0E3]/60 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <OriginUnitBadge unitType={ticket.reporterUnitType} size="sm" />
                          <span className="text-[#69777D] truncate max-w-[140px]" title={ticket.reporterUnitName || ticket.reporterName}>
                            {ticket.reporterUnitName || ticket.reporterName}
                          </span>
                        </div>
                        <PriorityBadge priority={ticket.priority} size="sm" />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-[#69777D] pt-0.5">
                        <span
                          className={`flex items-center gap-1 font-mono-numbers font-semibold ${
                            sla.isOverdue
                              ? 'text-rose-600'
                              : sla.isNearingBreach
                              ? 'text-amber-600'
                              : 'text-[#69777D]'
                          }`}
                        >
                          <Clock className="w-3 h-3 shrink-0" />
                          SLA: {sla.remainingFormatted}
                        </span>
                        <span className="font-mono-numbers">
                          {new Date(ticket.createdAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop / Tablet Table View (Visible on md and up) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[950px]">
                  <thead>
                <tr className="bg-[#E7EFF1] border-b border-[#D5E0E3] text-[11px] font-bold text-[#69777D] uppercase tracking-wider">
                  <th className="py-3 px-4">Nomor Tiket</th>
                  <th className="py-3 px-4">Subjek Kendala</th>
                  <th className="py-3 px-4">Asal Unit</th>
                  <th className="py-3 px-4">Prioritas</th>
                  <th className="py-3 px-4">Petugas PIC</th>
                  <th className="py-3 px-4">Pelapor & Dept</th>
                  <th className="py-3 px-4">Tanggal Dibuat</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Target SLA</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E0E3] text-xs text-[#20272B]">
                {paginatedTickets.map((ticket) => {
                  const sla = getSlaStatus(
                    ticket.createdAt,
                    ticket.dueAt,
                    ticket.status,
                    ticket.resolvedAt
                  );
                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => onNavigate('ticket-detail', ticket.id)}
                      className="hover:bg-[#E7EFF1]/60 transition-colors cursor-pointer group"
                    >
                      {/* Ticket Number */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-flex items-center gap-1.5 bg-[#E7EFF1] text-[#35666D] border border-[#D5E0E3] hover:border-[#417F85] px-2.5 py-1 rounded-lg font-mono font-bold text-xs shadow-2xs transition-colors"
                            title="Nomor Tiket Resmi: #XXXX-MM-YYYY-NNN"
                          >
                            <span>{formatTicketNumberDisplay(ticket.ticketNumber)}</span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyTicketNumber(e, ticket.ticketNumber, ticket.id)}
                              className="p-0.5 rounded text-[#417F85] hover:text-[#326A70] hover:bg-[#D5E0E3]/50 transition-colors cursor-pointer"
                              title="Salin nomor tiket"
                            >
                              {copiedId === ticket.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </span>
                        </div>
                      </td>

                      {/* Subject & Category */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-[#20272B] group-hover:text-[#35666D] transition-colors truncate">
                          {ticket.title}
                        </div>
                        <div className="text-[11px] text-[#69777D] truncate flex items-center gap-1.5 mt-0.5">
                          <span className="truncate">{ticket.categoryName}</span>
                          <span>·</span>
                          <span className="text-[#69777D] font-medium shrink-0">{ticket.type}</span>
                        </div>
                      </td>

                      {/* Asal Unit Column (Requirement 7: Nama Unit & Badge UPDL / PLN Corpu / Non-UPDL) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className="font-semibold text-[#20272B] text-xs truncate max-w-[170px]"
                            title={ticket.reporterUnitName || 'Unit Tidak Diketahui'}
                          >
                            {ticket.reporterUnitName || 'Unit Tidak Diketahui'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <OriginUnitBadge unitType={ticket.reporterUnitType} size="sm" />
                            {ticket.reporterUnitType === 'UNCLASSIFIED' && isAdmin && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenClassifyModal(ticket);
                                }}
                                className="text-[10px] text-[#417F85] hover:text-[#326A70] font-bold underline cursor-pointer"
                                title="Admin: Klasifikasikan asal unit tiket ini"
                              >
                                (Klasifikasikan)
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Priority Badge */}
                      <td className="py-3.5 px-4">
                        <PriorityBadge priority={ticket.priority} size="sm" />
                      </td>

                      {/* Assignee / PIC */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {ticket.currentPicName ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-[#E7EFF1] text-[#35666D] text-[10px] font-bold flex items-center justify-center shrink-0 border border-[#D5E0E3]">
                              {ticket.currentPicName.charAt(0)}
                            </div>
                            <span className="font-semibold text-[#20272B] truncate max-w-[150px]">
                              {formatPicDisplayName(ticket.currentPicId, ticket.currentPicName)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#69777D] italic text-[11px]">- Belum Ada -</span>
                        )}
                      </td>

                      {/* Reporter & Department */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[#20272B] truncate max-w-[140px]">
                          {ticket.reporterName}
                        </div>
                        <div className="text-[11px] text-[#69777D] truncate max-w-[140px]">
                          {ticket.department}
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="py-3.5 px-4 font-mono-numbers text-[#69777D] whitespace-nowrap text-[11px]">
                        {new Date(ticket.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={ticket.status} size="sm" />
                      </td>

                      {/* SLA Target */}
                      <td className="py-3.5 px-4 font-mono-numbers whitespace-nowrap">
                        <span
                          className={`text-[11px] font-semibold flex items-center gap-1 ${
                            sla.isOverdue
                              ? 'text-rose-600'
                              : sla.isNearingBreach
                              ? 'text-amber-600'
                              : 'text-[#69777D]'
                          }`}
                        >
                          <Clock className="w-3 h-3 shrink-0" />
                          {sla.remainingFormatted}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('ticket-detail', ticket.id);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold text-[#20272B] bg-[#FFFFFF] border border-[#D5E0E3] rounded-md hover:bg-[#E7EFF1] hover:text-[#35666D] shadow-2xs transition-colors cursor-pointer"
                        >
                          {isPelapor ? 'Detail' : 'Kelola'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
              </div>
            </>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-[#D5E0E3] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#E7EFF1]/50">
          <div className="text-xs text-[#69777D] font-mono-numbers">
            Menampilkan <span className="font-bold text-[#20272B]">{paginatedTickets.length}</span> dari{' '}
            <span className="font-bold text-[#20272B]">{filteredTickets.length}</span> tiket
            {selectedAsalUnit !== 'ALL' && !hideUnitFilters && (
              <span className="ml-1 text-[#417F85] font-bold">
                (Asal: {selectedAsalUnit === 'UPDL' ? '11 UPDL' : selectedAsalUnit === 'CORPU' ? 'PLN Corpu' : 'Non-UPDL'})
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-[#D5E0E3] text-[#69777D] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-7 h-7 rounded-lg text-xs font-semibold font-mono-numbers cursor-pointer ${
                  currentPage === page
                    ? 'bg-[#417F85] text-white shadow-2xs'
                    : 'text-[#69777D] hover:bg-white hover:border border-[#D5E0E3]'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-[#D5E0E3] text-[#69777D] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Admin Modal: Klasifikasi Asal Unit Tiket Lama (Requirement 6 & 9) */}
      {ticketToClassify && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-backdrop">
          <div className="bg-[#F5FAFA] rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#D5E0E3] animate-modal-enter space-y-4">
            <div className="flex items-center justify-between border-b border-[#D5E0E3] pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#417F85]" />
                <h3 className="text-sm font-bold text-[#20272B]">
                  Klasifikasi Asal Unit Tiket
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTicketToClassify(null)}
                className="p-1 text-[#69777D] hover:text-[#20272B] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-[#20272B] space-y-2 bg-[#E7EFF1] p-3.5 rounded-xl border border-[#D5E0E3]">
              <div>
                Nomor Tiket:{' '}
                <strong className="text-[#35666D] font-mono font-bold">
                  {ticketToClassify.ticketNumber}
                </strong>
              </div>
              <div>
                Pelapor:{' '}
                <strong className="text-[#20272B]">{ticketToClassify.reporterName}</strong> ({ticketToClassify.reporterEmail})
              </div>
              <div>
                Subjek Kendala:{' '}
                <span className="text-[#20272B] italic">"{ticketToClassify.title}"</span>
              </div>
              <div className="pt-1 text-[11px] text-[#69777D]">
                Pilih unit resmi dari 11 UPDL, PLN Corpu, atau Unit Umum/Non-UPDL untuk mengklasifikasikan asal tiket ini.
              </div>
            </div>

            {classifyFeedback && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{classifyFeedback}</span>
              </div>
            )}

            <form onSubmit={handleConfirmClassify} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#20272B] mb-1.5">
                  Pilih Asal Unit Resmi:
                </label>
                <select
                  value={targetClassifyUnitId}
                  onChange={(e) => setTargetClassifyUnitId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-[#FFFFFF] border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] font-medium shadow-2xs"
                >
                  <optgroup label="11 Unit UPDL Resmi">
                    {UPDL_UNITS.map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.unitName} (UPDL)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Unit Korporat (Bukan UPDL)">
                    <option value={CORPU_UNIT.unitId}>
                      {CORPU_UNIT.unitName} (CORPU)
                    </option>
                  </optgroup>
                  <optgroup label="Unit Umum / Non-UPDL">
                    {NON_UPDL_UNITS.map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.unitName} (Non-UPDL)
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#D5E0E3]">
                <button
                  type="button"
                  onClick={() => setTicketToClassify(null)}
                  className="px-4 py-2 text-xs font-semibold text-[#20272B] bg-[#FFFFFF] border border-[#D5E0E3] rounded-xl hover:bg-[#E7EFF1] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#417F85] hover:bg-[#326A70] rounded-xl shadow-xs cursor-pointer btn-press"
                >
                  Simpan Klasifikasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
