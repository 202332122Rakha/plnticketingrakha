import React, { useState, useMemo } from 'react';
import {
  Layers,
  PlusCircle,
  Edit3,
  Trash2,
  Clock,
  Shield,
  Tag,
  CheckCircle2,
  Copy,
  Check,
  Search,
  Filter,
  Sparkles,
  RefreshCw,
  Info,
  Hash,
  Calendar,
  AlertCircle,
  Layers3,
  Lock,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { Category } from '../types';
import { storageService } from '../services/storageService';
import {
  generateCategoryAbbreviation,
  formatCategoryCode,
  getNextCategorySequence,
  parseCategoryCode,
  MONTH_NAMES_ID,
  isValidCategoryCode,
} from '../utils/categoryHelpers';

export const CategoryManagementView: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>(() => storageService.getCategories());
  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Form states for Add / Edit
  const now = new Date();
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
  const currentYearNum = now.getFullYear();

  const [name, setName] = useState('');
  const [abbr, setAbbr] = useState('');
  const [isAbbrCustomized, setIsAbbrCustomized] = useState(false);
  const [month, setMonth] = useState(currentMonthStr);
  const [year, setYear] = useState(currentYearNum);
  const [description, setDescription] = useState('');
  const [subcategoriesStr, setSubcategoriesStr] = useState('');
  const [defaultTeam, setDefaultTeam] = useState('Network & Infrastructure');
  const [responseMinutes, setResponseMinutes] = useState(30);
  const [resolveHours, setResolveHours] = useState(8);
  const [allowEditAbbrInEditMode, setAllowEditAbbrInEditMode] = useState(false);

  // Copy feedback state
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const refreshData = () => {
    setCategories(storageService.getCategories());
  };

  // Next available 3-digit sequence number from existing categories
  const nextSeq = useMemo(() => {
    return getNextCategorySequence(categories);
  }, [categories]);

  // Live generated preview code for modal
  const previewCode = useMemo(() => {
    if (editingCat) {
      if (allowEditAbbrInEditMode && abbr.trim()) {
        const parsed = parseCategoryCode(editingCat.code);
        const editMonth = parsed ? parsed.monthStr : month;
        const editYear = parsed ? parsed.year : year;
        const editSeq = parsed ? parsed.seq : 1;
        return formatCategoryCode(abbr, editMonth, editYear, editSeq);
      }
      return editingCat.code || formatCategoryCode(abbr, month, year, 1);
    }
    const targetAbbr = abbr.trim() ? abbr : generateCategoryAbbreviation(name);
    return formatCategoryCode(targetAbbr, month, year, nextSeq);
  }, [editingCat, allowEditAbbrInEditMode, abbr, name, month, year, nextSeq]);

  // Breakdown of preview components for display cards
  const previewBreakdown = useMemo(() => {
    const parsed = parseCategoryCode(previewCode);
    const monthObj = MONTH_NAMES_ID.find((m) => m.value === (parsed ? parsed.monthStr : month));
    return {
      prefix: '#',
      abbr: parsed ? parsed.abbr : (abbr || 'XXXX'),
      monthStr: parsed ? parsed.monthStr : month,
      monthName: monthObj ? monthObj.name : 'Oktober',
      year: parsed ? parsed.year : year,
      seq: parsed ? parsed.seq.toString().padStart(3, '0') : nextSeq.toString().padStart(3, '0'),
    };
  }, [previewCode, abbr, month, year, nextSeq]);

  // Handle name change and auto-generate abbreviation
  React.useEffect(() => storageService.subscribe(refreshData), []);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isAbbrCustomized && !editingCat) {
      const generated = generateCategoryAbbreviation(val);
      setAbbr(generated);
    }
  };

  const handleResetAbbr = () => {
    const generated = generateCategoryAbbreviation(name);
    setAbbr(generated);
    setIsAbbrCustomized(false);
  };

  const handleAbbrChange = (val: string) => {
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4);
    setAbbr(cleaned);
    setIsAbbrCustomized(true);
  };

  const handleOpenAdd = () => {
    setEditingCat(null);
    setName('');
    const defaultAbbr = generateCategoryAbbreviation('');
    setAbbr(defaultAbbr);
    setIsAbbrCustomized(false);
    setMonth(String(new Date().getMonth() + 1).padStart(2, '0'));
    setYear(new Date().getFullYear());
    setDescription('');
    setSubcategoriesStr('');
    setDefaultTeam('Network & Infrastructure');
    setResponseMinutes(30);
    setResolveHours(8);
    setAllowEditAbbrInEditMode(false);
    setShowModal(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCat(cat);
    setName(cat.name);
    const parsed = parseCategoryCode(cat.code);
    setAbbr(parsed ? parsed.abbr : generateCategoryAbbreviation(cat.name));
    setMonth(parsed ? parsed.monthStr : String(new Date().getMonth() + 1).padStart(2, '0'));
    setYear(parsed ? parsed.year : new Date().getFullYear());
    setIsAbbrCustomized(false);
    setDescription(cat.description);
    setSubcategoriesStr(cat.subcategories.join(', '));
    setDefaultTeam(cat.defaultTeam);
    setResponseMinutes(cat.defaultSlaResponseMinutes);
    setResolveHours(cat.defaultSlaResolveHours);
    setAllowEditAbbrInEditMode(false);
    setShowModal(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let finalCode = '';
    if (editingCat) {
      if (allowEditAbbrInEditMode && abbr.trim()) {
        const parsed = parseCategoryCode(editingCat.code);
        const editMonth = parsed ? parsed.monthStr : month;
        const editYear = parsed ? parsed.year : year;
        const editSeq = parsed ? parsed.seq : 1;
        finalCode = formatCategoryCode(abbr, editMonth, editYear, editSeq);
      } else {
        finalCode = editingCat.code || formatCategoryCode(abbr, month, year, 1);
      }
    } else {
      finalCode = previewCode;
    }

    const newCat: Category = {
      id: editingCat ? editingCat.id : `cat-${Date.now()}`,
      code: finalCode,
      name: name.trim(),
      description: description.trim(),
      subcategories: subcategoriesStr.split(',').map((s) => s.trim()).filter(Boolean),
      defaultTeam,
      defaultSlaResponseMinutes: Number(responseMinutes),
      defaultSlaResolveHours: Number(resolveHours),
      isActive: editingCat ? editingCat.isActive : true,
      createdAt: editingCat?.createdAt || new Date(year, parseInt(month, 10) - 1, 1).toISOString(),
    };

    try { await storageService.saveCategory(newCat); } catch (error) { window.alert(error instanceof Error ? error.message : 'Gagal menyimpan ke server.'); return; }
    refreshData();
    setShowModal(false);
    showToast(
      editingCat
        ? `Kategori "${newCat.name}" (${newCat.code}) berhasil diperbarui.`
        : `Kategori "${newCat.name}" berhasil ditambahkan dengan kode ${newCat.code}.`
    );
  };

  const handleToggleActive = async (cat: Category) => {
    const updated: Category = {
      ...cat,
      isActive: !cat.isActive,
    };
    try { await storageService.saveCategory(updated); } catch (error) { window.alert(error instanceof Error ? error.message : 'Gagal menyimpan ke server.'); return; }
    refreshData();
    showToast(
      `Status kategori "${cat.name}" diubah menjadi ${updated.isActive ? 'Aktif' : 'Nonaktif'}.`
    );
  };

  const handleDelete = async (id: string, catName: string, catCode: string) => {
    if (confirm(`Hapus kategori "${catName}" (${catCode}) dari sistem?`)) {
      try { await storageService.deleteCategory(id); } catch (error) { window.alert(error instanceof Error ? error.message : 'Gagal menyimpan ke server.'); return; }
      refreshData();
      showToast(`Kategori "${catName}" (${catCode}) telah dihapus.`);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast(`Kode kategori "${code}" berhasil disalin.`);
    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
  };

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      if (teamFilter !== 'ALL' && cat.defaultTeam !== teamFilter) return false;
      if (statusFilter === 'active' && !cat.isActive) return false;
      if (statusFilter === 'inactive' && cat.isActive) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = cat.name.toLowerCase().includes(q);
        const matchesCode = (cat.code || '').toLowerCase().includes(q);
        const matchesDesc = cat.description.toLowerCase().includes(q);
        const matchesSub = cat.subcategories.some((s) => s.toLowerCase().includes(q));
        if (!matchesName && !matchesCode && !matchesDesc && !matchesSub) return false;
      }
      return true;
    });
  }, [categories, teamFilter, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = categories.length;
    const activeCount = categories.filter((c) => c.isActive).length;
    const teamCounts = {
      network: categories.filter((c) => c.defaultTeam === 'Network & Infrastructure').length,
      hardware: categories.filter((c) => c.defaultTeam === 'IT Support & Hardware').length,
      app: categories.filter((c) => c.defaultTeam === 'Application Support').length,
    };
    return { total, activeCount, teamCounts };
  }, [categories]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#1765B3] text-white px-4 py-3 rounded-xl shadow-lg border border-[#B8DEFF]/40 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-sky-200 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card - Light Blue Gradient - White Enterprise */}
      <div className="bg-gradient-to-r from-white via-[#EFF8FF] to-[#D9EEFF]/50 p-6 rounded-2xl border border-[#DCEAF7] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2589E8] to-[#1765B3] flex items-center justify-center text-white shadow-md">
              <Layers3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#172B4D] tracking-tight">
                Kategori Tiket & Kode Otomatis
              </h1>
              <p className="text-xs text-[#64748B] font-medium">
                PLN Corporate University Ticketing Management System
              </p>
            </div>
          </div>
          <p className="text-xs text-[#64748B] max-w-2xl leading-relaxed pt-1">
            Pengelolaan klasifikasi tiket insiden dan permintaan layanan dengan standardisasi kode unik berformat{' '}
            <code className="px-1.5 py-0.5 bg-[#EFF8FF] text-[#1765B3] border border-[#B8DEFF] rounded font-mono font-bold text-[11px]">
              #XXXX-MM-YYYY-NNN
            </code>{' '}
            yang dihasilkan secara otomatis oleh sistem saat penambahan kategori.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-gradient-to-r from-[#2589E8] to-[#1765B3] hover:from-[#1d78d1] hover:to-[#125396] text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer transition-all active:scale-98 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Tambah Kategori Baru</span>
        </button>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Categories */}
        <div className="bg-white p-4 rounded-xl border border-[#DCEAF7] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
              Total Kategori
            </span>
            <div className="text-2xl font-black text-[#172B4D] mt-0.5 font-mono">
              {stats.total}
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3 h-3" />
              {stats.activeCount} Kategori Aktif
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#EFF8FF] text-[#2589E8] border border-[#B8DEFF] flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Format Standar */}
        <div className="bg-white p-4 rounded-xl border border-[#DCEAF7] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
              Format Standar Kode
            </span>
            <div className="text-sm font-black text-[#1765B3] mt-1 font-mono tracking-wide">
              #XXXX-MM-YYYY-NNN
            </div>
            <span className="text-[10px] text-[#64748B] font-medium mt-0.5 block">
              Awalan · Singkatan · Bulan · Tahun · No. Urut
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EFF8FF] to-[#D9EEFF] text-[#1765B3] border border-[#B8DEFF] flex items-center justify-center">
            <Hash className="w-5 h-5" />
          </div>
        </div>

        {/* Tim Penanganan */}
        <div className="bg-white p-4 rounded-xl border border-[#DCEAF7] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
              Sebaran Tim Penanganan
            </span>
            <div className="text-xs text-[#172B4D] font-bold mt-1.5 space-y-0.5">
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2589E8]"></span>
                <span className="text-[#64748B]">Network:</span>{' '}
                <span className="font-mono">{stats.teamCounts.network}</span>
                <span className="text-slate-300">·</span>
                <span className="text-[#64748B]">Hardware:</span>{' '}
                <span className="font-mono">{stats.teamCounts.hardware}</span>
                <span className="text-slate-300">·</span>
                <span className="text-[#64748B]">Apps:</span>{' '}
                <span className="font-mono">{stats.teamCounts.app}</span>
              </div>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#EFF8FF] text-[#2589E8] border border-[#B8DEFF] flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        {/* Auto Assignment Readiness */}
        <div className="bg-white p-4 rounded-xl border border-[#DCEAF7] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
              Integrasi Auto Assign
            </span>
            <div className="text-xs font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Tersinkronisasi 100%</span>
            </div>
            <span className="text-[10px] text-[#64748B] font-medium mt-0.5 block">
              Dengan aturan routing PIC CorpU
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#DCEAF7] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama kategori atau kode (#JAIT-01-2026-001, #PEKE, 002)..."
              className="w-full pl-9 pr-3 py-2 bg-[#F5FAFF] border border-[#DCEAF7] rounded-xl text-xs text-[#172B4D] placeholder:text-[#94A3B8] focus:outline-hidden focus:ring-2 focus:ring-[#2589E8] focus:bg-white font-medium transition-all"
            />
          </div>

          {/* Team Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#64748B] font-semibold hidden sm:inline">Tim:</span>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="text-xs bg-[#F5FAFF] border border-[#DCEAF7] rounded-xl px-3 py-2 text-[#172B4D] font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#2589E8] transition-all"
            >
              <option value="ALL">Semua Tim Penanganan</option>
              <option value="Network & Infrastructure">Network & Infrastructure</option>
              <option value="IT Support & Hardware">IT Support & Hardware</option>
              <option value="Application Support">Application Support</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#64748B] font-semibold hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-[#F5FAFF] border border-[#DCEAF7] rounded-xl px-3 py-2 text-[#172B4D] font-semibold focus:outline-hidden focus:ring-2 focus:ring-[#2589E8] transition-all"
            >
              <option value="ALL">Semua Status</option>
              <option value="active">Aktif Saja</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>
        </div>

        {(searchQuery || teamFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setTeamFilter('ALL');
              setStatusFilter('ALL');
            }}
            className="text-xs text-[#2589E8] hover:text-[#1765B3] font-bold px-2 py-1 rounded hover:bg-[#EFF8FF] transition-colors cursor-pointer"
          >
            Reset Filter
          </button>
        )}
      </div>

      {/* Categories Grid */}
      {filteredCategories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#DCEAF7] p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#EFF8FF] text-[#2589E8] flex items-center justify-center mx-auto mb-3 border border-[#B8DEFF]">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#172B4D]">Kategori Tidak Ditemukan</h3>
          <p className="text-xs text-[#64748B] max-w-sm mx-auto mt-1">
            Tidak ada kategori yang cocok dengan kriteria pencarian atau filter Anda saat ini.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setTeamFilter('ALL');
              setStatusFilter('ALL');
            }}
            className="mt-4 px-4 py-2 bg-[#EFF8FF] text-[#1765B3] border border-[#B8DEFF] rounded-xl text-xs font-bold hover:bg-[#D9EEFF] transition-colors cursor-pointer"
          >
            Bersihkan Pencarian
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredCategories.map((cat) => {
            const isCopied = copiedCode === cat.code;
            const parsed = parseCategoryCode(cat.code || '');
            const monthObj = parsed ? MONTH_NAMES_ID.find((m) => m.value === parsed.monthStr) : null;
            const monthDisplay = monthObj ? `${monthObj.name} ${parsed?.year}` : (parsed ? `Bulan ${parsed.monthStr} ${parsed.year}` : '-');

            return (
              <div
                key={cat.id}
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-xs hover:shadow-md flex flex-col justify-between p-5 space-y-4 ${
                  cat.isActive
                    ? 'border-[#DCEAF7] hover:border-[#B8DEFF]'
                    : 'border-slate-200 bg-slate-50/50 opacity-75'
                }`}
              >
                {/* Card Top: Code Badge & Status */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    {/* Category Code Badge - Light Blue Gradient - White Enterprise */}
                    <div className="flex items-center gap-1.5 bg-gradient-to-r from-[#EFF8FF] to-[#D9EEFF] px-2.5 py-1 rounded-lg border border-[#B8DEFF] shadow-2xs group/code">
                      <Hash className="w-3.5 h-3.5 text-[#2589E8]" />
                      <span className="font-mono text-xs font-bold text-[#1765B3] tracking-wider select-all">
                        {cat.code || '#KODE-01-2026-000'}
                      </span>
                      <button
                        onClick={() => handleCopyCode(cat.code || '')}
                        title="Salin kode kategori"
                        className="ml-1 p-1 text-[#2589E8] hover:text-[#1765B3] hover:bg-white/80 rounded transition-colors cursor-pointer"
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 opacity-70 group-hover/code:opacity-100" />
                        )}
                      </button>
                    </div>

                    {/* Status & Toggle */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(cat)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 transition-colors cursor-pointer ${
                          cat.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-300'
                        }`}
                        title="Klik untuk mengubah status aktif/nonaktif"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            cat.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        {cat.isActive ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </div>
                  </div>

                  {/* Category Title & Team & Period Info */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base font-extrabold text-[#172B4D] tracking-tight flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#2589E8] shrink-0" />
                        <span>{cat.name}</span>
                      </h2>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold bg-[#EFF8FF] text-[#1765B3] border border-[#B8DEFF] px-2 py-0.5 rounded-md">
                        {cat.defaultTeam}
                      </span>
                      {parsed && (
                        <span className="text-[10px] font-medium text-[#64748B] bg-[#F5FAFF] border border-[#DCEAF7] px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#2589E8]" />
                          <span>Dibuat: {monthDisplay}</span>
                          <span className="text-slate-300">·</span>
                          <span className="font-mono text-[#1765B3] font-bold">No. {parsed.seq.toString().padStart(3, '0')}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    {cat.description || 'Tidak ada deskripsi lingkup kendala.'}
                  </p>

                  {/* Subcategories */}
                  <div className="pt-1">
                    <span className="text-[11px] font-bold text-[#64748B] block mb-1.5">
                      Subkategori Terdaftar ({cat.subcategories.length}):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.subcategories.map((sub, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-[#F5FAFF] text-[#172B4D] border border-[#DCEAF7] px-2 py-0.5 rounded-md font-medium"
                        >
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer: SLA Metrics & Actions */}
                <div className="pt-3.5 border-t border-[#DCEAF7] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 text-[11px] text-[#64748B] font-mono">
                    <span className="flex items-center gap-1 bg-[#F5FAFF] px-2 py-1 rounded-md border border-[#DCEAF7]">
                      <Clock className="w-3 h-3 text-[#2589E8]" />
                      <span>SLA Respons:</span>
                      <strong className="text-[#172B4D]">{cat.defaultSlaResponseMinutes}m</strong>
                    </span>
                    <span className="flex items-center gap-1 bg-[#F5FAFF] px-2 py-1 rounded-md border border-[#DCEAF7]">
                      <Clock className="w-3 h-3 text-[#2589E8]" />
                      <span>Resolusi:</span>
                      <strong className="text-[#172B4D]">{cat.defaultSlaResolveHours}j</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(cat)}
                      className="px-3 py-1.5 bg-[#EFF8FF] hover:bg-[#D9EEFF] text-[#1765B3] border border-[#B8DEFF] rounded-lg font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id, cat.name, cat.code)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-200"
                      title="Hapus Kategori"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-backdrop">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#DCEAF7] space-y-4 text-xs my-8 animate-modal-enter">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#DCEAF7]">
              <div>
                <h2 className="text-base font-extrabold text-[#172B4D] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#2589E8]" />
                  <span>{editingCat ? 'Edit Kategori Tiket' : 'Tambah Kategori Baru'}</span>
                </h2>
                <p className="text-[11px] text-[#64748B] mt-0.5">
                  {editingCat
                    ? 'Perbarui informasi kategori dan aturan SLA'
                    : 'Sistem akan otomatis menghasilkan kode unik #XXXX-MM-YYYY-NNN'}
                </p>
              </div>
              <div className="px-2.5 py-1 bg-[#EFF8FF] text-[#1765B3] border border-[#B8DEFF] rounded-lg font-mono font-bold text-[10px]">
                {editingCat ? 'EDIT MODE' : 'AUTO GENERATE'}
              </div>
            </div>

            {/* LIVE CODE PREVIEW BANNER - Light Blue Gradient - White Enterprise */}
            <div className="bg-gradient-to-r from-[#EFF8FF] via-[#D9EEFF] to-[#B8DEFF]/60 p-4 rounded-xl border border-[#B8DEFF] shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#1765B3] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Kode Kategori Tiket Otomatis</span>
                </span>
                <span className="text-[10px] font-bold text-[#2589E8] bg-white/90 px-2 py-0.5 rounded-full border border-[#B8DEFF]">
                  {editingCat && !allowEditAbbrInEditMode ? 'Tersimpan (Permanen)' : 'Preview Real-time'}
                </span>
              </div>

              {/* Big Highlighted Code */}
              <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-lg border border-[#B8DEFF] shadow-inner">
                <div className="flex items-center gap-2">
                  <Hash className="w-5 h-5 text-[#2589E8]" />
                  <span className="font-mono text-lg font-black text-[#172B4D] tracking-widest select-all">
                    {previewCode}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[#1765B3] font-bold bg-[#EFF8FF] px-2 py-0.5 rounded border border-[#B8DEFF]">
                  #XXXX-MM-YYYY-NNN
                </div>
              </div>

              {/* Breakdown 5-Part Interactive Explanation */}
              <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] pt-1">
                <div className="bg-white/90 p-1.5 rounded-lg border border-[#B8DEFF]/80">
                  <span className="text-[#64748B] block font-mono text-[9px]">Awalan</span>
                  <strong className="text-[#1765B3] font-mono font-bold text-xs">{previewBreakdown.prefix}</strong>
                </div>
                <div className="bg-white/90 p-1.5 rounded-lg border border-[#B8DEFF]/80">
                  <span className="text-[#64748B] block font-mono text-[9px]">Singkatan (XXXX)</span>
                  <strong className="text-[#1765B3] font-mono font-bold text-xs tracking-wider">
                    {previewBreakdown.abbr}
                  </strong>
                </div>
                <div className="bg-white/90 p-1.5 rounded-lg border border-[#B8DEFF]/80">
                  <span className="text-[#64748B] block font-mono text-[9px]">Bulan (MM)</span>
                  <strong className="text-[#1765B3] font-mono font-bold text-xs">
                    {previewBreakdown.monthStr}
                  </strong>
                </div>
                <div className="bg-white/90 p-1.5 rounded-lg border border-[#B8DEFF]/80">
                  <span className="text-[#64748B] block font-mono text-[9px]">Tahun (YYYY)</span>
                  <strong className="text-[#1765B3] font-mono font-bold text-xs">
                    {previewBreakdown.year}
                  </strong>
                </div>
                <div className="bg-white/90 p-1.5 rounded-lg border border-[#B8DEFF]/80">
                  <span className="text-[#64748B] block font-mono text-[9px]">No. Urut (NNN)</span>
                  <strong className="text-[#1765B3] font-mono font-bold text-xs">
                    {previewBreakdown.seq}
                  </strong>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveCategory} className="space-y-4">
              {/* Category Name */}
              <div>
                <label className="block font-bold text-[#172B4D] mb-1">
                  Nama Kategori <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Contoh: Keamanan Siber dan Audit TI"
                  className="w-full p-2.5 bg-[#F5FAFF] border border-[#DCEAF7] rounded-xl text-[#172B4D] font-semibold text-xs focus:outline-hidden focus:ring-2 focus:ring-[#2589E8] focus:bg-white transition-all"
                />
                <p className="text-[10px] text-[#64748B] mt-1">
                  Sistem membaca nama kategori dan langsung menghasilkan 4 huruf singkatan kapital secara otomatis.
                </p>
              </div>

              {/* Controls: Abbreviation, Month, Year, Sequence */}
              {!editingCat ? (
                <div className="bg-[#F5FAFF] p-3.5 rounded-xl border border-[#DCEAF7] space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Abbreviation (XXXX) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-[#172B4D] text-[11px]">
                          Singkatan (XXXX)
                        </label>
                        {isAbbrCustomized && (
                          <button
                            type="button"
                            onClick={handleResetAbbr}
                            className="text-[10px] text-[#2589E8] hover:underline flex items-center gap-0.5 cursor-pointer"
                            title="Kembalikan ke algoritma otomatis"
                          >
                            <RefreshCw className="w-2.5 h-2.5" />
                            <span>Reset</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        maxLength={4}
                        value={abbr}
                        onChange={(e) => handleAbbrChange(e.target.value)}
                        placeholder="XXXX"
                        className="w-full p-2 bg-white border border-[#DCEAF7] rounded-lg text-[#172B4D] font-mono font-bold text-xs uppercase tracking-wider focus:outline-hidden focus:ring-2 focus:ring-[#2589E8]"
                      />
                      <span className="text-[9px] text-[#64748B] mt-0.5 block">
                        {isAbbrCustomized ? 'Kustomisasi manual' : 'Otomatis dari nama'}
                      </span>
                    </div>

                    {/* Month (MM) */}
                    <div>
                      <label className="block font-bold text-[#172B4D] mb-1 text-[11px]">
                        Bulan Pembuatan (MM)
                      </label>
                      <select
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="w-full p-2 bg-white border border-[#DCEAF7] rounded-lg text-[#172B4D] font-mono font-bold text-xs focus:outline-hidden focus:ring-2 focus:ring-[#2589E8]"
                      >
                        {MONTH_NAMES_ID.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-[9px] text-[#64748B] mt-0.5 block">
                        Default bulan berjalan
                      </span>
                    </div>

                    {/* Year (YYYY) & Sequence (NNN) */}
                    <div>
                      <label className="block font-bold text-[#172B4D] mb-1 text-[11px]">
                        Tahun (YYYY) & Urut (NNN)
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="2020"
                          max="2099"
                          value={year}
                          onChange={(e) => setYear(Number(e.target.value))}
                          className="w-20 p-2 bg-white border border-[#DCEAF7] rounded-lg text-[#172B4D] font-mono font-bold text-xs focus:outline-hidden focus:ring-2 focus:ring-[#2589E8]"
                        />
                        <div
                          className="flex-1 p-2 bg-[#EFF8FF] border border-[#B8DEFF] rounded-lg font-mono text-[#1765B3] font-bold text-xs text-center flex items-center justify-center gap-1"
                          title="Nomor urut otomatis 3 digit, berlanjut tanpa duplikat"
                        >
                          <Lock className="w-3 h-3 text-[#2589E8]" />
                          <span>#{nextSeq.toString().padStart(3, '0')}</span>
                        </div>
                      </div>
                      <span className="text-[9px] text-[#64748B] mt-0.5 block">
                        No urut otomatis berurutan
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#F5FAFF] p-3.5 rounded-xl border border-[#DCEAF7] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#172B4D]">
                      Kode Kategori Tersimpan: <code className="font-mono text-[#1765B3] font-black">{editingCat.code}</code>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAllowEditAbbrInEditMode(!allowEditAbbrInEditMode)}
                      className="text-[10px] text-[#2589E8] hover:underline font-bold cursor-pointer flex items-center gap-1"
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>{allowEditAbbrInEditMode ? 'Batal Sesuaikan' : 'Sesuaikan Singkatan (XXXX)'}</span>
                    </button>
                  </div>
                  {allowEditAbbrInEditMode ? (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        maxLength={4}
                        value={abbr}
                        onChange={(e) => handleAbbrChange(e.target.value)}
                        placeholder="XXXX"
                        className="w-28 p-1.5 bg-white border border-[#DCEAF7] rounded-lg text-[#172B4D] font-mono font-bold text-xs uppercase tracking-wider focus:outline-hidden focus:ring-2 focus:ring-[#2589E8]"
                      />
                      <span className="text-[10px] text-[#64748B]">
                        Bulan, tahun, dan nomor urut tetap dipertahankan:{' '}
                        <strong className="font-mono text-[#172B4D]">{previewCode}</strong>
                      </span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-[#64748B]">
                      Sesuai aturan standardisasi PLN CorpU, kode kategori yang sudah tersimpan dipertahankan agar integritas riwayat tiket masa lampau tetap terjaga.
                    </p>
                  )}
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block font-bold text-[#172B4D] mb-1">
                  Deskripsi Ruang Lingkup Kendala
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Deskripsi singkat jenis permasalahan atau layanan dalam kategori ini..."
                  className="w-full p-2.5 bg-[#F5FAFF] border border-[#DCEAF7] rounded-xl text-[#172B4D] text-xs focus:outline-hidden focus:ring-2 focus:ring-[#2589E8] focus:bg-white transition-all"
                />
              </div>

              {/* Subcategories */}
              <div>
                <label className="block font-bold text-[#172B4D] mb-1">
                  Subkategori (pisahkan dengan koma)
                </label>
                <textarea
                  rows={2}
                  value={subcategoriesStr}
                  onChange={(e) => setSubcategoriesStr(e.target.value)}
                  placeholder="Contoh: Gangguan Firewall, Akses SSH Gagal, Port Switch Mati..."
                  className="w-full p-2.5 bg-[#F5FAFF] border border-[#DCEAF7] rounded-xl text-[#172B4D] text-xs focus:outline-hidden focus:ring-2 focus:ring-[#2589E8] focus:bg-white transition-all"
                />
              </div>

              {/* Default Team */}
              <div>
                <label className="block font-bold text-[#172B4D] mb-1">
                  Tim Penanggung Jawab Default
                </label>
                <select
                  value={defaultTeam}
                  onChange={(e) => setDefaultTeam(e.target.value)}
                  className="w-full p-2.5 bg-[#F5FAFF] border border-[#DCEAF7] rounded-xl text-[#172B4D] font-semibold text-xs focus:outline-hidden focus:ring-2 focus:ring-[#2589E8] transition-all"
                >
                  <option value="Network & Infrastructure">Network & Infrastructure</option>
                  <option value="IT Support & Hardware">IT Support & Hardware</option>
                  <option value="Application Support">Application Support</option>
                </select>
              </div>

              {/* SLA Targets */}
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="block font-bold text-[#172B4D] mb-1 font-sans text-xs">
                    Target SLA Respons (Menit)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    value={responseMinutes}
                    onChange={(e) => setResponseMinutes(Number(e.target.value))}
                    className="w-full p-2 bg-[#F5FAFF] border border-[#DCEAF7] rounded-xl text-[#172B4D] font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#172B4D] mb-1 font-sans text-xs">
                    Target SLA Resolusi (Jam)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    value={resolveHours}
                    onChange={(e) => setResolveHours(Number(e.target.value))}
                    className="w-full p-2 bg-[#F5FAFF] border border-[#DCEAF7] rounded-xl text-[#172B4D] font-bold text-xs"
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#DCEAF7]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-[#DCEAF7] text-[#64748B] hover:text-[#172B4D] font-bold rounded-xl hover:bg-[#F5FAFF] cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-[#2589E8] to-[#1765B3] hover:from-[#1d78d1] hover:to-[#125396] text-white font-bold rounded-xl shadow-md shadow-blue-500/20 cursor-pointer transition-all active:scale-98"
                >
                  {editingCat ? 'Simpan Perubahan' : 'Buat Kategori & Terbitkan Kode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
