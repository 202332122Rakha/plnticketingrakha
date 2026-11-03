import React, { useState, useMemo, useEffect } from 'react';
import {
  PlusCircle,
  FileText,
  AlertCircle,
  CheckCircle2,
  Paperclip,
  Trash2,
  Info,
  Layers,
  MapPin,
  Laptop,
  Flame,
  ArrowRight,
  Shield,
  UserCheck,
  Wrench,
  Sparkles,
  Building2,
  Clock,
} from 'lucide-react';
import {
  Ticket,
  TicketType,
  ImpactLevel,
  UrgencyLevel,
  PriorityLevel,
  User as UserType,
  Category,
  Unit,
} from '../types';
import { calculateDueDates } from '../utils/slaCalculator';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { formatPicDisplayName } from '../utils/picHelpers';
import {
  formatTicketNumberDisplay,
} from '../utils/ticketHelpers';
import { HXMS_COMPONENTS } from '../data/hxmsData';
import { OriginUnitBadge } from '../utils/unitHelpers';
import { Copy, Check, Lock } from 'lucide-react';
import { createTicket, uploadTicketAttachment } from '../services/ticketApiService';
import { listRegistrationUnits } from '../services/registrationApiService';

interface CreateTicketViewProps {
  currentUser: UserType;
  categories: Category[];
  onNavigate: (view: string, ticketId?: string) => void;
  preselectedUnitId?: string | null;
}

