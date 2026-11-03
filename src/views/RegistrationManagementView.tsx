import React, { useState, useMemo, useEffect } from 'react';
import {
  UserCheck,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Shield,
  ShieldCheck,
  Mail,
  Phone,
  Building,
  Briefcase,
  AlertCircle,
  FileCheck,
  RefreshCw,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  ArrowRight,
  FileText,
  CheckSquare,
  Square,
  MinusSquare,
  CheckCheck,
  RotateCcw,
  Layers,
  AlertTriangle,
  Download,
  Copy,
  SlidersHorizontal,
} from 'lucide-react';
import {
  User,
  Role,
  RegistrationRequest,
  RegistrationStatus,
  BatchProcessSummary,
  BatchProcessItemResult,
  Unit,
} from '../types';
import {
  approveRegistration,
  listRegistrationRequests,
  listRegistrationUnits,
  rejectRegistration,
} from '../services/registrationApiService';

interface RegistrationManagementViewProps {
  currentUser: User;
  onNavigate: (view: string, id?: string) => void;
  initialSelectedId?: string | null;
}

export const RegistrationManagementView: React.FC<RegistrationManagementViewProps> = ({
  currentUser,
  onNavigate,
  initialSelectedId,
}) => {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Single Selection / Modals
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSingleApproveDialog, setShowSingleApproveDialog] = useState(false);
  const [showSingleRejectDialog, setShowSingleRejectDialog] = useState(false);

  // Form states for single approval & rejection
  const [assignedRole, setAssignedRole] = useState<Role>('pelapor');
  const [assignedUnitId, setAssignedUnitId] = useState<string>('unit-updl-jkt');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // ==========================================
  // MULTI-SELECTION & BATCH ACTIONS STATE
  // ==========================================
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectAllFiltered, setIsSelectAllFiltered] = useState(false);

  // Batch Modals
  const [showBulkApproveDialog, setShowBulkApproveDialog] = useState(false);
  const [showBulkRejectDialog, setShowBulkRejectDialog] = useState(false);
  const [bulkAssignedRole, setBulkAssignedRole] = useState<Role>('pelapor');
  const [bulkRejectionReason, setBulkRejectionReason] = useState('');
  const [bulkTargetIds, setBulkTargetIds] = useState<string[]>([]);
  const [bulkTargetScopeDescription, setBulkTargetScopeDescription] = useState('');

  // Live Batch Progress Indicator
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    currentItem: string;
    action: 'APPROVE' | 'REJECT';
    percent: number;
  }>({
    current: 0,
    total: 0,
    currentItem: '',
    action: 'APPROVE',
    percent: 0,
  });

  // Batch Summary / Results Report Modal
  const [batchSummary, setBatchSummary] = useState<BatchProcessSummary | null>(null);
  const [summaryFilterTab, setSummaryFilterTab] = useState<'ALL' | 'SUCCESS' | 'FAILED' | 'SKIPPED'>('ALL');
  const [summarySearchQuery, setSummarySearchQuery] = useState('');

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const triggerToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const refreshData = async () => {
    try {
      const [registrationRequests, masterUnits] = await Promise.all([
        listRegistrationRequests(),
        listRegistrationUnits(),
      ]);
      setRequests(registrationRequests);
      setUnits(masterUnits);
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : 'Gagal memuat permohonan dari database.', 'error');
    }
  };

  useEffect(() => {
    void refreshData();
  }, []);

  // Handle auto-open when navigated from notification
  useEffect(() => {
    if (initialSelectedId) {
      const found = requests.find((request) => request.id === initialSelectedId);
      if (found) {
        setSelectedRequest(found);
        setShowDetailModal(true);
      }
    }
  }, [initialSelectedId, requests]);

  const isPending = (status: RegistrationStatus) =>
    status === 'PENDING' || status === 'Menunggu Verifikasi';
  const isApproved = (status: RegistrationStatus) =>
    status === 'APPROVED' || status === 'Disetujui';
  const isRejected = (status: RegistrationStatus) =>
    status === 'REJECTED' || status === 'Ditolak';

  // System-wide statistics
  const stats = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => isPending(r.status)).length;
    const approved = requests.filter((r) => isApproved(r.status)).length;
    const rejected = requests.filter((r) => isRejected(r.status)).length;
    return { total, pending, approved, rejected };
  }, [requests]);

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PENDING' && !isPending(r.status)) return false;
        if (statusFilter === 'APPROVED' && !isApproved(r.status)) return false;
        if (statusFilter === 'REJECTED' && !isRejected(r.status)) return false;
      }

      // Unit filter
      if (unitFilter !== 'ALL') {
        if (r.unitId !== unitFilter && r.unitCode !== unitFilter) return false;
      }

      // Search query (Nama, NIP, Email, or ID)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mName = r.fullName.toLowerCase().includes(q);
        const mNip = r.employeeId.toLowerCase().includes(q);
        const mEmail = r.corporateEmail.toLowerCase().includes(q);
        const mId = r.id.toLowerCase().includes(q);
        const mUnit = r.unitName.toLowerCase().includes(q);
        if (!mName && !mNip && !mEmail && !mId && !mUnit) return false;
      }

      return true;
    });
  }, [requests, statusFilter, unitFilter, searchQuery]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / itemsPerPage));
  const paginatedRequests = filteredRequests.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Compute selection metrics
  const pendingInFiltered = useMemo(() => {
    return filteredRequests.filter((r) => isPending(r.status));
  }, [filteredRequests]);

  const totalSelectedCount = isSelectAllFiltered
    ? filteredRequests.length
    : selectedIds.size;

  // Selected items that are actually PENDING (eligible for processing)
  const selectedPendingIds = useMemo(() => {
    if (isSelectAllFiltered) {
      return pendingInFiltered.map((r) => r.id);
    }
    return filteredRequests
      .filter((r) => selectedIds.has(r.id) && isPending(r.status))
      .map((r) => r.id);
  }, [isSelectAllFiltered, pendingInFiltered, filteredRequests, selectedIds]);

  // Checkbox helpers for current page
  const isPageAllSelected =
    paginatedRequests.length > 0 &&
    paginatedRequests.every((r) => selectedIds.has(r.id));
  const isPageSomeSelected =
    paginatedRequests.some((r) => selectedIds.has(r.id)) && !isPageAllSelected;

  // Selection handlers
  const handleToggleRowSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setIsSelectAllFiltered(false);
  };

  const handleTogglePageSelection = () => {
    if (isPageAllSelected) {
      // Unselect all on current page
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedRequests.forEach((r) => next.delete(r.id));
        return next;
      });
      setIsSelectAllFiltered(false);
    } else {
      // Select all on current page
      setSelectedIds((prev) => {
        const next = new Set(prev);
        paginatedRequests.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const handleSelectAllFiltered = () => {
    const allIds = new Set(filteredRequests.map((r) => r.id));
    setSelectedIds(allIds);
    setIsSelectAllFiltered(true);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setIsSelectAllFiltered(false);
  };

  // ==========================================
  // BULK ACTION INITIATORS
  // ==========================================

  // 1. Setujui Semua (Seluruh Menunggu Verifikasi dalam cakupan filter)
  const handleInitiateApproveAll = () => {
    if (pendingInFiltered.length === 0) {
      triggerToast('Tidak ada permohonan berstatus Menunggu Verifikasi dalam filter saat ini.', 'info');
      return;
    }
    const targetIds = pendingInFiltered.map((r) => r.id);
    setBulkTargetIds(targetIds);
    setBulkAssignedRole('pelapor');
    setBulkTargetScopeDescription(
      `Seluruh ${targetIds.length} permohonan berstatus Menunggu Verifikasi sesuai filter saat ini`
    );
    setShowBulkApproveDialog(true);
  };

  // 2. Tolak Semua (Seluruh Menunggu Verifikasi dalam cakupan filter)
  const handleInitiateRejectAll = () => {
    if (pendingInFiltered.length === 0) {
      triggerToast('Tidak ada permohonan berstatus Menunggu Verifikasi dalam filter saat ini.', 'info');
      return;
    }
    const targetIds = pendingInFiltered.map((r) => r.id);
    setBulkTargetIds(targetIds);
    setBulkRejectionReason('');
    setBulkTargetScopeDescription(
      `Seluruh ${targetIds.length} permohonan berstatus Menunggu Verifikasi sesuai filter saat ini`
    );
    setShowBulkRejectDialog(true);
  };

  // 3. Setujui yang Dipilih
  const handleInitiateApproveSelected = () => {
    if (selectedPendingIds.length === 0) {
      triggerToast(
        'Pilih minimal satu permohonan berstatus Menunggu Verifikasi untuk disetujui.',
        'error'
      );
      return;
    }
    setBulkTargetIds(selectedPendingIds);
    setBulkAssignedRole('pelapor');
    setBulkTargetScopeDescription(
      `${selectedPendingIds.length} permohonan terpilih (dari total ${totalSelectedCount} baris yang dipilih)`
    );
    setShowBulkApproveDialog(true);
  };

  // 4. Tolak yang Dipilih
  const handleInitiateRejectSelected = () => {
    if (selectedPendingIds.length === 0) {
      triggerToast(
        'Pilih minimal satu permohonan berstatus Menunggu Verifikasi untuk ditolak.',
        'error'
      );
      return;
    }
    setBulkTargetIds(selectedPendingIds);
    setBulkRejectionReason('');
    setBulkTargetScopeDescription(
      `${selectedPendingIds.length} permohonan terpilih (dari total ${totalSelectedCount} baris yang dipilih)`
    );
    setShowBulkRejectDialog(true);
  };

  // ==========================================
  // BULK EXECUTION HANDLERS (BACKEND BATCHING)
  // ==========================================
  const handleExecuteBulkApprove = async () => {
    if (currentUser.role !== 'admin') {
      triggerToast('Akses ditolak: Hanya Administrator Ticketing yang berwenang.', 'error');
      return;
    }
    if (bulkTargetIds.length === 0) return;

    setShowBulkApproveDialog(false);
    setIsBatchRunning(true);
    setBatchProgress({
      current: 0,
      total: bulkTargetIds.length,
      currentItem: 'Menyiapkan pemrosesan batch...',
      action: 'APPROVE',
      percent: 0,
    });

    try {
      const startedAt = new Date().toISOString();
      const items: BatchProcessItemResult[] = [];
      for (const [index, requestId] of bulkTargetIds.entries()) {
        const request = requests.find((item) => item.id === requestId);
        let status: BatchProcessItemResult['status'] = 'FAILED';
        let reason: string | undefined;
        if (!request) {
          reason = 'Permohonan tidak ditemukan pada data database yang dimuat.';
        } else if (!isPending(request.status)) {
          status = 'SKIPPED';
          reason = 'Permohonan sudah diproses sebelumnya.';
        } else if (request.isManualUnit) {
          reason = 'Unit manual harus diverifikasi dan disetujui satu per satu.';
        } else {
          try {
            await approveRegistration(request, bulkAssignedRole, request.unitId);
            status = 'SUCCESS';
          } catch (error) {
            reason = error instanceof Error ? error.message : 'Persetujuan database gagal.';
          }
        }

        items.push({
          requestId,
          fullName: request?.fullName || 'Data Tidak Ditemukan',
          employeeId: request?.employeeId || '-',
          corporateEmail: request?.corporateEmail,
          unitName: request?.unitName,
          status,
          reason,
        });
        const current = index + 1;
        setBatchProgress({
          current,
          total: bulkTargetIds.length,
          currentItem: request ? `${request.fullName} (${request.employeeId})` : requestId,
          action: 'APPROVE',
          percent: Math.round((current / bulkTargetIds.length) * 100),
        });
      }
      const summary: BatchProcessSummary = {
        action: 'APPROVE',
        totalRequested: bulkTargetIds.length,
        successCount: items.filter((item) => item.status === 'SUCCESS').length,
        failedCount: items.filter((item) => item.status === 'FAILED').length,
        skippedCount: items.filter((item) => item.status === 'SKIPPED').length,
        items,
        startedAt,
        completedAt: new Date().toISOString(),
        actorName: currentUser.name,
        assignedRoleCommon: bulkAssignedRole,
      };

      void refreshData();
      handleClearSelection();
      setBatchSummary(summary);
      setSummaryFilterTab('ALL');
      setSummarySearchQuery('');
      triggerToast(
        `Persetujuan massal selesai: ${summary.successCount} berhasil diaktifkan, ${summary.failedCount} gagal, ${summary.skippedCount} dilewati.`,
        summary.failedCount > 0 ? 'info' : 'success'
      );
    } catch (err: any) {
      console.error('Batch approve error:', err);
      triggerToast(err?.message || 'Terjadi kesalahan sistem saat pemrosesan massal.', 'error');
    } finally {
      setIsBatchRunning(false);
    }
  };

  const handleExecuteBulkReject = async () => {
    if (currentUser.role !== 'admin') {
      triggerToast('Akses ditolak: Hanya Administrator Ticketing yang berwenang.', 'error');
      return;
    }
    const cleanReason = bulkRejectionReason.trim();
    if (!cleanReason || cleanReason.length < 5) {
      triggerToast('Mohon isi alasan penolakan yang jelas (minimal 5 karakter).', 'error');
      return;
    }
    if (bulkTargetIds.length === 0) return;

    setShowBulkRejectDialog(false);
    setIsBatchRunning(true);
    setBatchProgress({
      current: 0,
      total: bulkTargetIds.length,
      currentItem: 'Menyiapkan pemrosesan batch...',
      action: 'REJECT',
      percent: 0,
    });

    try {
      const startedAt = new Date().toISOString();
      const items: BatchProcessItemResult[] = [];
      for (const [index, requestId] of bulkTargetIds.entries()) {
        const request = requests.find((item) => item.id === requestId);
        let status: BatchProcessItemResult['status'] = 'FAILED';
        let reason: string | undefined;
        if (!request) {
          reason = 'Permohonan tidak ditemukan pada data database yang dimuat.';
        } else if (!isPending(request.status)) {
          status = 'SKIPPED';
          reason = 'Permohonan sudah diproses sebelumnya.';
        } else {
          try {
            await rejectRegistration(requestId, cleanReason);
            status = 'SUCCESS';
          } catch (error) {
            reason = error instanceof Error ? error.message : 'Penolakan database gagal.';
          }
        }

        items.push({
          requestId,
          fullName: request?.fullName || 'Data Tidak Ditemukan',
          employeeId: request?.employeeId || '-',
          corporateEmail: request?.corporateEmail,
          unitName: request?.unitName,
          status,
          reason,
        });
        const current = index + 1;
        setBatchProgress({
          current,
          total: bulkTargetIds.length,
          currentItem: request ? `${request.fullName} (${request.employeeId})` : requestId,
          action: 'REJECT',
          percent: Math.round((current / bulkTargetIds.length) * 100),
        });
      }
      const summary: BatchProcessSummary = {
        action: 'REJECT',
        totalRequested: bulkTargetIds.length,
        successCount: items.filter((item) => item.status === 'SUCCESS').length,
        failedCount: items.filter((item) => item.status === 'FAILED').length,
        skippedCount: items.filter((item) => item.status === 'SKIPPED').length,
        items,
        startedAt,
        completedAt: new Date().toISOString(),
        actorName: currentUser.name,
        rejectionReasonCommon: cleanReason,
      };

      void refreshData();
      handleClearSelection();
      setBatchSummary(summary);
      setSummaryFilterTab('ALL');
      setSummarySearchQuery('');
      triggerToast(
        `Penolakan massal selesai: ${summary.successCount} berhasil ditolak, ${summary.failedCount} gagal, ${summary.skippedCount} dilewati.`,
        summary.failedCount > 0 ? 'info' : 'success'
      );
    } catch (err: any) {
      console.error('Batch reject error:', err);
      triggerToast(err?.message || 'Terjadi kesalahan sistem saat pemrosesan massal.', 'error');
    } finally {
      setIsBatchRunning(false);
    }
  };

  // Retry Failed items from summary report
  const handleRetryFailedItems = () => {
    if (!batchSummary) return;
    const failedIds = batchSummary.items
      .filter((it) => it.status === 'FAILED')
      .map((it) => it.requestId);

    if (failedIds.length === 0) {
      triggerToast('Tidak ada permohonan yang gagal untuk dicoba ulang.', 'info');
      return;
    }

    setBatchSummary(null);
    setBulkTargetIds(failedIds);
    setBulkTargetScopeDescription(`${failedIds.length} permohonan yang sebelumnya gagal diproses`);

    if (batchSummary.action === 'APPROVE') {
      setBulkAssignedRole(batchSummary.assignedRoleCommon || 'pelapor');
      setShowBulkApproveDialog(true);
    } else {
      setBulkRejectionReason(batchSummary.rejectionReasonCommon || 'Data kepegawaian tidak sesuai');
      setShowBulkRejectDialog(true);
    }
  };

  // Export Batch Process Report as CSV
  const handleExportSummaryCSV = () => {
    if (!batchSummary) return;
    const actionLabel = batchSummary.action === 'APPROVE' ? 'Persetujuan' : 'Penolakan';
    const headers = ['No', 'ID Permohonan', 'Nama Pegawai', 'NIP', 'Email', 'Unit Kerja', 'Status Hasil', 'Keterangan/Alasan'];
    const rows = batchSummary.items.map((item, index) => [
      index + 1,
      `"${item.requestId}"`,
      `"${item.fullName.replace(/"/g, '""')}"`,
      `"${item.employeeId}"`,
      `"${item.corporateEmail || '-'}"`,
      `"${(item.unitName || 'PLN Corporate University').replace(/"/g, '""')}"`,
      `"${item.status === 'SUCCESS' ? 'Berhasil' : item.status === 'FAILED' ? 'Gagal' : 'Dilewati'}"`,
      `"${(item.reason || '-').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Aksi_Massal_${actionLabel}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast('Laporan hasil pemrosesan massal berhasil diunduh dalam format CSV.', 'success');
  };

  // Copy Summary text to Clipboard
  const handleCopySummary = () => {
    if (!batchSummary) return;
    const actionLabel = batchSummary.action === 'APPROVE' ? 'Persetujuan Akun' : 'Penolakan Permohonan';
    const text = [
      `=== RINGKASAN PEMROSESAN MASSAL REGISTRASI PLN CORPU ===`,
      `Aksi: ${actionLabel}`,
      `Oleh Admin: ${batchSummary.actorName}`,
      `Waktu Selesai: ${new Date(batchSummary.completedAt).toLocaleString('id-ID')}`,
      `Total Sasaran: ${batchSummary.totalRequested}`,
      `Berhasil: ${batchSummary.successCount}`,
      `Gagal: ${batchSummary.failedCount}`,
      `Dilewati: ${batchSummary.skippedCount}`,
      batchSummary.rejectionReasonCommon ? `Alasan Umum: ${batchSummary.rejectionReasonCommon}` : '',
      batchSummary.assignedRoleCommon ? `Peran Ditetapkan: ${batchSummary.assignedRoleCommon.toUpperCase()}` : '',
      `======================================================`,
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text).then(
      () => triggerToast('Ringkasan hasil berhasil disalin ke clipboard.', 'success'),
      () => triggerToast('Gagal menyalin ringkasan ke clipboard.', 'error')
    );
  };

  // Single Action handlers
  const handleOpenDetail = (req: RegistrationRequest) => {
    setSelectedRequest(req);
    if (req.isManualUnit) {
      setAssignedUnitId('');
    } else {
      setAssignedUnitId(req.unitId || 'unit-updl-jkt');
    }
    setShowDetailModal(true);
    setShowSingleApproveDialog(false);
    setShowSingleRejectDialog(false);
  };

  const handleExecuteSingleApproval = async () => {
    if (!selectedRequest) return;
    if (currentUser.role !== 'admin') {
      triggerToast('Akses ditolak: Hanya Administrator Ticketing yang berwenang.', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      const unitName = await approveRegistration(selectedRequest, assignedRole, assignedUnitId);
      void refreshData();
      triggerToast(
        `Permohonan ${selectedRequest.fullName} berhasil disetujui! Akun diaktifkan di ${unitName} dengan peran ${assignedRole.toUpperCase()}.`,
        'success'
      );
      setShowSingleApproveDialog(false);
      setShowDetailModal(false);
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Gagal menyetujui akun di database.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteSingleRejection = async () => {
    if (!selectedRequest) return;
    if (currentUser.role !== 'admin') {
      triggerToast('Akses ditolak: Hanya Administrator Ticketing yang berwenang.', 'error');
      return;
    }

    const cleanReason = rejectionReason.trim();
    if (!cleanReason || cleanReason.length < 5) {
      triggerToast('Mohon masukkan alasan penolakan yang jelas (minimal 5 karakter).', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      await rejectRegistration(selectedRequest.id, cleanReason);
      void refreshData();
      triggerToast(`Permohonan ${selectedRequest.fullName} telah ditolak. Alasan tersimpan dalam audit log.`, 'info');
      setShowSingleRejectDialog(false);
      setShowDetailModal(false);
    } catch (err) {
      triggerToast(err instanceof Error ? err.message : 'Gagal menolak akun di database.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick Corporate Rejection Templates
  const corporateRejectionTemplates = [
    'NIP tidak ditemukan dalam database HRMS kepegawaian PT PLN (Persero)',
    'Email yang didaftarkan bukan email korporat resmi PLN (@pln.co.id)',
    'Unit penugasan atau UPDL tidak sesuai dengan data kepegawaian aktif',
    'Duplikasi pendaftaran dengan data akun yang sudah aktif di portal helpdesk',
    'Permohonan akun fungsional memerlukan rekomendasi tertulis dari Kepala Bagian',
  ];

  return (
    <div className="space-y-6 animate-page-enter">
      {/* Header Banner */}
      <div className="bg-[#F5FAFA] p-6 rounded-2xl border border-[#D5E0E3] shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-[#417F85] text-white flex items-center justify-center shadow-xs">
              <UserCheck className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-extrabold text-[#20272B] tracking-tight">
              Permohonan Registrasi Karyawan
            </h1>
          </div>
          <p className="text-xs text-[#69777D] mt-1.5 max-w-2xl leading-relaxed">
            Kelola verifikasi identitas pegawai PLN, persetujuan dan penolakan massal skala ribuan permohonan, aktivasi akun, dan pencatatan audit log otomatis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('user-management')}
            className="px-3.5 py-2 bg-white hover:bg-[#E7EFF1] text-[#35666D] border border-[#D5E0E3] rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>Daftar Pengguna Aktif</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-[#D5E0E3] shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#69777D] uppercase tracking-wider">
              Total Permohonan
            </span>
            <span className="p-2 bg-[#E7EFF1] text-[#417F85] rounded-lg">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#20272B] font-mono-numbers">
              {stats.total.toLocaleString('id-ID')}
            </span>
            <span className="text-[11px] text-[#69777D]">Pengajuan</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-2xs bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Menunggu Verifikasi
            </span>
            <span className="p-2 bg-amber-100 text-amber-700 rounded-lg border border-amber-200">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-900 font-mono-numbers">
              {stats.pending.toLocaleString('id-ID')}
            </span>
            <span className="text-[11px] text-amber-700 font-medium">Perlu Keputusan</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs bg-emerald-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Permohonan Disetujui
            </span>
            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-900 font-mono-numbers">
              {stats.approved.toLocaleString('id-ID')}
            </span>
            <span className="text-[11px] text-emerald-700 font-medium">Akun Aktif</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs bg-rose-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
              Permohonan Ditolak
            </span>
            <span className="p-2 bg-rose-100 text-rose-700 rounded-lg border border-rose-200">
              <XCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-900 font-mono-numbers">
              {stats.rejected.toLocaleString('id-ID')}
            </span>
            <span className="text-[11px] text-rose-700 font-medium">Tidak Lolos</span>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-2xl border border-[#D5E0E3] shadow-2xs overflow-hidden space-y-0">
        {/* Filters Toolbar */}
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
                  handleClearSelection();
                }}
                placeholder="Cari berdasarkan nama, NIP, atau email..."
                className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D]"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    handleClearSelection();
                  }}
                  className="absolute right-2.5 top-2.5 text-[#69777D] hover:text-[#20272B] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                  handleClearSelection();
                }}
                className="text-xs py-2 px-3 bg-white border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] font-bold cursor-pointer"
              >
                <option value="ALL">Semua Permohonan</option>
                <option value="PENDING">Menunggu Verifikasi (Pending)</option>
                <option value="APPROVED">Disetujui (Approved)</option>
                <option value="REJECTED">Ditolak (Rejected)</option>
              </select>

              <select
                value={unitFilter}
                onChange={(e) => {
                  setUnitFilter(e.target.value);
                  setCurrentPage(1);
                  handleClearSelection();
                }}
                className="text-xs py-2 px-3 bg-white border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] font-medium max-w-[200px] cursor-pointer"
              >
                <option value="ALL">Semua Unit Kerja</option>
                {units.map((u) => (
                  <option key={u.unitId} value={u.unitId}>
                    {u.unitName}
                  </option>
                ))}
              </select>

              {(searchQuery || statusFilter !== 'ALL' || unitFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setUnitFilter('ALL');
                    setCurrentPage(1);
                    handleClearSelection();
                  }}
                  className="px-2.5 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-xl font-bold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 1: TOOLBAR AKSI MASSAL (BULK ACTIONS BAR) */}
        <div className="p-3.5 bg-gradient-to-r from-[#E7EFF1] to-[#F5FAFA] border-b border-[#D5E0E3] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Action Buttons Required: 1. Setujui Semua, 2. Tolak Semua, 3. Setujui yang Dipilih, 4. Tolak yang Dipilih, 5. Pilih Semua, 6. Batalkan Pilihan */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Setujui Semua */}
            <button
              onClick={handleInitiateApproveAll}
              disabled={pendingInFiltered.length === 0}
              className="px-3 py-1.5 bg-[#417F85] hover:bg-[#326A70] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Menyetujui seluruh permohonan Menunggu Verifikasi dalam cakupan filter aktif"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Setujui Semua ({pendingInFiltered.length})</span>
            </button>

            {/* 2. Tolak Semua */}
            <button
              onClick={handleInitiateRejectAll}
              disabled={pendingInFiltered.length === 0}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="Menolak seluruh permohonan Menunggu Verifikasi dalam cakupan filter aktif dengan alasan wajib"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Tolak Semua ({pendingInFiltered.length})</span>
            </button>

            <span className="h-5 w-px bg-[#D5E0E3] mx-1 hidden sm:inline-block" />

            {/* 3. Setujui yang Dipilih */}
            <button
              onClick={handleInitiateApproveSelected}
              disabled={selectedPendingIds.length === 0}
              className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Setujui hanya permohonan Menunggu Verifikasi yang telah dicentang"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Setujui yang Dipilih ({selectedPendingIds.length})</span>
            </button>

            {/* 4. Tolak yang Dipilih */}
            <button
              onClick={handleInitiateRejectSelected}
              disabled={selectedPendingIds.length === 0}
              className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-800 border border-rose-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Tolak permohonan Menunggu Verifikasi yang telah dicentang"
            >
              <X className="w-3.5 h-3.5 text-rose-600" />
              <span>Tolak yang Dipilih ({selectedPendingIds.length})</span>
            </button>

            <span className="h-5 w-px bg-[#D5E0E3] mx-1 hidden sm:inline-block" />

            {/* 5. Pilih Semua */}
            <button
              onClick={handleSelectAllFiltered}
              className="px-2.5 py-1.5 bg-white hover:bg-[#E7EFF1] text-[#35666D] border border-[#D5E0E3] rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1 transition-colors cursor-pointer"
              title="Pilih seluruh permohonan yang sesuai dengan filter saat ini"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Pilih Semua ({filteredRequests.length})</span>
            </button>

            {/* 6. Batalkan Pilihan */}
            {totalSelectedCount > 0 && (
              <button
                onClick={handleClearSelection}
                className="px-2.5 py-1.5 text-xs text-[#69777D] hover:text-[#20272B] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title="Batalkan seluruh baris yang sedang dipilih"
              >
                <X className="w-3 h-3" />
                <span>Batalkan Pilihan</span>
              </button>
            )}
          </div>

          {/* Indicator Info: Menunggu Verifikasi, Dipilih, Akan Diproses */}
          <div className="flex items-center gap-3 text-xs bg-white px-3 py-1.5 rounded-xl border border-[#D5E0E3] shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[#69777D]">Menunggu Verifikasi:</span>
              <span className="font-mono font-bold text-amber-900">
                {pendingInFiltered.length.toLocaleString('id-ID')}
              </span>
            </div>

            <span className="h-3 w-px bg-[#D5E0E3]" />

            <div className="flex items-center gap-1.5">
              <span className="text-[#69777D]">Dipilih:</span>
              <span className="font-mono font-bold text-[#35666D]">
                {totalSelectedCount.toLocaleString('id-ID')}
              </span>
            </div>

            <span className="h-3 w-px bg-[#D5E0E3]" />

            <div className="flex items-center gap-1.5">
              <span className="text-[#69777D]">Akan Diproses:</span>
              <span className="font-mono font-bold text-[#417F85]">
                {selectedPendingIds.length.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: SELECTION SCOPE BANNER (PILIH HALAMAN INI vs PILIH SEMUA HASIL) */}
        {isPageAllSelected && filteredRequests.length > paginatedRequests.length && !isSelectAllFiltered && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs animate-in fade-in">
            <div className="flex items-center gap-2 text-amber-900 font-medium">
              <Info className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                Seluruh <strong>{paginatedRequests.length}</strong> permohonan pada halaman ini telah dipilih. Ingin memilih seluruh <strong>{filteredRequests.length}</strong> hasil pencarian/filter?
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAllFiltered}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
              >
                Pilih Semua {filteredRequests.length} Hasil Filter
              </button>
              <button
                onClick={handleClearSelection}
                className="px-2 py-1 text-xs text-amber-900 hover:underline font-semibold cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {isSelectAllFiltered && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 flex items-center justify-between text-xs animate-in fade-in">
            <div className="flex items-center gap-2 text-emerald-900 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Seluruh <strong>{filteredRequests.length.toLocaleString('id-ID')}</strong> permohonan yang sesuai filter telah dipilih ({pendingInFiltered.length} siap diproses).
              </span>
            </div>
            <button
              onClick={handleClearSelection}
              className="text-xs text-emerald-800 hover:text-emerald-950 font-bold underline cursor-pointer"
            >
              Batalkan Pilihan
            </button>
          </div>
        )}

        {/* Table as required in Section 2 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#E7EFF1] border-b border-[#D5E0E3] text-[#35666D] font-bold uppercase tracking-wider text-[10px]">
                {/* Checkbox Header */}
                <th className="py-3 px-3 text-center w-10">
                  <button
                    type="button"
                    onClick={handleTogglePageSelection}
                    className="p-1 rounded hover:bg-white/60 text-[#35666D] cursor-pointer"
                    title={isPageAllSelected ? 'Batalkan pilihan halaman ini' : 'Pilih semua baris pada halaman ini'}
                  >
                    {isPageAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#417F85]" />
                    ) : isPageSomeSelected ? (
                      <MinusSquare className="w-4 h-4 text-[#417F85]" />
                    ) : (
                      <Square className="w-4 h-4 text-[#69777D]" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-2 text-center w-10">No.</th>
                <th className="py-3 px-4">Nama Karyawan</th>
                <th className="py-3 px-4">NIP</th>
                <th className="py-3 px-4">Email Korporat</th>
                <th className="py-3 px-4">Unit Kerja / UPDL</th>
                <th className="py-3 px-4">Tanggal Pendaftaran</th>
                <th className="py-3 px-4 text-center">Status Permohonan</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5E0E3]">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#69777D]">
                    <div className="max-w-xs mx-auto space-y-2">
                      <FileCheck className="w-8 h-8 text-[#69777D]/60 mx-auto" />
                      <p className="font-bold text-[#20272B]">Tidak Ada Permohonan Ditemukan</p>
                      <p className="text-[11px] text-[#69777D]">
                        {searchQuery || statusFilter !== 'ALL' || unitFilter !== 'ALL'
                          ? 'Tidak ada data registrasi yang sesuai dengan filter pencarian.'
                          : 'Belum ada permohonan registrasi karyawan baru yang masuk.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((req, idx) => {
                  const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
                  const isChecked = selectedIds.has(req.id);
                  const isRowPending = isPending(req.status);

                  return (
                    <tr
                      key={req.id}
                      className={`transition-colors ${
                        isChecked
                          ? 'bg-[#E7EFF1]/80 hover:bg-[#D5E0E3]/60'
                          : 'hover:bg-[#E7EFF1]/40'
                      }`}
                    >
                      {/* Row Checkbox */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleRowSelection(req.id)}
                          className="p-1 rounded hover:bg-white/70 text-[#35666D] cursor-pointer"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-[#417F85]" />
                          ) : (
                            <Square className="w-4 h-4 text-[#69777D]" />
                          )}
                        </button>
                      </td>

                      <td className="py-3.5 px-2 text-center font-mono font-bold text-[#69777D]">
                        {rowNumber}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#20272B]">{req.fullName}</div>
                        <div className="text-[11px] text-[#69777D]">{req.position}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-[#35666D] whitespace-nowrap">
                        {req.employeeId}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-[#20272B] font-medium">{req.corporateEmail}</div>
                        {req.phone && (
                          <div className="text-[11px] text-[#69777D] flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-[#417F85]" />
                            <span>{req.phone}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#20272B]">{req.unitName}</div>
                        <span className="text-[10px] bg-[#E7EFF1] text-[#35666D] px-1.5 py-0.2 rounded font-bold">
                          {req.unitType || 'UPDL'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap text-[#69777D]">
                        <div>
                          {new Date(req.submittedAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="text-[10px] text-[#69777D]">
                          {new Date(req.submittedAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          WIB
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isRowPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
                            <Clock className="w-3 h-3 text-amber-600" />
                            Menunggu Verifikasi
                          </span>
                        )}
                        {isApproved(req.status) && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Disetujui
                            </span>
                            {req.assignedRole && (
                              <div className="text-[10px] font-bold text-[#69777D] uppercase tracking-wider">
                                Role: {req.assignedRole}
                              </div>
                            )}
                          </div>
                        )}
                        {isRejected(req.status) && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            Ditolak
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleOpenDetail(req)}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 ml-auto cursor-pointer ${
                            isRowPending
                              ? 'bg-[#417F85] hover:bg-[#326A70] text-white'
                              : 'bg-white hover:bg-[#E7EFF1] text-[#35666D] border border-[#D5E0E3]'
                          }`}
                        >
                          {isRowPending ? (
                            <>
                              <Shield className="w-3.5 h-3.5" />
                              <span>Tinjau & Putuskan</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5" />
                              <span>Lihat Detail</span>
                            </>
                          )}
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
              {Math.min(currentPage * itemsPerPage, filteredRequests.length)} dari{' '}
              {filteredRequests.length} permohonan
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

      {/* ========================================================
          MODAL: KONFIRMASI PERSETUJUAN MASSAL (SECTION 3)
         ======================================================== */}
      {showBulkApproveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-[#D5E0E3] shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-200 text-[#20272B]">
            <div className="flex items-start justify-between border-b border-[#D5E0E3] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-300">
                  <CheckCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-[#20272B]">
                    Setujui Semua Permohonan?
                  </h3>
                  <p className="text-xs text-[#69777D]">
                    Konfirmasi persetujuan akun registrasi massal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkApproveDialog(false)}
                className="text-[#69777D] hover:text-[#20272B] p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900">Jumlah Permohonan:</span>
                <span className="font-mono font-extrabold text-sm text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                  {bulkTargetIds.length.toLocaleString('id-ID')} Permohonan
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Apakah Anda yakin ingin menyetujui seluruh <strong>{bulkTargetIds.length.toLocaleString('id-ID')} permohonan</strong> yang masih menunggu verifikasi? Akun yang berhasil diproses akan diaktifkan secara sah sesuai ketentuan akses perusahaan PLN Corporate University.
              </p>
              <div className="text-[10px] text-emerald-700 bg-white/70 p-2 rounded-lg border border-emerald-200">
                <strong>Catatan Keamanan:</strong> Hanya permohonan yang masih berstatus <em>Menunggu Verifikasi</em> yang akan diproses. Permohonan yang sudah disetujui atau ditolak sebelumnya akan otomatis dilewati secara idempotensial.
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-xs font-bold text-[#20272B] mb-1.5">
                Tetapkan Hak Akses (Role) Pengguna Baru <span className="text-rose-500">*</span>
              </label>
              <select
                value={bulkAssignedRole}
                onChange={(e) => setBulkAssignedRole(e.target.value as Role)}
                className="w-full text-xs py-2.5 px-3 bg-[#F5FAFA] border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] font-bold cursor-pointer"
              >
                <option value="pelapor">Pelapor 11 UPDL / Unit (Standar Pengguna Layanan - Direkomendasikan)</option>
                <option value="pic">Petugas PIC Helpdesk (Penanganan Kendala & Tiket)</option>
              </select>
              <p className="text-[10px] text-[#69777D] mt-1">
                Seluruh akun yang disetujui dalam batch ini akan mendapatkan hak akses peran di atas dan menerima kredensial masuk yang valid.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#D5E0E3]">
              <button
                type="button"
                onClick={() => setShowBulkApproveDialog(false)}
                className="px-4 py-2 text-xs font-bold text-[#69777D] hover:text-[#20272B] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkApprove}
                className="px-4 py-2 bg-[#417F85] hover:bg-[#326A70] active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-all"
              >
                <Check className="w-4 h-4" />
                <span>Ya, Setujui Semua ({bulkTargetIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: KONFIRMASI PENOLAKAN MASSAL (SECTION 4)
         ======================================================== */}
      {showBulkRejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-[#D5E0E3] shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-200 text-[#20272B]">
            <div className="flex items-start justify-between border-b border-[#D5E0E3] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center border border-rose-300">
                  <XCircle className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-[#20272B]">
                    Tolak Semua Permohonan?
                  </h3>
                  <p className="text-xs text-[#69777D]">
                    Konfirmasi penolakan registrasi massal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkRejectDialog(false)}
                className="text-[#69777D] hover:text-[#20272B] p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50/50 border border-rose-200 rounded-xl text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-900">Jumlah Target Penolakan:</span>
                <span className="font-mono font-extrabold text-sm text-rose-800 bg-white px-2 py-0.5 rounded border border-rose-200">
                  {bulkTargetIds.length.toLocaleString('id-ID')} Permohonan
                </span>
              </div>
              <p className="text-[11px] text-rose-800 leading-relaxed">
                Seluruh <strong>{bulkTargetIds.length.toLocaleString('id-ID')} permohonan</strong> yang masih menunggu verifikasi dalam cakupan ini akan ditolak. Masukkan alasan penolakan sebelum melanjutkan.
              </p>
            </div>

            {/* Mandatory Rejection Reason */}
            <div>
              <label className="block text-xs font-bold text-rose-900 mb-1.5">
                Alasan Penolakan yang Berlaku untuk Batch Ini <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={bulkRejectionReason}
                onChange={(e) => setBulkRejectionReason(e.target.value)}
                placeholder="Tuliskan alasan penolakan yang jelas (minimal 5 karakter)..."
                className="w-full text-xs p-3 bg-white border border-rose-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-[#20272B] placeholder:text-rose-300 font-medium"
              />

              {/* Corporate Quick Templates */}
              <div className="mt-2 space-y-1">
                <span className="text-[10px] font-bold text-[#69777D] block">
                  Template Alasan Cepat Resmi PLN:
                </span>
                <div className="flex flex-wrap gap-1">
                  {corporateRejectionTemplates.map((tmpl) => (
                    <button
                      key={tmpl}
                      type="button"
                      onClick={() => setBulkRejectionReason(tmpl)}
                      className="text-[10px] bg-[#E7EFF1] hover:bg-rose-50 text-[#35666D] hover:text-rose-800 border border-[#D5E0E3] px-2 py-0.5 rounded transition-colors cursor-pointer text-left"
                    >
                      + {tmpl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#D5E0E3]">
              <button
                type="button"
                onClick={() => setShowBulkRejectDialog(false)}
                className="px-4 py-2 text-xs font-bold text-[#69777D] hover:text-[#20272B] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!bulkRejectionReason.trim() || bulkRejectionReason.trim().length < 5}
                onClick={handleExecuteBulkReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-all"
              >
                <XCircle className="w-4 h-4" />
                <span>Ya, Tolak Semua ({bulkTargetIds.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: LIVE PROGRESS INDICATOR (SECTION 5 & 6)
         ======================================================== */}
      {isBatchRunning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#D5E0E3] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 text-[#20272B]">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-[#E7EFF1] text-[#417F85] flex items-center justify-center mx-auto border border-[#D5E0E3]">
                <RefreshCw className="w-6 h-6 animate-spin text-[#417F85]" />
              </div>
              <h3 className="font-extrabold text-base text-[#20272B]">
                {batchProgress.action === 'APPROVE'
                  ? 'Memproses Persetujuan Massal...'
                  : 'Memproses Penolakan Massal...'}
              </h3>
              <p className="text-xs text-[#69777D]">
                Memproses permohonan secara berkelompok (batch chunking) untuk menjaga konsistensi database dan performa browser.
              </p>
            </div>

            {/* Actual Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-[#35666D]">
                  Memproses permohonan: {batchProgress.current} dari {batchProgress.total}
                </span>
                <span className="font-mono text-[#417F85]">{batchProgress.percent}%</span>
              </div>
              <div className="w-full h-3 bg-[#E7EFF1] rounded-full overflow-hidden border border-[#D5E0E3]">
                <div
                  className="h-full bg-gradient-to-r from-[#417F85] to-emerald-500 rounded-full transition-all duration-150 ease-out"
                  style={{ width: `${Math.min(100, Math.max(2, batchProgress.percent))}%` }}
                />
              </div>
              <p className="text-[10px] text-[#69777D] truncate text-center pt-1">
                Sedang memproses: <span className="font-semibold text-[#20272B]">{batchProgress.currentItem}</span>
              </p>
            </div>

            <div className="p-3 bg-[#F5FAFA] rounded-xl border border-[#D5E0E3] text-[11px] text-[#69777D] text-center">
              Harap jangan menutup browser selama proses berlangsung. Seluruh akun yang disetujui akan diaktifkan secara otomatis.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: LAPORAN HASIL PEMROSESAN MASSAL (SECTION 6)
         ======================================================== */}
      {batchSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-[#D5E0E3] shadow-2xl max-w-3xl w-full p-6 space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col text-[#20272B]">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#D5E0E3] pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                    batchSummary.failedCount === 0
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  <FileCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-[#20272B]">
                    Ringkasan Hasil Pemrosesan Massal
                  </h3>
                  <p className="text-xs text-[#69777D]">
                    Tindakan: {batchSummary.action === 'APPROVE' ? 'Persetujuan Akun' : 'Penolakan Permohonan'} · Oleh {batchSummary.actorName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBatchSummary(null)}
                className="text-[#69777D] hover:text-[#20272B] p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-4 gap-2.5 shrink-0">
              <div className="p-3 bg-[#F5FAFA] rounded-xl border border-[#D5E0E3] text-center">
                <span className="text-[10px] font-bold text-[#69777D] uppercase block">Total Sasaran</span>
                <span className="text-lg font-black text-[#20272B] font-mono-numbers">
                  {batchSummary.totalRequested}
                </span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                  {batchSummary.action === 'APPROVE' ? 'Berhasil Disetujui' : 'Berhasil Ditolak'}
                </span>
                <span className="text-lg font-black text-emerald-900 font-mono-numbers">
                  {batchSummary.successCount}
                </span>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-center">
                <span className="text-[10px] font-bold text-rose-800 uppercase block">Gagal Diproses</span>
                <span className="text-lg font-black text-rose-900 font-mono-numbers">
                  {batchSummary.failedCount}
                </span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center">
                <span className="text-[10px] font-bold text-amber-800 uppercase block">Dilewati</span>
                <span className="text-lg font-black text-amber-900 font-mono-numbers">
                  {batchSummary.skippedCount}
                </span>
              </div>
            </div>

            {/* Filter Tabs & Search for Summary Items */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-b border-[#D5E0E3] pb-2 shrink-0">
              <div className="flex bg-[#E7EFF1] p-0.5 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setSummaryFilterTab('ALL')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    summaryFilterTab === 'ALL' ? 'bg-white text-[#20272B] shadow-2xs font-bold' : 'text-[#69777D]'
                  }`}
                >
                  Semua ({batchSummary.items.length})
                </button>
                <button
                  onClick={() => setSummaryFilterTab('SUCCESS')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    summaryFilterTab === 'SUCCESS' ? 'bg-white text-emerald-900 shadow-2xs font-bold' : 'text-[#69777D]'
                  }`}
                >
                  Sukses ({batchSummary.successCount})
                </button>
                <button
                  onClick={() => setSummaryFilterTab('FAILED')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    summaryFilterTab === 'FAILED' ? 'bg-white text-rose-900 shadow-2xs font-bold' : 'text-[#69777D]'
                  }`}
                >
                  Gagal ({batchSummary.failedCount})
                </button>
                <button
                  onClick={() => setSummaryFilterTab('SKIPPED')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    summaryFilterTab === 'SKIPPED' ? 'bg-white text-amber-900 shadow-2xs font-bold' : 'text-[#69777D]'
                  }`}
                >
                  Dilewati ({batchSummary.skippedCount})
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#69777D] absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={summarySearchQuery}
                  onChange={(e) => setSummarySearchQuery(e.target.value)}
                  placeholder="Cari dalam hasil..."
                  className="text-xs pl-8 pr-3 py-1 bg-[#F5FAFA] border border-[#D5E0E3] rounded-lg text-[#20272B]"
                />
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto border border-[#D5E0E3] rounded-xl divide-y divide-[#D5E0E3] max-h-72 text-xs">
              {batchSummary.items
                .filter((item) => {
                  if (summaryFilterTab !== 'ALL' && item.status !== summaryFilterTab) return false;
                  if (summarySearchQuery.trim()) {
                    const q = summarySearchQuery.toLowerCase();
                    return (
                      item.fullName.toLowerCase().includes(q) ||
                      item.employeeId.toLowerCase().includes(q) ||
                      item.requestId.toLowerCase().includes(q)
                    );
                  }
                  return true;
                })
                .map((item) => (
                  <div key={item.requestId} className="p-2.5 flex items-center justify-between gap-2 hover:bg-[#F5FAFA]">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#20272B]">{item.fullName}</span>
                        <span className="font-mono text-[10px] text-[#35666D] bg-[#E7EFF1] px-1 rounded">
                          {item.employeeId}
                        </span>
                        <span className="text-[10px] text-[#69777D]">{item.requestId}</span>
                      </div>
                      <div className="text-[11px] text-[#69777D]">
                        {item.unitName || 'PLN Corporate University'}
                        {item.reason && (
                          <span className="text-rose-600 block text-[10px]">Alasan/Keterangan: {item.reason}</span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                        item.status === 'SUCCESS'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : item.status === 'FAILED'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    >
                      {item.status === 'SUCCESS' ? 'Berhasil' : item.status === 'FAILED' ? 'Gagal' : 'Dilewati'}
                    </span>
                  </div>
                ))}
            </div>

            {/* Footer Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-[#D5E0E3] shrink-0">
              <span className="text-[11px] text-[#69777D]">
                Audit log telah tercatat di modul <strong>Audit Trail</strong>.
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySummary}
                  className="px-3 py-2 bg-white hover:bg-[#E7EFF1] text-[#35666D] border border-[#D5E0E3] rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Salin ringkasan hasil pemrosesan ke clipboard"
                >
                  <Copy className="w-3.5 h-3.5 text-[#417F85]" />
                  <span>Salin Ringkasan</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportSummaryCSV}
                  className="px-3 py-2 bg-white hover:bg-[#E7EFF1] text-[#35666D] border border-[#D5E0E3] rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  title="Unduh rincian hasil pemrosesan massal dalam file CSV"
                >
                  <Download className="w-3.5 h-3.5 text-[#417F85]" />
                  <span>Unduh Laporan (CSV)</span>
                </button>
                {batchSummary.failedCount > 0 && (
                  <button
                    onClick={handleRetryFailedItems}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Coba Lagi Gagal ({batchSummary.failedCount})</span>
                  </button>
                )}
                <button
                  onClick={() => setBatchSummary(null)}
                  className="px-4 py-2 bg-[#417F85] hover:bg-[#326A70] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Tutup Laporan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: DETAIL PERMOHONAN INDIVIDUAL
         ======================================================== */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-[#D5E0E3] shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto text-[#20272B]">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#D5E0E3] pb-3.5">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-[#E7EFF1] text-[#35666D] flex items-center justify-center border border-[#D5E0E3]">
                  <ShieldCheck className="w-5 h-5 text-[#417F85]" />
                </span>
                <div>
                  <h3 className="font-extrabold text-base text-[#20272B]">
                    Detail Permohonan Registrasi
                  </h3>
                  <p className="text-xs text-[#69777D] font-mono">
                    {selectedRequest.id} · Diajukan {new Date(selectedRequest.submittedAt).toLocaleDateString('id-ID')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-[#69777D] hover:text-[#20272B] p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status Badge */}
            <div className="flex items-center justify-between p-3 bg-[#F5FAFA] rounded-xl border border-[#D5E0E3]">
              <span className="text-xs font-bold text-[#69777D]">Status Saat Ini:</span>
              {isPending(selectedRequest.status) && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-300">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Menunggu Verifikasi Admin
                </span>
              )}
              {isApproved(selectedRequest.status) && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Disetujui ({selectedRequest.assignedRole})
                </span>
              )}
              {isRejected(selectedRequest.status) && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-50 text-rose-800 border border-rose-300">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  Ditolak
                </span>
              )}
            </div>

            {/* Employee Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs bg-white p-4 rounded-xl border border-[#D5E0E3] shadow-2xs">
              <div>
                <span className="text-[#69777D] block text-[11px]">Nama Lengkap Pegawai</span>
                <span className="font-bold text-[#20272B] text-sm">{selectedRequest.fullName}</span>
              </div>
              <div>
                <span className="text-[#69777D] block text-[11px]">NIP / ID Pegawai PLN</span>
                <span className="font-mono font-bold text-[#35666D] text-sm">{selectedRequest.employeeId}</span>
              </div>
              <div>
                <span className="text-[#69777D] block text-[11px]">Email Korporat Resmi</span>
                <span className="font-medium text-[#20272B] break-all">{selectedRequest.corporateEmail}</span>
              </div>
              <div>
                <span className="text-[#69777D] block text-[11px]">Nomor Kontak / Telepon</span>
                <span className="font-medium text-[#20272B]">{selectedRequest.phone || '-'}</span>
              </div>
              <div>
                <span className="text-[#69777D] block text-[11px]">Unit Kerja / UPDL</span>
                <span className="font-semibold text-[#20272B]">{selectedRequest.unitName}</span>
                <span className="text-[10px] text-[#69777D] block">Kode: {selectedRequest.unitCode} ({selectedRequest.unitType || 'UPDL'})</span>
              </div>
              <div>
                <span className="text-[#69777D] block text-[11px]">Jabatan / Posisi Kerja</span>
                <span className="font-medium text-[#20272B]">{selectedRequest.position}</span>
              </div>
              <div>
                <span className="text-[#69777D] block text-[11px]">Waktu Pengajuan</span>
                <span className="font-medium text-[#20272B]">
                  {new Date(selectedRequest.submittedAt).toLocaleString('id-ID', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  })}{' '}
                  WIB
                </span>
              </div>
              <div>
                <span className="text-[#69777D] block text-[11px]">Persetujuan Kebijakan</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Menyetujui Ketentuan Sistem
                </span>
              </div>
            </div>

            {/* Individual Decision Section if Pending */}
            {isPending(selectedRequest.status) && (
              <div className="space-y-3 pt-2">
                {!showSingleApproveDialog && !showSingleRejectDialog ? (
                  <div className="flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowDetailModal(false)}
                      className="px-3.5 py-2 text-xs font-bold text-[#69777D] hover:text-[#20272B] cursor-pointer"
                    >
                      Tutup
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSingleRejectDialog(true);
                        setShowSingleApproveDialog(false);
                        setRejectionReason('');
                      }}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Tolak Permohonan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSingleApproveDialog(true);
                        setShowSingleRejectDialog(false);
                        setAssignedRole('pelapor');
                      }}
                      className="px-4 py-2 bg-[#417F85] hover:bg-[#326A70] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Setujui & Aktifkan</span>
                    </button>
                  </div>
                ) : showSingleApproveDialog ? (
                  <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3 text-xs animate-in fade-in">
                    <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-700" />
                      <span>Persetujuan Akun: {selectedRequest.fullName}</span>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#20272B] mb-1">
                        Pilih Hak Akses (Role)
                      </label>
                      <select
                        value={assignedRole}
                        onChange={(e) => setAssignedRole(e.target.value as Role)}
                        className="w-full text-xs py-2 px-3 bg-white border border-[#D5E0E3] rounded-xl font-bold cursor-pointer"
                      >
                        <option value="pelapor">Pelapor 11 UPDL / Unit (Standar Pengguna)</option>
                        <option value="pic">Petugas PIC Helpdesk</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#20272B] mb-1">
                        Konfirmasi / Penyesuaian Unit Kerja
                      </label>
                      {selectedRequest.isManualUnit && (
                        <div className="mb-2 p-2 bg-amber-50 border border-amber-300 rounded-lg text-[11px] text-amber-900 flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold">Pengajuan Unit Baru: </span>
                            <span>Pengguna mengajukan &ldquo;{selectedRequest.requestedUnitName}&rdquo;. Jika dikonfirmasi, unit ini otomatis ditambahkan ke Master Data.</span>
                          </div>
                        </div>
                      )}
                      <select
                        value={assignedUnitId}
                        onChange={(e) => setAssignedUnitId(e.target.value)}
                        className="w-full text-xs py-2 px-3 bg-white border border-[#D5E0E3] rounded-xl font-bold cursor-pointer"
                      >
                        {selectedRequest.isManualUnit && (
                          <option value="" disabled>
                            Pilih unit resmi atau verifikasi unit baru
                          </option>
                        )}
                        {selectedRequest.isManualUnit && selectedRequest.requestedUnitName && (
                          <optgroup label="Pengajuan Unit Baru (Otomatis Masuk Master Data)">
                            <option value="unit-pending-custom">
                              + Setujui &amp; Buat Master Unit: {selectedRequest.requestedUnitName}
                            </option>
                          </optgroup>
                        )}
                        <optgroup label="11 Unit UPDL Resmi">
                          {units.filter((u) => u.isActive && u.unitType === 'UPDL').map((u) => (
                            <option key={u.unitId} value={u.unitId}>
                              {u.unitName} ({u.unitCode})
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Unit Korporat">
                          {units.filter((u) => u.isActive && u.unitType === 'CORPU').map((u) => (
                            <option key={u.unitId} value={u.unitId}>
                              {u.unitName} ({u.unitCode})
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Unit Umum / Non-UPDL">
                          {units.filter((u) => u.isActive && u.unitType === 'NON_UPDL').map((u) => (
                            <option key={u.unitId} value={u.unitId}>
                              {u.unitName} ({u.unitCode})
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowSingleApproveDialog(false)}
                        className="px-3 py-1.5 text-xs text-[#69777D] font-bold cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={handleExecuteSingleApproval}
                        className="px-4 py-1.5 bg-[#417F85] hover:bg-[#326A70] text-white font-bold rounded-lg cursor-pointer"
                      >
                        {isProcessing ? 'Menyimpan...' : 'Konfirmasi Setujui'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-xl space-y-3 text-xs animate-in fade-in">
                    <div className="font-bold text-rose-900 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-rose-700" />
                      <span>Penolakan Permohonan: {selectedRequest.fullName}</span>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-rose-900 mb-1">
                        Alasan Penolakan <span className="text-rose-600">*</span>
                      </label>
                      <textarea
                        rows={2}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Tuliskan alasan penolakan..."
                        className="w-full text-xs p-2.5 bg-white border border-rose-300 rounded-xl text-[#20272B]"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowSingleRejectDialog(false)}
                        className="px-3 py-1.5 text-xs text-[#69777D] font-bold cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={isProcessing || !rejectionReason.trim()}
                        onClick={handleExecuteSingleRejection}
                        className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold rounded-lg cursor-pointer"
                      >
                        {isProcessing ? 'Menyimpan...' : 'Konfirmasi Tolak'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Audit History if Processed */}
            {!isPending(selectedRequest.status) && (
              <div className="p-3.5 bg-[#E7EFF1] rounded-xl border border-[#D5E0E3] space-y-2 text-xs">
                <div className="font-bold text-[#20272B] flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-[#417F85]" />
                  <span>Riwayat Keputusan Admin</span>
                </div>
                <div className="text-[11px] text-[#69777D] space-y-1">
                  <div>
                    <span className="font-semibold text-[#20272B]">Admin yang Memutuskan:</span>{' '}
                    {selectedRequest.processedByAdminName || 'Admin Ticketing CorpU'}
                  </div>
                  <div>
                    <span className="font-semibold text-[#20272B]">Waktu Keputusan:</span>{' '}
                    {selectedRequest.processedAt
                      ? new Date(selectedRequest.processedAt).toLocaleString('id-ID', {
                          dateStyle: 'long',
                          timeStyle: 'short',
                        })
                      : '-'}
                  </div>
                  {isApproved(selectedRequest.status) && (
                    <div>
                      <span className="font-semibold text-emerald-800">Peran yang Ditetapkan:</span>{' '}
                      <span className="font-bold uppercase text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                        {selectedRequest.assignedRole}
                      </span>
                    </div>
                  )}
                  {isRejected(selectedRequest.status) && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 mt-1">
                      <span className="font-bold block">Alasan Penolakan:</span>
                      <p className="mt-0.5 leading-relaxed">{selectedRequest.rejectionReason}</p>
                    </div>
                  )}
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 bg-[#35666D] hover:bg-[#2C555B] text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold ${
              toastMessage.type === 'error'
                ? 'bg-rose-900 text-white border-rose-800'
                : toastMessage.type === 'info'
                ? 'bg-slate-900 text-white border-slate-800'
                : 'bg-emerald-900 text-white border-emerald-800'
            }`}
          >
            {toastMessage.type === 'error' ? (
              <XCircle className="w-4 h-4 text-rose-300 shrink-0" />
            ) : toastMessage.type === 'info' ? (
              <Info className="w-4 h-4 text-sky-300 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 text-white/70 hover:text-white p-0.5 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
