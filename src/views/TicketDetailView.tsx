import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Clock,
  User,
  Shield,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Send,
  MessageSquare,
  FileText,
  Activity,
  Layers,
  Check,
  X,
  Lock,
  Globe,
  Tag,
  MapPin,
  Laptop,
  Flame,
  Printer,
  ChevronRight,
  Eye,
  AlertCircle,
  HelpCircle,
  ShieldAlert,
  Copy,
} from 'lucide-react';
import {
  Ticket,
  User as UserType,
  ActivityLog,
  Comment,
  Progress,
  PriorityLevel,
  TicketStatus,
} from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { PriorityBadge } from '../components/common/PriorityBadge';
import { getSlaStatus } from '../utils/slaCalculator';
import { sortPicUsers, formatPicDisplayName } from '../utils/picHelpers';
import { formatTicketNumberDisplay } from '../utils/ticketHelpers';
import { OriginUnitBadge } from '../utils/unitHelpers';
import { UPDL_UNITS, CORPU_UNIT, NON_UPDL_UNITS } from '../data/unitsData';
import { Building2 } from 'lucide-react';
import {
  addTicketComment,
  addTicketProgress,
  assignTicket,
  getTicket,
  listAssignablePics,
  listTicketActivity,
  listTicketComments,
  listTicketProgress,
  updateTicketStatus,
} from '../services/ticketApiService';

interface TicketDetailViewProps {
  ticketId: string;
  currentUser: UserType;
  onNavigate: (view: string, ticketId?: string) => void;
  onBack: () => void;
}