export const CreateTicketView: React.FC<CreateTicketViewProps> = ({
  currentUser,
  categories,
  onNavigate,
  preselectedUnitId,
}) => {
  const isReporter = currentUser.role === 'pelapor';
  const [registeredUnits, setRegisteredUnits] = useState<Unit[]>([]);

  useEffect(() => {
    let cancelled = false;
    listRegistrationUnits()
      .then((units) => {
        if (!cancelled) setRegisteredUnits(units);
      })
      .catch(() => {
        if (!cancelled) setRegisteredUnits([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Focus Kategori Layanan pada HXMS (cat-lms)
  const defaultHxmsCat = useMemo(() => {
    return (
      categories.find((c) => c.id === 'cat-lms' || c.name.toLowerCase().includes('hxms')) ||
      categories[0]
    );
  }, [categories]);

  // Contextual effective unit (Pre-fill context when initiated from UPDL, Corpu, or Non-UPDL page)
  const effectiveUnit = useMemo(() => {
    if (preselectedUnitId) {
      const found = registeredUnits.find((unit) => unit.unitId === preselectedUnitId || unit.unitCode === preselectedUnitId);
      if (found) {
        if (currentUser.role === 'admin' || currentUser.role === 'manajemen' || currentUser.unitId === found.unitId) {
          return found;
        }
      }
    }
    return null;
  }, [preselectedUnitId, currentUser, registeredUnits]);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<TicketType>('Insiden');
  const [categoryId, setCategoryId] = useState(defaultHxmsCat?.id || 'cat-lms');

  // Komponen HXMS & Subkategori Berdasarkan Komponen
  const [selectedComponentId, setSelectedComponentId] = useState<string>(HXMS_COMPONENTS[1].id); // Modul Pembelajaran default
  const selectedComponent = useMemo(() => {
    return HXMS_COMPONENTS.find((c) => c.id === selectedComponentId) || HXMS_COMPONENTS[0];
  }, [selectedComponentId]);

  const subcategories = useMemo(() => {
    return selectedComponent ? selectedComponent.subcategories : [];
  }, [selectedComponent]);

  const [subcategoryId, setSubcategoryId] = useState(subcategories[0] || '');
  const [location, setLocation] = useState(
    effectiveUnit ? effectiveUnit.unitName : currentUser.unitName || 'PLN Corporate University'
  );
  const [assetReference, setAssetReference] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<Ticket | null>(null);
  const [attachmentWarning, setAttachmentWarning] = useState<string | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Selected category object
  const selectedCat = categories.find((c) => c.id === categoryId) || defaultHxmsCat || categories[0];

  // Automatic Priority Calculation based on HXMS Component & Type (No manual input by Pelapor)
  const calculatedPriority: PriorityLevel = useMemo(() => {
    if (selectedComponent?.id === 'comp-hxms-exm' || selectedComponent?.id === 'comp-hxms-tec') {
      return type === 'Insiden' ? 'Kritis' : 'Tinggi';
    }
    if (selectedComponent?.id === 'comp-hxms-acc') {
      return 'Sedang';
    }
    if (selectedComponent?.id === 'comp-hxms-mod') {
      return type === 'Insiden' ? 'Tinggi' : 'Sedang';
    }
    return 'Sedang';
  }, [selectedComponent, type]);

  // Derived impact and urgency for internal SLA / ITIL records
  const impact: ImpactLevel = calculatedPriority === 'Kritis' ? 'Banyak Pengguna' : 'Tim';
  const urgency: UrgencyLevel = calculatedPriority === 'Kritis' || calculatedPriority === 'Tinggi' ? 'Tinggi' : 'Sedang';

  // Calculate target SLA estimate
  const slaTarget = calculateDueDates(new Date().toISOString(), calculatedPriority);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAttachments((previous) => [...previous, ...Array.from(e.target.files || [])]);
      e.target.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert('Mohon isi judul tiket dan deskripsi kendala secara lengkap.');
      return;
    }

    setIsSubmitting(true);

    let ticket: Ticket | null = null;
    try {
      const subcategoryName = subcategoryId || subcategories[0] || 'Umum';
      ticket = await createTicket({
        title: title.trim(),
        description: description.trim(),
        type,
        categoryId: selectedCat.id,
        componentId: selectedComponent?.id,
        componentName: selectedComponent?.name,
        subcategoryName,
        department: currentUser.department,
        location: location.trim() || ((currentUser.role === 'admin' && effectiveUnit) ? effectiveUnit.unitName : currentUser.unitName) || 'Gedung Utama PLN Corporate University',
        assetReference: assetReference.trim() || undefined,
        impact,
        urgency,
        priority: calculatedPriority,
        tags: ['HXMS', selectedComponent?.name || selectedCat.name, type],
      });

      const attachmentErrors: string[] = [];
      for (const file of attachments) {
        try {
          await uploadTicketAttachment(ticket, currentUser.uid, file);
        } catch (error) {
          attachmentErrors.push(error instanceof Error ? error.message : `Gagal mengunggah ${file.name}.`);
        }
      }
      setAttachmentWarning(attachmentErrors.length > 0 ? attachmentErrors.join(' ') : null);
      setCreatedTicket(ticket);
    } catch (err) {
      if (ticket) {
        setCreatedTicket(ticket);
        setAttachmentWarning(err instanceof Error ? err.message : 'Tiket tersimpan, tetapi ada lampiran yang gagal diunggah.');
      } else {
        alert(err instanceof Error ? err.message : 'Tiket gagal disimpan ke database.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdTicket) {
    const hasAssignedPic = !!createdTicket.currentPicName;

    return (
      <div className="max-w-2xl mx-auto py-8 px-4 text-center">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-1">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div>
            <h2 className="text-xl font-extrabold text-slate-900">
              Tiket Berhasil Diterbitkan!
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Laporan Anda telah tersimpan di database.
            </p>
          </div>
          {attachmentWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 text-left">
              Tiket tersimpan, tetapi lampiran belum seluruhnya berhasil disimpan: {attachmentWarning}
            </div>
          )}

          {/* Ticket Number Card (Soft Corporate Teal Theme) */}
          <div className="p-4 bg-[#E7EFF1] rounded-xl border border-[#D5E0E3] max-w-sm mx-auto font-mono text-center shadow-2xs">
            <span className="text-[11px] text-[#69777D] uppercase font-bold tracking-wider block">
              Nomor Tiket Resmi Anda
            </span>
            <div className="text-2xl font-black text-[#35666D] tracking-wider mt-1 flex items-center justify-center gap-2">
              <span>{formatTicketNumberDisplay(createdTicket.ticketNumber)}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(formatTicketNumberDisplay(createdTicket.ticketNumber));
                  setCopiedSuccess(true);
                  setTimeout(() => setCopiedSuccess(false), 2000);
                }}
                className="p-1.5 rounded-lg bg-white border border-[#D5E0E3] text-[#35666D] hover:bg-[#F5FAFA] transition-colors cursor-pointer text-xs flex items-center gap-1 shadow-2xs"
                title="Salin Nomor Tiket"
              >
                {copiedSuccess ? <Check className="w-4 h-4 text-[#417F85]" /> : <Copy className="w-4 h-4 text-[#417F85]" />}
              </button>
            </div>
            {createdTicket.categoryCode && !isReporter && (
              <div className="text-[11px] text-[#417F85] mt-1 font-medium">
                Kode Kategori: <span className="font-bold text-[#35666D]">{createdTicket.categoryCode}</span>
              </div>
            )}
            {copiedSuccess && (
              <span className="text-[10px] text-[#417F85] font-bold block mt-1">
                ✓ Nomor tiket berhasil disalin ke clipboard!
              </span>
            )}
          </div>

          {/* Service Commitment / Status Banner */}
          {isReporter ? (
            <div className="p-4 bg-[#F5FAFA] rounded-xl border border-[#D5E0E3] text-left space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-[#D5E0E3] pb-2">
                <span className="text-xs font-bold text-[#20272B] flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#417F85]" />
                  Estimasi Waktu Penanganan
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                  Diterima Helpdesk
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-white rounded-lg border border-[#D5E0E3] shadow-2xs">
                  <span className="text-[10px] text-[#69777D] block font-medium">Estimasi Target Respons:</span>
                  <span className="font-bold text-[#20272B] font-mono-numbers">15 Menit</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-[#D5E0E3] shadow-2xs">
                  <span className="text-[10px] text-[#69777D] block font-medium">Estimasi Batas Selesai:</span>
                  <span className="font-bold text-[#20272B] font-mono-numbers">4 Jam Kerja</span>
                </div>
              </div>
              <p className="text-[11px] text-[#35666D] leading-relaxed">
                ✓ Laporan Anda telah berhasil dicatat. Petugas Helpdesk akan segera menindaklanjuti kendala Anda sesuai target SLA di atas.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Status Penugasan PIC:
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    hasAssignedPic
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  {hasAssignedPic
                    ? createdTicket.assignmentMethod === 'manual'
                      ? 'Ditugaskan ke PIC Pilihan Pelapor'
                      : 'Ditugaskan Otomatis'
                    : 'Menunggu Penetapan Manual'}
                </span>
              </div>

              {hasAssignedPic ? (
                <div className="flex items-start gap-3 pt-1">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-xs">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {formatPicDisplayName(createdTicket.currentPicId, createdTicket.currentPicName)}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Tim: <strong className="text-slate-700">{createdTicket.currentPicTeam}</strong> · Kategori: {createdTicket.categoryName}
                    </div>
                    <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                      ✓ Tiket telah langsung masuk ke menu "Penugasan Saya" di dashboard {formatPicDisplayName(createdTicket.currentPicId, createdTicket.currentPicName)}.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-800">
                  Tiket telah disimpan ke antrean Helpdesk. Sistem belum menemukan PIC yang sedang aktif untuk kategori ini, sehingga Admin Ticketing telah menerima notifikasi untuk menetapkan PIC secara manual.
                </p>
              )}
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => onNavigate('ticket-detail', createdTicket.id)}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#417F85] hover:bg-[#326A70] text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Lihat Detail & Lacak Progres</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setCreatedTicket(null);
                setTitle('');
                setDescription('');
                setAttachments([]);
              }}
              className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            >
              + Buat Tiket Lain
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-[#F5FAFA] p-5 rounded-xl border border-[#D5E0E3] shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-[#20272B] tracking-tight">
              Buat Tiket Layanan HXMS
            </h1>
            <span className="bg-[#E7EFF1] text-[#35666D] text-[11px] font-bold px-2 py-0.5 rounded-full border border-[#D5E0E3]">
              FOKUS SISTEM PEMBELAJARAN
            </span>
          </div>
          <p className="text-xs text-[#69777D] mt-1">
            Laporkan kendala akun, modul pembelajaran, ujian daring, materi diklat, dan sinkronisasi kelas HXMS di 11 UPDL & PLN Corpu.
          </p>
        </div>

        {/* Reporter info badge with UPDL Unit */}
        <div className="p-2.5 bg-[#E7EFF1] rounded-xl border border-[#D5E0E3] text-xs text-[#20272B] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#417F85] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
            {currentUser.name.charAt(0)}
          </div>
          <div>
            <span className="font-bold text-[#20272B] block leading-tight">{currentUser.name}</span>
            <span className="text-[11px] text-[#35666D] font-semibold block">
              {currentUser.unitName || 'PLN UPDL Jakarta'} ({currentUser.unitCode || 'UPDL_JKT'})
            </span>
          </div>
        </div>
      </div>

      {/* Contextual UPDL Unit Banner if initiated from specific UPDL page */}
      {effectiveUnit && (
        <div className="bg-[#E7EFF1] border border-[#417F85]/40 p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-[#417F85] text-white rounded-lg shadow-2xs shrink-0">
              <Building2 className="w-4 h-4" />
            </span>
            <div>
              <span className="font-extrabold text-[#20272B] block">
                Konteks Unit Otomatis: {effectiveUnit.unitName} ({effectiveUnit.unitCode})
              </span>
              <p className="text-[11px] text-[#69777D] mt-0.5">
                Tiket ini dibuat dan dikaitkan khusus untuk wilayah {effectiveUnit.unitRegion} ({effectiveUnit.unitFocus}).
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold bg-white text-[#35666D] border border-[#D5E0E3] px-2.5 py-1 rounded-full shrink-0">
            Unit Terkunci
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Form Fields */}
        <div className="lg:col-span-2 space-y-5">
          {/* Section 1: Informasi Laporan & Komponen HXMS */}
          <div className="bg-[#F5FAFA] p-5 rounded-xl border border-[#D5E0E3] shadow-2xs space-y-4">
            <div className="border-b border-[#D5E0E3] pb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#20272B] flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#417F85]" />
                1. Rincian Laporan Kendala Pembelajaran (HXMS)
              </h2>
              {!isReporter && (
                <span className="text-[10px] text-[#35666D] bg-[#E7EFF1] px-2 py-0.5 rounded font-bold border border-[#D5E0E3]">
                  Auto-Assigned to PIC
                </span>
              )}
            </div>

            {/* Judul Tiket */}
            <div>
              <label className="block text-xs font-bold text-[#20272B] mb-1">
                Subjek / Judul Kendala <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Peserta diklat kelas Leadership Academy gagal membuka modul silabus HXMS"
                className="w-full text-xs px-3 py-2 bg-[#FFFFFF] border border-[#D5E0E3] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#417F85] focus:bg-white text-[#20272B] placeholder:text-[#69777D] font-medium shadow-2xs"
              />
            </div>

            {/* Jenis Tiket & Kategori */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#20272B] mb-1">
                  Jenis Laporan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TicketType)}
                  className="w-full text-xs px-3 py-2 bg-[#FFFFFF] border border-[#D5E0E3] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] font-medium shadow-2xs"
                >
                  <option value="Insiden">Insiden (Kerusakan / Gangguan Sistem)</option>
                  <option value="Keluhan">Keluhan (Akses Lambat / Masalah Akses)</option>
                  <option value="Permintaan Layanan">Permintaan Layanan (Aktivasi / Reset Akun)</option>
                  <option value="Permintaan Perubahan">Permintaan Perubahan (Jadwal Ujian / Materi)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#20272B] mb-1">
                  Kategori Layanan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                  }}
                  className="w-full text-xs px-3 py-2 bg-[#FFFFFF] border border-[#D5E0E3] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#35666D] font-bold shadow-2xs"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.id === 'cat-lms' || cat.name.toLowerCase().includes('hxms')
                        ? `★ ${cat.code ? `${cat.code} - ` : ''}${cat.name} (Fokus Utama)`
                        : `${cat.code ? `${cat.code} - ` : ''}${cat.name}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Komponen HXMS & Subkategori Berdasarkan Komponen */}
            <div className="p-3.5 bg-[#E7EFF1] rounded-xl border border-[#D5E0E3] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#35666D] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#417F85]" />
                  Struktur Komponen & Subkategori HXMS
                </span>
                <span className="text-[10px] text-[#69777D]">Kategori: Sistem Pembelajaran</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#20272B] mb-1">
                    Komponen Layanan HXMS <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedComponentId}
                    onChange={(e) => {
                      const newCompId = e.target.value;
                      setSelectedComponentId(newCompId);
                      const targetComp = HXMS_COMPONENTS.find((c) => c.id === newCompId);
                      if (targetComp && targetComp.subcategories.length > 0) {
                        setSubcategoryId(targetComp.subcategories[0]);
                      }
                    }}
                    className="w-full text-xs px-3 py-2 bg-white border border-[#D5E0E3] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] font-bold shadow-2xs"
                  >
                    {HXMS_COMPONENTS.map((comp) => (
                      <option key={comp.id} value={comp.id}>
                        {comp.name} ({comp.code})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#69777D] mt-1 leading-tight">
                    {selectedComponent?.description}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#20272B] mb-1">
                    Subkategori (Berdasarkan Komponen) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={subcategoryId}
                    onChange={(e) => setSubcategoryId(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-[#D5E0E3] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] font-semibold shadow-2xs"
                  >
                    {subcategories.map((sub, idx) => (
                      <option key={idx} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-[#35666D] mt-1 font-medium">
                    ✓ Subkategori disinkronkan otomatis dari komponen {selectedComponent?.name}.
                  </p>
                </div>
              </div>
            </div>

            {/* Unit Asal Pelapor (Terkunci Sesuai Akun Terverifikasi) & Lokasi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#20272B] mb-1 flex items-center justify-between">
                  <span>Asal Unit Pelapor (Terkunci)</span>
                  <span className="text-[10px] text-[#35666D] font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3 text-[#417F85]" /> Akun Terverifikasi
                  </span>
                </label>
                <div className="w-full text-xs px-3 py-2 bg-white border border-[#D5E0E3] rounded-lg text-[#20272B] font-semibold flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2 truncate">
                    <MapPin className="w-3.5 h-3.5 text-[#417F85] shrink-0" />
                    <span className="truncate">{currentUser.unitName || 'PLN Corporate University'}</span>
                  </div>
                  <OriginUnitBadge unitType={currentUser.unitType || (currentUser.unitId === 'unit-pln-corpu' ? 'CORPU' : 'UPDL')} size="sm" />
                </div>
                <p className="text-[10px] text-[#69777D] mt-1">
                  Kode: {currentUser.unitCode || 'PLN_CORPU'} · Asal unit otomatis ditentukan oleh profil akun pelapor (tidak dapat dimanipulasi).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#20272B] mb-1">
                  Ruangan / Lab Diklat / Sesi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Contoh: Lab Komputer Lt. 2, Ruang Sesi Diklat"
                  className="w-full text-xs px-3 py-2 bg-[#FFFFFF] border border-[#D5E0E3] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#417F85] focus:bg-white text-[#20272B] placeholder:text-[#69777D] font-medium shadow-2xs"
                />
              </div>
            </div>

            {/* Aset / Kode Modul / Sesi Pembelajaran */}
            <div>
              <label className="block text-xs font-bold text-[#20272B] mb-1">
                ID Modul / Kode Kursus / Referensi Sesi <span className="text-[#69777D] font-normal">(Opsional)</span>
              </label>
              <input
                type="text"
                value={assetReference}
                onChange={(e) => setAssetReference(e.target.value)}
                placeholder="Contoh: MOD-LEAD-2026, UJIAN-POST-01, atau Sesi Kelas Batch 4"
                className="w-full text-xs px-3 py-2 bg-[#FFFFFF] border border-[#D5E0E3] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#417F85] focus:bg-white text-[#20272B] placeholder:text-[#69777D] font-medium shadow-2xs"
              />
            </div>

            {/* Deskripsi Lengkap */}
            <div>
              <label className="block text-xs font-bold text-[#20272B] mb-1">
                Deskripsi Kendala Pembelajaran Secara Rinci <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Jelaskan secara rinci kronologi kendala pada sistem HXMS, nama peserta yang terdampak, pesan galat yang muncul di layar, atau rincian permohonan Anda..."
                className="w-full text-xs p-3 bg-[#FFFFFF] border border-[#D5E0E3] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#417F85] focus:bg-white text-[#20272B] placeholder:text-[#69777D] leading-relaxed font-medium shadow-2xs"
              />
            </div>

            {/* Service & Assignment Notice */}
            {isReporter ? (
              <div className="p-3 bg-[#E7EFF1] rounded-xl border border-[#D5E0E3] flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#FFFFFF] text-[#417F85] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Shield className="w-4 h-4 text-[#417F85]" />
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-[#20272B]">
                    Layanan Bantuan Terpadu PLN Corporate University
                  </div>
                  <p className="text-[11px] text-[#35666D] leading-relaxed">
                    Laporan kendala Anda akan langsung diverifikasi dan ditindaklanjuti oleh petugas Helpdesk secara tepat waktu sesuai standar layanan korporat.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-[#E7EFF1] rounded-xl border border-[#D5E0E3] flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#FFFFFF] text-[#417F85] flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Sparkles className="w-4 h-4 text-[#417F85]" />
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-bold text-[#20272B] flex items-center gap-1.5">
                    <span>Penugasan Otomatis (Auto Assignment Engine)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                      Aktif
                    </span>
                  </div>
                  <p className="text-[11px] text-[#35666D] leading-relaxed">
                    Tiket akan langsung diteruskan secara otomatis ke <strong>Dimas Aditya (PIC 3 · Application Support & HXMS)</strong>. Pelapor tidak perlu memilih PIC secara manual dan klasifikasi prioritas ditentukan oleh standar ITIL sistem.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Lampiran & Bukti Pendukung */}
          <div className="bg-[#F5FAFA] p-5 rounded-xl border border-[#D5E0E3] shadow-2xs space-y-3">
            <h2 className="text-sm font-bold text-[#20272B] flex items-center gap-2 border-b border-[#D5E0E3] pb-3">
              <Paperclip className="w-4 h-4 text-[#417F85]" />
              3. Bukti Pendukung & Tangkapan Layar
            </h2>

            <div className="border-2 border-dashed border-[#D5E0E3] hover:border-[#417F85] rounded-xl p-4 text-center bg-white transition-colors">
              <input
                type="file"
                multiple
                id="file-upload"
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center justify-center gap-1.5 text-xs text-[#20272B]"
              >
                <Paperclip className="w-6 h-6 text-[#69777D]" />
                <span className="font-semibold text-[#417F85] hover:underline">
                  Klik untuk unggah berkas atau tangkapan layar
                </span>
                <span className="text-[11px] text-[#69777D]">
                  Format gambar (PNG, JPG) atau PDF (Maksimal 10MB per berkas)
                </span>
              </label>
            </div>

            {attachments.length > 0 && (
              <div className="space-y-1.5 pt-2">
                {attachments.map((att, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 bg-white border border-[#D5E0E3] rounded-lg text-xs"
                  >
                    <span className="font-medium text-[#20272B] truncate max-w-sm flex items-center gap-2">
                      <Paperclip className="w-3.5 h-3.5 text-[#69777D]" />
                      {att.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#69777D] font-mono-numbers">{(att.size / 1024).toFixed(1)} KB</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="text-rose-500 hover:text-rose-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Live Calculation & Preview Summary */}
        <div className="space-y-5">
          {/* Server-generated ticket number notice */}
          <div className="bg-[#F5FAFA] p-5 rounded-xl border border-[#D5E0E3] shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#20272B] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#417F85]" />
                Nomor Tiket
              </h3>
              <span className="text-[10px] font-bold text-[#35666D] bg-[#E7EFF1] border border-[#D5E0E3] px-2 py-0.5 rounded-full">
                Database
              </span>
            </div>
            <div className="p-2.5 bg-[#E7EFF1] rounded-lg border border-[#D5E0E3] text-[11px] text-[#35666D] flex items-start gap-2">
              <Info className="w-4 h-4 text-[#417F85] shrink-0 mt-0.5" />
              <span>
                Nomor unik diterbitkan oleh database setelah laporan berhasil disimpan.
              </span>
            </div>
          </div>

          {/* Panel Waktu Layanan & Aksi Submit (Sederhana untuk Pelapor / Lengkap untuk Internal) */}
          {isReporter ? (
            <div className="bg-[#F5FAFA] p-5 rounded-xl border border-[#D5E0E3] shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#D5E0E3] pb-3">
                <h3 className="text-xs font-bold text-[#20272B] uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#417F85]" />
                  Estimasi Waktu Penanganan
                </h3>
                <span className="text-[10px] font-bold text-[#35666D] bg-[#E7EFF1] border border-[#D5E0E3] px-2 py-0.5 rounded-full">
                  Komitmen SLA
                </span>
              </div>

              {/* SLA Target Metrics Card */}
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#D5E0E3] shadow-2xs">
                  <span className="text-[#69777D] font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    Estimasi Target Respons:
                  </span>
                  <span className="font-bold text-[#20272B] font-mono-numbers text-xs bg-[#E7EFF1] px-2.5 py-1 rounded-md border border-[#D5E0E3]">
                    15 Menit
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#D5E0E3] shadow-2xs">
                  <span className="text-[#69777D] font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#417F85] shrink-0"></span>
                    Estimasi Batas Selesai:
                  </span>
                  <span className="font-bold text-[#20272B] font-mono-numbers text-xs bg-[#E7EFF1] px-2.5 py-1 rounded-md border border-[#D5E0E3]">
                    4 Jam Kerja
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-[#E7EFF1] rounded-lg border border-[#D5E0E3] text-[11px] text-[#35666D] flex items-start gap-2">
                <Info className="w-4 h-4 text-[#417F85] shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Laporan Anda akan segera diproses oleh Helpdesk selama jam operasional kerja resmi PLN Corporate University.
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-[#417F85] hover:bg-[#326A70] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 btn-press"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{isSubmitting ? 'Menerbitkan Tiket...' : 'Kirim Laporan Tiket Resmi'}</span>
              </button>
            </div>
          ) : (
            <div className="bg-[#F5FAFA] p-5 rounded-xl border border-[#D5E0E3] shadow-2xs space-y-4">
              <h3 className="text-xs font-bold text-[#69777D] uppercase tracking-wider">
                Kalkulasi Prioritas Otomatis
              </h3>

              <div className="p-4 rounded-xl border border-[#D5E0E3] bg-[#E7EFF1] text-center space-y-2">
                <span className="text-[11px] text-[#35666D] font-semibold block">Tingkat Prioritas ITIL Otomatis:</span>
                <div className="flex justify-center">
                  <PriorityBadge priority={calculatedPriority} size="lg" />
                </div>
                <p className="text-[11px] text-[#69777D] leading-tight pt-1">
                  Ditentukan sistem berdasarkan komponen <strong className="text-[#20272B]">{selectedComponent?.name}</strong> dan jenis <strong className="text-[#20272B]">{type}</strong>.
                </p>
              </div>

              {/* SLA & Assignment Preview */}
              <div className="space-y-2 text-xs border-t border-[#D5E0E3] pt-3">
                {selectedCat.code && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#69777D]">Kode Kategori:</span>
                    <span className="font-mono text-[11px] font-bold text-[#35666D] bg-[#E7EFF1] px-2 py-0.5 rounded border border-[#D5E0E3]">
                      {selectedCat.code}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[#69777D]">Petugas Penanganan:</span>
                  <span className="font-bold text-[#35666D] truncate max-w-[170px] text-right">
                    Dimas Aditya (PIC 3 · HXMS)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#69777D]">Tim Penanggung Jawab:</span>
                  <span className="font-semibold text-[#20272B]">
                    Application Support & HXMS
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#69777D]">Estimasi Target Respons:</span>
                  <span className="font-semibold text-[#20272B] font-mono-numbers">
                    15 Menit
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#69777D]">Estimasi Batas Selesai:</span>
                  <span className="font-semibold text-[#20272B] font-mono-numbers">
                    4 Jam Kerja
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-[#417F85] hover:bg-[#326A70] disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer mt-4 btn-press"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{isSubmitting ? 'Menerbitkan Tiket...' : 'Kirim Laporan Tiket Resmi'}</span>
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