export const TicketDetailView: React.FC<TicketDetailViewProps> = ({
  ticketId,
  currentUser,
  onNavigate,
  onBack,
}) => {
  const [ticket, setTicket] = useState<Ticket | undefined>();
  const [isLoadingTicket, setIsLoadingTicket] = useState(true);
  const [picUsers, setPicUsers] = useState<UserType[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [progresses, setProgresses] = useState<Progress[]>([]);
  const [activeTab, setActiveTab] = useState<'ringkasan' | 'progres' | 'komentar' | 'audit' | 'solusi'>('ringkasan');

  // Input states
  const [newComment, setNewComment] = useState('');
  const [commentVisibility, setCommentVisibility] = useState<'public' | 'internal'>('public');
  const [newProgressMsg, setNewProgressMsg] = useState('');
  const [progressVisibility, setProgressVisibility] = useState<'public' | 'internal'>('public');

  // Modals state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedPicId, setSelectedPicId] = useState('');
  const [assignReason, setAssignReason] = useState('');

  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [newPriority, setNewPriority] = useState<PriorityLevel>('Tinggi');
  const [priorityChangeReason, setPriorityChangeReason] = useState('');

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionText, setResolutionText] = useState('');

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [copiedTicketNumber, setCopiedTicketNumber] = useState(false);

  // Admin Asal Unit Classification State
  const [showClassifyModal, setShowClassifyModal] = useState(false);
  const [targetClassifyUnitId, setTargetClassifyUnitId] = useState('unit-updl-jkt');

  const handleCopyTicket = (num: string) => {
    navigator.clipboard.writeText(formatTicketNumberDisplay(num));
    setCopiedTicketNumber(true);
    setTimeout(() => setCopiedTicketNumber(false), 2000);
  };

  const loadTicketData = async () => {
    if (!ticketId || ticketId.trim() === '' || ticketId.toUpperCase() === 'ALL' || ticketId === 'undefined' || ticketId === 'null') {
      setTicket(undefined);
      setIsLoadingTicket(false);
      return;
    }
    setIsLoadingTicket(true);
    try {
      const loadedTicket = await getTicket(ticketId);
      setTicket(loadedTicket || undefined);
      if (!loadedTicket) {
        setActivityLogs([]);
        setComments([]);
        setProgresses([]);
        setPicUsers([]);
        return;
      }
      const [logs, loadedComments, loadedProgresses, assignablePics] = await Promise.all([
        listTicketActivity(loadedTicket.id),
        listTicketComments(loadedTicket.id),
        listTicketProgress(loadedTicket.id),
        currentUser.role === 'admin' ? listAssignablePics(loadedTicket.id) : Promise.resolve([]),
      ]);
      setActivityLogs(logs);
      setComments(loadedComments);
      setProgresses(loadedProgresses);
      setPicUsers(sortPicUsers(assignablePics));
    } catch (error) {
      setTicket(undefined);
      setActivityLogs([]);
      setComments([]);
      setProgresses([]);
      setPicUsers([]);
    } finally {
      setIsLoadingTicket(false);
    }
  };

  useEffect(() => {
    const refresh = () => void loadTicketData();
    void loadTicketData();
    window.addEventListener('ticket-data-changed', refresh);
    return () => window.removeEventListener('ticket-data-changed', refresh);
  }, [ticketId, currentUser.uid, currentUser.role]);

  // 1. Error State: Invalid Parameter ID
  const isInvalidParam =
    !ticketId ||
    ticketId.trim() === '' ||
    ticketId.toUpperCase() === 'ALL' ||
    ticketId.toLowerCase() === 'undefined' ||
    ticketId.toLowerCase() === 'null';

  if (isInvalidParam) {
    return (
      <div className="bg-white p-8 sm:p-12 text-center rounded-2xl border border-amber-200 shadow-sm max-w-lg mx-auto my-8 space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-slate-800">Parameter Tiket Tidak Valid</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Sistem menerima permintaan halaman detail tanpa nomor atau ID tiket yang sah (diterima: <code className="bg-amber-50 text-amber-800 font-mono px-1 py-0.5 rounded font-bold">{ticketId || '(kosong)'}</code>).
        </p>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            onClick={onBack}
            className="w-full sm:w-auto px-4 py-2 bg-[#417F85] text-white rounded-lg text-xs font-bold hover:bg-[#326A70] transition-colors cursor-pointer"
          >
            Kembali ke Daftar Tiket
          </button>
          <button
            onClick={() => onNavigate('dashboard')}
            className="w-full sm:w-auto px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Buka Dashboard
          </button>
        </div>
      </div>
    );
  }

  // 2. Error State: Ticket Not Found in Database
  if (isLoadingTicket) {
    return <div className="py-16 text-center text-sm font-semibold text-slate-500">Memuat tiket dari database...</div>;
  }

  if (!ticket) {
    return (
      <div className="bg-white p-8 sm:p-12 text-center rounded-2xl border border-slate-200 shadow-sm max-w-lg mx-auto my-8 space-y-4">
        <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto border border-slate-200">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-base font-bold text-slate-800">Tiket Tidak Ditemukan</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Tiket dengan nomor atau ID <span className="font-mono font-bold text-[#35666D] bg-[#E7EFF1] px-1.5 py-0.5 rounded border border-[#D5E0E3]">{ticketId}</span> tidak ditemukan dalam basis data sistem PLN Corporate University.
        </p>
        <p className="text-[11px] text-slate-400">
          Tiket mungkin telah dihapus, dipindahkan ke arsip lama, atau URL yang Anda buka mengandung karakter yang keliru.
        </p>
        <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            onClick={loadTicketData}
            className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Coba Lagi (Muat Ulang)</span>
          </button>
          <button
            onClick={onBack}
            className="w-full sm:w-auto px-4 py-2 bg-[#417F85] text-white rounded-lg text-xs font-bold hover:bg-[#326A70] transition-colors cursor-pointer"
          >
            Kembali ke Daftar Tiket
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser.role === 'admin';
  const isPic = currentUser.role === 'pic';
  const isPelapor = currentUser.role === 'pelapor';
  const isManajemen = currentUser.role === 'manajemen';
  const isAssignedPic = ticket.currentPicId === currentUser.uid;
  const isReporter = ticket.reporterId === currentUser.uid;

  // Enforce strict access control:
  // - Admin & Manajemen can access all tickets
  // - Pelapor can ONLY access their own reported tickets
  // - PIC can ONLY access tickets assigned to their account
  const isAuthorized = isAdmin || isManajemen || (isPelapor && isReporter) || (isPic && isAssignedPic);

  // Auto-redirect if unauthorized (Anti-IDOR protection)
  useEffect(() => {
    if (ticket && !isAuthorized) {
      const redirectTarget = isPelapor ? 'my-tickets' : 'dashboard';
      onNavigate(redirectTarget);
    }
  }, [ticket, isAuthorized, isPelapor, onNavigate]);

  if (!isAuthorized) {
    return null;
  }

  const sla = getSlaStatus(ticket.createdAt, ticket.dueAt, ticket.status, ticket.resolvedAt);

  // --- Handlers ---
  const reportActionError = (error: unknown) => {
    alert(error instanceof Error ? error.message : 'Perubahan gagal disimpan ke database.');
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await addTicketComment({
        ticketId: ticket.id,
        authorId: currentUser.uid,
        message: newComment.trim(),
        visibility: commentVisibility,
      });
      setNewComment('');
      void loadTicketData();
    } catch (error) {
      reportActionError(error);
    }
  };

  const handleAddProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProgressMsg.trim()) return;
    try {
      await addTicketProgress({
        ticketId: ticket.id,
        authorId: currentUser.uid,
        message: newProgressMsg.trim(),
        statusBefore: ticket.status,
        statusAfter: ticket.status,
        visibility: progressVisibility,
      });
      setNewProgressMsg('');
      void loadTicketData();
    } catch (error) {
      reportActionError(error);
    }
  };

  // Admin Actions
  const handleVerifyTicket = async () => {
    try {
      await updateTicketStatus(ticket.id, 'Diverifikasi', 'Tiket diverifikasi valid oleh Admin Helpdesk.');
      void loadTicketData();
    } catch (error) {
      reportActionError(error);
    }
  };

  const handleAssignPic = async (e: React.FormEvent) => {
    e.preventDefault();
    const pic = picUsers.find((p) => p.uid === selectedPicId);
    if (!pic) return;
    try {
      await assignTicket(ticket.id, pic.uid, assignReason);
      setShowAssignModal(false);
      setSelectedPicId('');
      setAssignReason('');
      void loadTicketData();
    } catch (error) {
      reportActionError(error);
    }
  };

  const handleChangePriority = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!priorityChangeReason.trim()) {
      alert('Wajib mengisi alasan penyesuaian prioritas untuk audit.');
      return;
    }

    try {
      await updateTicketStatus(ticket.id, ticket.status, `Prioritas diubah ke ${newPriority}.`, {
        priority: newPriority,
        priorityChangeReason: priorityChangeReason.trim(),
      });
      setShowPriorityModal(false);
      setPriorityChangeReason('');
      void loadTicketData();
    } catch (error) {
      reportActionError(error);
    }
  };

  const handleRejectTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      alert('Wajib menyertakan alasan penolakan tiket.');
      return;
    }

    try {
      await updateTicketStatus(ticket.id, 'Ditolak', `Tiket ditolak. Alasan: ${rejectReason.trim()}`, {
        rejectionReason: rejectReason.trim(),
      });
      setShowRejectModal(false);
      setRejectReason('');
      void loadTicketData();
    } catch (error) {
      reportActionError(error);
    }
  };

  // PIC Actions
  const handleStartWork = async () => {
    try {
      await updateTicketStatus(ticket.id, 'Dalam Proses', `Petugas ${currentUser.name} mulai menangani tiket.`);
      void loadTicketData();
    } catch (error) {
      reportActionError(error);
    }
  };

  const handleRequestInfo = async () => {
    const msg = prompt('Jelaskan informasi tambahan apa yang dibutuhkan dari pelapor:');
    if (!msg || !msg.trim()) return;

    try {
      await updateTicketStatus(ticket.id, 'Menunggu Pelapor', `Menunggu data tambahan dari pelapor: "${msg.trim()}"`);
      await addTicketComment({
        ticketId: ticket.id,
        authorId: currentUser.uid,
        message: `[MOHON INFORMASI TAMBAHAN]: ${msg.trim()}`,
        visibility: 'public',
      });
      void loadTicketData();
    } catch (error) {
      reportActionError(error);
    }
  };

  const handleSetWaitingVendor = async () => {
    const vendor = prompt('Nama vendor / pihak ketiga yang dikoordinasikan (misal: Icon+, Cisco, Vendor AC):');
    if (!vendor) return;

    try {
      await updateTicketStatus(ticket.id, 'Menunggu Pihak Ketiga', `Eskalasi ke pihak ketiga / vendor: ${vendor}`);
      void loadTicketData();
    } catch (error) {
      reportActionError(error);
    }
  };

  const handleResolveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolutionText.trim()) {
      alert('Mohon tuliskan solusi teknis dan tindakan yang telah dilakukan.');
      return;
    }

    try {
      await updateTicketStatus(ticket.id, 'Selesai', `Tiket diselesaikan. Solusi: ${resolutionText.trim()}`, {
        resolution: resolutionText.trim(),
      });
      setShowResolveModal(false);
      setResolutionText('');
      setActiveTab('solusi');
      void loadTicketData();
    } catch (error) {
      reportActionError(error);
    }
  };

  // Reporter Actions
  const handleConfirmClose = async () => {
    if (confirm('Apakah Anda mengonfirmasi kendala telah terselesaikan dengan baik dan tiket dapat ditutup?')) {
      try {
        await updateTicketStatus(ticket.id, 'Ditutup', 'Pelapor mengonfirmasi hasil penyelesaian dan tiket resmi ditutup.');
        void loadTicketData();
      } catch (error) {
        reportActionError(error);
      }
    }
  };

  const handleReopenTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim()) {
      alert('Wajib mengisi alasan pembukaan kembali tiket.');
      return;
    }

    try {
      await updateTicketStatus(ticket.id, 'Dalam Proses', `Tiket dibuka kembali oleh pelapor. Alasan: ${reopenReason.trim()}`);
      setShowReopenModal(false);
      setReopenReason('');
      void loadTicketData();
    } catch (error) {
      reportActionError(error);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Header & Breadcrumb */}
      <div className="bg-[#F5FAFA] p-5 rounded-xl border border-[#D5E0E3] shadow-2xs space-y-3">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between text-xs text-[#69777D]">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 font-semibold text-[#417F85] hover:text-[#326A70] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Daftar Tiket</span>
          </button>
          <div className="flex items-center gap-2">
            <span>Tiket</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#69777D]" />
            <span className="font-mono font-bold text-[#35666D] bg-[#E7EFF1] border border-[#D5E0E3] px-2 py-0.5 rounded">
              {formatTicketNumberDisplay(ticket.ticketNumber)}
            </span>
          </div>
        </div>

        {/* Ticket Title & Quick Actions Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex items-center gap-2 bg-[#E7EFF1] text-[#35666D] border border-[#D5E0E3] px-3 py-1 rounded-xl shadow-2xs font-mono font-extrabold text-base sm:text-lg">
                <span>{formatTicketNumberDisplay(ticket.ticketNumber)}</span>
                <button
                  type="button"
                  onClick={() => handleCopyTicket(ticket.ticketNumber)}
                  className="p-1 rounded text-[#417F85] hover:text-[#35666D] hover:bg-[#D5E0E3] transition-colors cursor-pointer"
                  title="Salin nomor tiket"
                >
                  {copiedTicketNumber ? (
                    <Check className="w-4 h-4 text-[#417F85]" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              <StatusBadge status={ticket.status} size="md" />
              <PriorityBadge priority={ticket.priority} size="md" />
              <span className="text-xs bg-[#E7EFF1] text-[#35666D] px-2 py-0.5 rounded-md font-semibold border border-[#D5E0E3]">
                {ticket.type}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold text-[#20272B] leading-tight">
              {ticket.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-mono-numbers pt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Dibuat: {new Date(ticket.createdAt).toLocaleString('id-ID')}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Target SLA: {new Date(ticket.dueAt).toLocaleString('id-ID')}
              </span>
              <span className="flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                {ticket.categoryName}
              </span>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Admin: Verifikasi */}
            {isAdmin && ticket.status === 'Baru' && (
              <button
                onClick={handleVerifyTicket}
                className="px-3 py-1.5 bg-[#417F85] hover:bg-[#326A70] text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Verifikasi Laporan</span>
              </button>
            )}

            {/* Admin: Assign / Reassign PIC */}
            {isAdmin && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="px-3 py-1.5 bg-[#417F85] hover:bg-[#326A70] text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{ticket.currentPicId ? 'Ganti PIC' : 'Tugaskan PIC'}</span>
              </button>
            )}

            {/* Admin: Ubah Prioritas */}
            {isAdmin && (
              <button
                onClick={() => {
                  setNewPriority(ticket.priority);
                  setShowPriorityModal(true);
                }}
                className="px-3 py-1.5 bg-[#FFFFFF] border border-[#D5E0E3] text-[#20272B] hover:bg-[#E7EFF1] rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Flame className="w-3.5 h-3.5 text-orange-500" />
                <span>Ubah Prioritas</span>
              </button>
            )}

            {/* PIC: Terima Penugasan */}
            {(isPic || isAdmin) && ticket.status === 'Ditugaskan' && (
              <button
                onClick={handleStartWork}
                className="px-3.5 py-1.5 bg-[#417F85] hover:bg-[#326A70] text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Terima Tugas & Mulai Penanganan</span>
              </button>
            )}

            {/* PIC: Minta Info Tambahan */}
            {(isPic || isAdmin) && ticket.status === 'Dalam Proses' && (
              <button
                onClick={handleRequestInfo}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Minta Info Pelapor</span>
              </button>
            )}

            {/* PIC: Eskalasi Vendor */}
            {(isPic || isAdmin) && ticket.status === 'Dalam Proses' && (
              <button
                onClick={handleSetWaitingVendor}
                className="px-3 py-1.5 bg-[#35666D] hover:bg-[#20272B] text-white rounded-lg text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Koordinasi Vendor</span>
              </button>
            )}

            {/* PIC: Selesaikan Tiket */}
            {(isPic || isAdmin) && ['Dalam Proses', 'Menunggu Pelapor', 'Menunggu Pihak Ketiga'].includes(ticket.status) && (
              <button
                onClick={() => setShowResolveModal(true)}
                className="px-3.5 py-1.5 bg-[#417F85] hover:bg-[#326A70] text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Selesaikan Tiket</span>
              </button>
            )}

            {/* Pelapor: Konfirmasi Selesai & Tutup */}
            {ticket.status === 'Selesai' && (
              <button
                onClick={handleConfirmClose}
                className="px-3.5 py-1.5 bg-[#417F85] hover:bg-[#326A70] text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Konfirmasi & Tutup Tiket</span>
              </button>
            )}

            {/* Pelapor / Admin: Ajukan Buka Kembali (Reopen) */}
            {(ticket.status === 'Selesai' || ticket.status === 'Ditutup') && (
              <button
                onClick={() => setShowReopenModal(true)}
                className="px-3 py-1.5 bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Buka Kembali (Reopen)</span>
              </button>
            )}

            {/* Admin: Tolak Tiket */}
            {isAdmin && ['Baru', 'Diverifikasi'].includes(ticket.status) && (
              <button
                onClick={() => setShowRejectModal(true)}
                className="px-3 py-1.5 bg-white border border-rose-300 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Tolak Laporan</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Left Tabs & Right Summary Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column (2 Cols): 5 Interactive Tabs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs Navigation Bar */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="flex items-center border-b border-slate-200 overflow-x-auto px-3 bg-slate-50/70">
              {[
                { id: 'ringkasan', label: '1. Ringkasan Kendala', icon: FileText },
                { id: 'progres', label: '2. Progres Penanganan', icon: Activity, count: progresses.length },
                { id: 'komentar', label: '3. Komentar & Diskusi', icon: MessageSquare, count: comments.length },
                { id: 'audit', label: '4. Riwayat Aktivitas', icon: Clock, count: activityLogs.length },
                { id: 'solusi', label: '5. Solusi Akhir', icon: CheckCircle2 },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                      isActive
                        ? 'border-emerald-700 text-emerald-800 bg-white font-bold'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {typeof tab.count === 'number' && (
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-mono-numbers">
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab 1: Ringkasan Kendala */}
            {activeTab === 'ringkasan' && (
              <div className="p-5 space-y-5">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Deskripsi Lengkap
                  </h3>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                    {ticket.description}
                  </div>
                </div>

                {/* Additional parameters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                      Lokasi Pelaporan:
                    </span>
                    <p className="font-semibold text-slate-900">{ticket.location}</p>
                  </div>

                  <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <Laptop className="w-3.5 h-3.5 text-emerald-700" />
                      Aset / Perangkat Terkait:
                    </span>
                    <p className="font-semibold text-slate-900 font-mono-numbers">
                      {ticket.assetReference || 'Tidak dispesifikasikan'}
                    </p>
                  </div>
                </div>

                {/* Rejection / Priority changes alert if any */}
                {ticket.rejectionReason && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      Alasan Penolakan Tiket:
                    </span>
                    <p>{ticket.rejectionReason}</p>
                  </div>
                )}

                {ticket.priorityChangeReason && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-amber-600" />
                      Catatan Penyesuaian Prioritas (Admin):
                    </span>
                    <p>{ticket.priorityChangeReason}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Progres Penanganan */}
            {activeTab === 'progres' && (
              <div className="p-5 space-y-5">
                {/* Form to add progress (PIC & Admin) */}
                {(isPic || isAdmin) && (
                  <form onSubmit={handleAddProgress} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-emerald-700" />
                      Catat Update Progres Penanganan Baru
                    </h3>
                    <textarea
                      rows={2}
                      value={newProgressMsg}
                      onChange={(e) => setNewProgressMsg(e.target.value)}
                      placeholder="Tuliskan tindakan teknis yang baru saja Anda lakukan (contoh: Pengecekan konektor PoE, pengetesan IP gateway, restart service)..."
                      className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600 text-slate-900"
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={progressVisibility === 'internal'}
                          onChange={(e) => setProgressVisibility(e.target.checked ? 'internal' : 'public')}
                          className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                        />
                        <span className="flex items-center gap-1">
                          <Lock className="w-3 h-3 text-amber-600" />
                          Hanya Catatan Internal (Sembunyikan dari Pelapor)
                        </span>
                      </label>
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                      >
                        Simpan Update Progres
                      </button>
                    </div>
                  </form>
                )}

                {/* Progress Timeline */}
                <div className="space-y-4">
                  {progresses.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      Belum ada pembaruan progres teknis yang dicatat untuk tiket ini.
                    </div>
                  ) : (
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {progresses.map((prg) => {
                        const isInternal = prg.visibility === 'internal';
                        // If viewer is reporter and progress is internal, hide it
                        if (isReporter && !isAdmin && !isPic && isInternal) return null;

                        return (
                          <div key={prg.id} className="relative">
                            <span className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-emerald-600 ring-4 ring-white" />
                            <div
                              className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                                isInternal
                                  ? 'bg-amber-50/60 border-amber-200'
                                  : 'bg-white border-slate-200 shadow-2xs'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">{prg.authorName}</span>
                                  <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                    {prg.authorRole}
                                  </span>
                                  {isInternal && (
                                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded flex items-center gap-1">
                                      <Lock className="w-2.5 h-2.5" />
                                      INTERNAL PIC
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-slate-400 font-mono-numbers">
                                  {new Date(prg.createdAt).toLocaleString('id-ID')}
                                </span>
                              </div>
                              <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                                {prg.message}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Komentar & Percakapan */}
            {activeTab === 'komentar' && (
              <div className="p-5 space-y-5">
                {/* Comments List */}
                <div className="space-y-3.5 max-h-96 overflow-y-auto pr-1">
                  {comments.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      Belum ada percakapan pada tiket ini. Tulis tanggapan Anda di bawah.
                    </div>
                  ) : (
                    comments.map((comment) => {
                      const isInternal = comment.visibility === 'internal';
                      // If reporter views an internal note, don't show
                      if (isReporter && !isAdmin && !isPic && isInternal) return null;

                      const isMine = comment.authorId === currentUser.uid;

                      return (
                        <div
                          key={comment.id}
                          className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                            isInternal
                              ? 'bg-amber-50/70 border-amber-200'
                              : isMine
                              ? 'bg-emerald-50/50 border-emerald-200'
                              : 'bg-white border-slate-200 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{comment.authorName}</span>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded uppercase">
                                {comment.authorRole}
                              </span>
                              {isInternal && (
                                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" />
                                  CATATAN INTERNAL
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono-numbers">
                              {new Date(comment.createdAt).toLocaleString('id-ID')}
                            </span>
                          </div>
                          <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                            {comment.message}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Add Comment Input */}
                <form onSubmit={handleAddComment} className="pt-2 border-t border-slate-200 space-y-3">
                  <textarea
                    rows={3}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Ketik balasan pesan atau informasi lanjutan..."
                    className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white text-slate-900"
                  />
                  <div className="flex items-center justify-between">
                    {(isAdmin || isPic) ? (
                      <div className="flex items-center gap-4 text-xs">
                        <label className="flex items-center gap-1.5 text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="visibility"
                            checked={commentVisibility === 'public'}
                            onChange={() => setCommentVisibility('public')}
                            className="text-emerald-700"
                          />
                          <span>Komentar Publik</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-amber-800 font-semibold cursor-pointer">
                          <input
                            type="radio"
                            name="visibility"
                            checked={commentVisibility === 'internal'}
                            onChange={() => setCommentVisibility('internal')}
                            className="text-amber-600"
                          />
                          <span className="flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            Catatan Internal PIC
                          </span>
                        </label>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        Pesan Anda dapat dibaca oleh PIC dan Admin Helpdesk
                      </span>
                    )}

                    <button
                      type="submit"
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Kirim Pesan</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Tab 4: Riwayat Aktivitas & Audit Trail */}
            {activeTab === 'audit' && (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span className="font-semibold text-slate-700">Riwayat Perubahan Sistem</span>
                  <span className="font-mono-numbers">{activityLogs.length} Entri Tercatat</span>
                </div>

                <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="relative text-xs">
                      <span className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-slate-400 ring-4 ring-white" />
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{log.action.replace(/_/g, ' ')}</span>
                            <span className="text-[10px] text-slate-500">oleh {log.actorName}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono-numbers">
                            {new Date(log.createdAt).toLocaleString('id-ID')}
                          </span>
                        </div>
                        {log.details && <p className="text-slate-600">{log.details}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 5: Solusi Akhir & Penyelesaian */}
            {activeTab === 'solusi' && (
              <div className="p-5 space-y-5">
                {ticket.resolution ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          Solusi Penyelesaian Resmi
                        </span>
                        {ticket.resolvedAt && (
                          <span className="text-[11px] text-emerald-800 font-mono-numbers">
                            Diselesaikan: {new Date(ticket.resolvedAt).toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-emerald-950 whitespace-pre-wrap leading-relaxed font-medium">
                        {ticket.resolution}
                      </p>
                    </div>

                    {ticket.status === 'Selesai' && isReporter && (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-3">
                        <p className="text-xs text-slate-700">
                          Apakah kendala Anda sudah benar-benar terselesaikan dengan solusi di atas?
                        </p>
                        <div className="flex justify-center gap-3">
                          <button
                            onClick={handleConfirmClose}
                            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                          >
                            Ya, Konfirmasi & Tutup Tiket
                          </button>
                          <button
                            onClick={() => setShowReopenModal(true)}
                            className="px-4 py-2 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-lg cursor-pointer"
                          >
                            Belum Tuntas (Buka Kembali)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                    <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-medium text-slate-600">Tiket ini belum diselesaikan.</p>
                    <p className="text-slate-400 max-w-sm mx-auto">
                      Solusi teknis akan dicatat oleh petugas PIC setelah penanganan dan verifikasi di lapangan
                      berhasil dilakukan.
                    </p>
                    {(isPic || isAdmin) && (
                      <button
                        onClick={() => setShowResolveModal(true)}
                        className="mt-3 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Catat Solusi Sekarang</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Ticket Metadata & SLA Card (Inspired by Image 3) */}
        <div className="space-y-4">
          {/* Details Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4 text-xs">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
              Rincian Tiket
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-slate-500">Nama Pelapor:</span>
                <span className="font-bold text-slate-900 text-right">{ticket.reporterName}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-slate-500">Asal Unit:</span>
                <div className="text-right flex flex-col items-end gap-1">
                  <span className="font-bold text-[#172B4D]">
                    {ticket.reporterUnitName || 'Belum Terklasifikasi'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <OriginUnitBadge unitType={ticket.reporterUnitType} size="sm" />
                    {ticket.reporterUnitType === 'UNCLASSIFIED' && isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setTargetClassifyUnitId('unit-updl-jkt');
                          setShowClassifyModal(true);
                        }}
                        className="text-[10px] text-[#2589E8] hover:text-[#1765B3] font-bold underline cursor-pointer"
                      >
                        (Klasifikasikan)
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-slate-500">Departemen:</span>
                <span className="font-semibold text-slate-800 text-right">{ticket.department}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-slate-500">Petugas PIC:</span>
                <span className="font-bold text-slate-900 text-right">
                  {ticket.currentPicName ? (
                    <span className="text-emerald-800 font-bold">
                      {formatPicDisplayName(ticket.currentPicId, ticket.currentPicName)}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Belum Ditugaskan</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-slate-500">Tim PIC:</span>
                <span className="font-semibold text-slate-800 text-right">
                  {ticket.currentPicTeam || '-'}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-slate-500">Kategori:</span>
                <div className="text-right">
                  {ticket.categoryCode && (
                    <span className="inline-block font-mono text-[10px] font-bold text-[#1765B3] bg-[#EFF8FF] border border-[#B8DEFF] px-1.5 py-0.5 rounded mr-1.5 shadow-2xs">
                      {ticket.categoryCode}
                    </span>
                  )}
                  <span className="font-semibold text-slate-800">{ticket.categoryName}</span>
                </div>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-slate-500">Subkategori:</span>
                <span className="font-semibold text-slate-800 text-right">{ticket.subcategoryName}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-slate-500">Tingkat Dampak:</span>
                <span className="font-semibold text-slate-800 text-right">{ticket.impact}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-slate-500">Tingkat Urgensi:</span>
                <span className="font-semibold text-slate-800 text-right">{ticket.urgency}</span>
              </div>
            </div>
          </div>

          {/* Timeline & SLA Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3 text-xs">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
              Kepatuhan SLA (Service Level)
            </h3>

            {/* SLA Progress Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between font-mono-numbers">
                <span className="font-bold text-slate-700">Waktu SLA Berjalan</span>
                <span className="font-bold text-slate-900">{sla.percentElapsed}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className={`h-full transition-all duration-500 ${
                    sla.isOverdue
                      ? 'bg-rose-600'
                      : sla.isNearingBreach
                      ? 'bg-amber-500'
                      : 'bg-emerald-600'
                  }`}
                  style={{ width: `${Math.min(100, sla.percentElapsed)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-slate-400">Target Durasi: {sla.totalDurationHours} Jam</span>
                <span
                  className={`font-bold font-mono-numbers ${
                    sla.isOverdue
                      ? 'text-rose-600'
                      : sla.isNearingBreach
                      ? 'text-amber-600'
                      : 'text-emerald-700'
                  }`}
                >
                  {sla.remainingFormatted}
                </span>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 space-y-2 text-[11px] text-slate-600 font-mono-numbers">
              <div className="flex justify-between">
                <span>Dibuat:</span>
                <span className="font-semibold">{new Date(ticket.createdAt).toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between">
                <span>Tenggat Resolusi:</span>
                <span className="font-semibold">{new Date(ticket.dueAt).toLocaleString('id-ID')}</span>
              </div>
              {ticket.resolvedAt && (
                <div className="flex justify-between text-teal-700 font-semibold">
                  <span>Selesai:</span>
                  <span>{new Date(ticket.resolvedAt).toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {ticket.tags && ticket.tags.length > 0 && (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {ticket.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL 1: Assign PIC Modal --- */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-backdrop">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DCEAF7] space-y-4 animate-modal-enter">
            <h3 className="text-base font-bold text-slate-900">
              Penetapan Petugas PIC
            </h3>
            <p className="text-xs text-slate-500">
              Pilih petugas PIC yang kompeten untuk menangani tiket {formatTicketNumberDisplay(ticket.ticketNumber)}.
            </p>

            <form onSubmit={handleAssignPic} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Pilih Petugas PIC <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedPicId}
                  onChange={(e) => setSelectedPicId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                >
                  <option value="">-- Pilih Petugas PIC --</option>
                  {picUsers.map((pic) => (
                    <option key={pic.uid} value={pic.uid}>
                      {formatPicDisplayName(pic.uid, pic.name)} · {pic.team} ({pic.expertise?.slice(0, 2).join(', ')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Instruksi / Alasan Penugasan
                </label>
                <input
                  type="text"
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  placeholder="Contoh: Sesuai keahlian Access Point dan jadwal piket Lt. 3"
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-lg hover:bg-emerald-800 cursor-pointer"
                >
                  Tugaskan Sekarang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: Change Priority Modal --- */}
      {showPriorityModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-backdrop">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DCEAF7] space-y-4 animate-modal-enter">
            <h3 className="text-base font-bold text-slate-900">
              Penyesuaian Prioritas Tiket
            </h3>
            <p className="text-xs text-slate-500">
              Perubahan prioritas akan dicatat di Audit Trail dan mempengaruhi batas waktu SLA.
            </p>

            <form onSubmit={handleChangePriority} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Prioritas Baru <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as PriorityLevel)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                >
                  <option value="Kritis">Kritis (SLA 4 Jam)</option>
                  <option value="Tinggi">Tinggi (SLA 12 Jam)</option>
                  <option value="Sedang">Sedang (SLA 24 Jam)</option>
                  <option value="Rendah">Rendah (SLA 48 Jam)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Alasan Penyesuaian Prioritas <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={priorityChangeReason}
                  onChange={(e) => setPriorityChangeReason(e.target.value)}
                  placeholder="Jelaskan alasan penyesuaian (misal: Ada kelas diklat direksi yang sedang berlangsung)..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPriorityModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-lg hover:bg-emerald-800 cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 3: Resolve Ticket Modal --- */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-backdrop">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#DCEAF7] space-y-4 animate-modal-enter">
            <h3 className="text-base font-bold text-slate-900">
              Penyelesaian Tiket & Dokumentasi Solusi
            </h3>
            <p className="text-xs text-slate-500">
              Jelaskan tindakan teknis yang telah berhasil menyelesaikan kendala agar pelapor dapat memvalidasi.
            </p>

            <form onSubmit={handleResolveTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Solusi & Tindakan Akhir <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="Contoh: Kabel UTP cat6 pada port switch 14 telah diganti baru. Sinyal AP kembali stabil dengan SNR 32dB dan 40 peserta telah terkoneksi kembali..."
                  className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-700 text-white text-xs font-bold rounded-lg hover:bg-teal-800 cursor-pointer"
                >
                  Tandai Selesai & Kirim Solusi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 4: Reject Ticket Modal --- */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-backdrop">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DCEAF7] space-y-4 animate-modal-enter">
            <h3 className="text-base font-bold text-rose-700">
              Tolak Laporan Tiket
            </h3>
            <p className="text-xs text-slate-500">
              Tiket yang ditolak harus menyertakan alasan yang jelas kepada pelapor.
            </p>

            <form onSubmit={handleRejectTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Alasan Penolakan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Contoh: Laporan terindikasi duplikat dengan tiket #JAIT-10-2026-001 yang sedang ditangani..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 cursor-pointer"
                >
                  Konfirmasi Tolak Tiket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 5: Reopen Ticket Modal --- */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-backdrop">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DCEAF7] space-y-4 animate-modal-enter">
            <h3 className="text-base font-bold text-slate-900">
              Ajukan Pembukaan Kembali Tiket (Reopen)
            </h3>
            <p className="text-xs text-slate-500">
              Tiket akan dikembalikan ke status Dalam Proses untuk penanganan ulang oleh PIC.
            </p>

            <form onSubmit={handleReopenTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Alasan Pembukaan Kembali <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Contoh: Kendala Wi-Fi masih kambuh dan sinyal sering drop kembali setelah 15 menit..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-lg hover:bg-emerald-800 cursor-pointer"
                >
                  Buka Kembali Tiket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
