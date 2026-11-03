import React, { useState, useMemo } from 'react';
import {
  UserCog,
  Search,
  Shield,
  Wrench,
  User as UserIcon,
  Users,
  PlusCircle,
  Download,
  CheckCircle2,
  XCircle,
  Edit3,
  Briefcase,
  KeyRound,
  ShieldAlert,
  ArrowRightLeft,
  Eye,
  Calendar,
  Clock,
  Building,
  Mail,
  Phone,
  Tag,
  AlertTriangle,
  History,
  FileText,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  X,
  RefreshCw,
  Sparkles,
  Info,
  UserPlus,
  FileCheck,
  Check,
  CheckCheck,
  AlertOctagon,
  ShieldCheck,
} from 'lucide-react';
import { User, Role, Ticket, RegistrationRequest, RegistrationStatus } from '../types';
import { storageService } from '../services/storageService';
import { resetUserPassword } from '../services/adminApiService';
import { getPicTag, formatPicDisplayName } from '../utils/picHelpers';
import { ALL_REGISTERED_UNITS } from '../data/unitsData';

interface UserManagementViewProps {
  currentUser: User;
  onNavigate?: (view: string, id?: string) => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({ currentUser, onNavigate }) => {
  const [newPassword, setNewPassword] = useState('');
  const [users, setUsers] = useState<User[]>(() => storageService.getUsers());
  const [tickets, setTickets] = useState<Ticket[]>(() => storageService.getTickets());
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>(() =>
    storageService.getRegistrationRequests()
  );
  const [activeTab, setActiveTab] = useState<'users' | 'registrations' | 'audit'>('users');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states for Add / Edit
  const [formData, setFormData] = useState({
    employeeId: '',
    name: '',
    email: '',
    department: '',
    position: '',
    role: 'pelapor' as Role,
    unitId: ALL_REGISTERED_UNITS.find(unit => unit.isActive)?.unitId || '',
    unitName: ALL_REGISTERED_UNITS.find(unit => unit.isActive)?.unitName || '',
    unitCode: ALL_REGISTERED_UNITS.find(unit => unit.isActive)?.unitCode || '',
    team: '',
    expertise: '',
    phone: '',
    isActive: true,
  });

  // Reassignment target for PIC deactivation
  const [reassignTargetPicId, setReassignTargetPicId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('');
  const [activeTicketsToReassign, setActiveTicketsToReassign] = useState<Ticket[]>([]);

  // Password reset message state
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const triggerToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // Form validation errors
  const [formError, setFormError] = useState<string | null>(null);

  // Registration Requests states & filters
  const [regSearchQuery, setRegSearchQuery] = useState('');
  const [regStatusFilter, setRegStatusFilter] = useState<string>('ALL');
  const [regUnitFilter, setRegUnitFilter] = useState<string>('ALL');
  const [regCurrentPage, setRegCurrentPage] = useState(1);
  const regItemsPerPage = 8;

  // Selected registration request for review / detail modal
  const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [assignedRoleChoice, setAssignedRoleChoice] = useState<Role>('pelapor');
  const [rejectionReasonText, setRejectionReasonText] = useState('');
  const [reviewTabMode, setReviewTabMode] = useState<'approve' | 'reject'>('approve');
  const [isProcessingReg, setIsProcessingReg] = useState(false);

  const refreshData = () => {
    setUsers(storageService.getUsers());
    setTickets(storageService.getTickets());
    setRegistrationRequests(storageService.getRegistrationRequests());
  };

  React.useEffect(() => storageService.subscribe(refreshData), []);
  const auditLogs = storageService.getAdminAuditLogs();

  const pendingRequestsCount = useMemo(() => {
    return registrationRequests.filter((r) => r.status === 'Menunggu Verifikasi').length;
  }, [registrationRequests]);

  const regStats = useMemo(() => {
    const total = registrationRequests.length;
    const pending = registrationRequests.filter((r) => r.status === 'Menunggu Verifikasi').length;
    const approved = registrationRequests.filter((r) => r.status === 'Disetujui').length;
    const rejected = registrationRequests.filter((r) => r.status === 'Ditolak').length;
    return { total, pending, approved, rejected };
  }, [registrationRequests]);

  const filteredRegistrations = useMemo(() => {
    return registrationRequests.filter((r) => {
      if (regStatusFilter !== 'ALL' && r.status !== regStatusFilter) return false;
      if (regUnitFilter !== 'ALL' && r.unitId !== regUnitFilter && r.unitCode !== regUnitFilter) return false;
      if (regSearchQuery.trim()) {
        const q = regSearchQuery.toLowerCase();
        const mName = r.fullName.toLowerCase().includes(q);
        const mNip = r.employeeId.toLowerCase().includes(q);
        const mEmail = r.corporateEmail.toLowerCase().includes(q);
        const mUnit = r.unitName.toLowerCase().includes(q);
        const mPos = r.position.toLowerCase().includes(q);
        const mId = r.id.toLowerCase().includes(q);
        if (!mName && !mNip && !mEmail && !mUnit && !mPos && !mId) return false;
      }
      return true;
    });
  }, [registrationRequests, regStatusFilter, regUnitFilter, regSearchQuery]);

  const totalRegPages = Math.max(1, Math.ceil(filteredRegistrations.length / regItemsPerPage));
  const paginatedRegistrations = filteredRegistrations.slice(
    (regCurrentPage - 1) * regItemsPerPage,
    regCurrentPage * regItemsPerPage
  );

  const handleOpenReviewModal = (req: RegistrationRequest, mode: 'approve' | 'reject' = 'approve') => {
    setSelectedRequest(req);
    setReviewTabMode(mode);
    setAssignedRoleChoice('pelapor');
    setRejectionReasonText('');
    setShowReviewModal(true);
  };

  const handleConfirmApprove = async () => {
    if (!selectedRequest) return;
    setIsProcessingReg(true);
    try {
      const res = await storageService.approveRegistrationRequest(
        selectedRequest.id,
        assignedRoleChoice,
        currentUser
      );
      if (res.success && res.user) {
        refreshData();
        triggerToast(
          `Permohonan ${selectedRequest.fullName} berhasil disetujui! Akun telah aktif dengan peran ${assignedRoleChoice.toUpperCase()}.`,
          'success'
        );
        setShowReviewModal(false);
      } else {
        triggerToast(res.error || 'Gagal menyetujui permohonan pendaftaran.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Terjadi kesalahan saat memproses persetujuan permohonan.', 'error');
    } finally {
      setIsProcessingReg(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!selectedRequest) return;
    const reason = rejectionReasonText.trim();
    if (!reason || reason.length < 5) {
      triggerToast('Mohon masukkan alasan penolakan yang jelas (minimal 5 karakter).', 'error');
      return;
    }
    setIsProcessingReg(true);
    try {
      const res = await storageService.rejectRegistrationRequest(
        selectedRequest.id,
        reason,
        currentUser
      );
      if (res.success) {
        refreshData();
        triggerToast(`Permohonan ${selectedRequest.fullName} telah ditolak.`, 'info');
        setShowReviewModal(false);
      } else {
        triggerToast(res.error || 'Gagal menolak permohonan pendaftaran.', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Terjadi kesalahan saat memproses penolakan permohonan.', 'error');
    } finally {
      setIsProcessingReg(false);
    }
  };

  // Metric Statistics for Dashboard
  const stats = useMemo(() => {
    const total = users.length;
    const activeCount = users.filter((u) => u.isActive).length;
    const inactiveCount = users.filter((u) => !u.isActive).length;
    const adminCount = users.filter((u) => u.role === 'admin').length;
    const picUsers = users.filter((u) => u.role === 'pic');
    const pelaporCount = users.filter((u) => u.role === 'pelapor').length;
    const manajemenCount = users.filter((u) => u.role === 'manajemen').length;

    return {
      total,
      activeCount,
      inactiveCount,
      adminCount,
      picUsers,
      pelaporCount,
      manajemenCount,
    };
  }, [users]);

  // Departemen options from existing users
  const departments = useMemo(() => {
    const set = new Set(users.map((u) => u.department).filter(Boolean));
    return Array.from(set);
  }, [users]);

  // Active PICs for reassignment
  const activePics = useMemo(() => {
    return users.filter(
      (u) => u.role === 'pic' && u.isActive && u.uid !== selectedUser?.uid
    );
  }, [users, selectedUser]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (deptFilter !== 'ALL' && u.department !== deptFilter) return false;
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;

      // Unit filter (12 Pilihan: 11 UPDL & PLN Corpu)
      if (unitFilter !== 'ALL') {
        const target = ALL_REGISTERED_UNITS.find((unit) => unit.unitId === unitFilter || unit.unitCode === unitFilter);
        const matchesUnit =
          u.unitId === unitFilter ||
          u.unitCode === unitFilter ||
          (target && u.unitName?.toLowerCase().includes(target.unitName.toLowerCase())) ||
          (target && u.department?.toLowerCase().includes(target.unitName.toLowerCase()));
        if (!matchesUnit) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mName = u.name.toLowerCase().includes(q);
        const mNip = u.employeeId.toLowerCase().includes(q);
        const mEmail = u.email.toLowerCase().includes(q);
        const mDept = u.department.toLowerCase().includes(q);
        const mUnit = (u.unitName || '').toLowerCase().includes(q);
        const mPos = (u.position || '').toLowerCase().includes(q);
        const mTeam = (u.team || '').toLowerCase().includes(q);
        const mExp = u.expertise?.some((e) => e.toLowerCase().includes(q)) || false;
        const picTag = getPicTag(u.uid);
        const mTag = picTag ? picTag.toLowerCase().includes(q) : false;

        if (!mName && !mNip && !mEmail && !mDept && !mUnit && !mPos && !mTeam && !mExp && !mTag) {
          return false;
        }
      }
      return true;
    });
  }, [users, roleFilter, deptFilter, unitFilter, statusFilter, searchQuery]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handlers for Add User
  const handleOpenAddModal = () => {
    setNewPassword('');
    setFormError(null);
    setFormData({
      employeeId: '',
      name: '',
      email: '',
      department: 'Divisi Pelatihan & Pendidikan',
      position: '',
      role: 'pelapor',
      unitId: ALL_REGISTERED_UNITS.find(unit => unit.isActive)?.unitId || '',
      unitName: ALL_REGISTERED_UNITS.find(unit => unit.isActive)?.unitName || '',
      unitCode: ALL_REGISTERED_UNITS.find(unit => unit.isActive)?.unitCode || '',
      team: '',
      expertise: '',
      phone: '',
      isActive: true,
    });
    setShowAddModal(true);
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nip = formData.employeeId.trim();
    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();

    if (!nip || !name || !email) {
      setFormError('Harap lengkapi semua field wajib bertanda bintang (*).');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFormError('Format email perusahaan tidak valid.');
      return;
    }

    // Unique NIP check
    if (users.some((u) => u.employeeId.toLowerCase() === nip.toLowerCase())) {
      setFormError(`NIP/ID Pegawai "${nip}" sudah digunakan oleh pengguna lain.`);
      return;
    }

    // Unique Email check
    if (users.some((u) => u.email.toLowerCase() === email)) {
      setFormError(`Alamat email "${email}" sudah terdaftar.`);
      return;
    }

    const selectedUnitObj = ALL_REGISTERED_UNITS.find((u) => u.unitId === formData.unitId);

    const newUid = `user-${Date.now()}`;
    const newUser: User = {
      uid: newUid,
      employeeId: nip,
      name,
      email,
      department: formData.department.trim() || 'PLN Corporate University',
      position: formData.position.trim() || undefined,
      role: formData.role,
      unitId: formData.unitId,
      unitName: selectedUnitObj?.unitName || formData.unitName,
      unitCode: selectedUnitObj?.unitCode || formData.unitCode,
      team: formData.team.trim() || undefined,
      expertise: formData.expertise
        ? formData.expertise.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      phone: formData.phone.trim() || undefined,
      isActive: formData.isActive,
      createdAt: new Date().toISOString(),
    };

    try { await storageService.saveUser(newUser, newPassword); } catch (error) { setFormError(error instanceof Error ? error.message : 'Gagal menyimpan pengguna.'); return; }


    // Add Admin Audit Log

    refreshData();
    triggerToast(`Pengguna baru ${newUser.name} (${newUser.unitName}) berhasil ditambahkan.`);
    setShowAddModal(false);
  };

  // Handlers for Edit User
  const handleOpenEditModal = (u: User) => {
    setSelectedUser(u);
    setFormError(null);
    setFormData({
      employeeId: u.employeeId,
      name: u.name,
      email: u.email,
      department: u.department,
      position: u.position || '',
      role: u.role,
      unitId: u.unitId || 'unit-updl-jkt',
      unitName: u.unitName || 'PLN UPDL Jakarta',
      unitCode: u.unitCode || 'UPDL_JKT',
      team: u.team || '',
      expertise: u.expertise ? u.expertise.join(', ') : '',
      phone: u.phone || '',
      isActive: u.isActive,
    });
    setShowEditModal(true);
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormError(null);

    const nip = formData.employeeId.trim();
    const name = formData.name.trim();
    const email = formData.email.trim().toLowerCase();

    if (!nip || !name || !email) {
      setFormError('Harap lengkapi semua field wajib bertanda bintang (*).');
      return;
    }

    // Unique NIP check
    if (
      users.some(
        (u) => u.uid !== selectedUser.uid && u.employeeId.toLowerCase() === nip.toLowerCase()
      )
    ) {
      setFormError(`NIP/ID Pegawai "${nip}" sudah digunakan oleh pengguna lain.`);
      return;
    }

    // Unique Email check
    if (
      users.some((u) => u.uid !== selectedUser.uid && u.email.toLowerCase() === email)
    ) {
      setFormError(`Alamat email "${email}" sudah terdaftar.`);
      return;
    }

    // Validate role change safety
    if (formData.role !== selectedUser.role) {
      const roleCheck = storageService.validateRoleChange(
        selectedUser,
        formData.role,
        currentUser
      );
      if (!roleCheck.valid) {
        setFormError(roleCheck.message || 'Perubahan peran tidak diizinkan.');
        return;
      }
    }

    const selectedUnitObj = ALL_REGISTERED_UNITS.find((u) => u.unitId === formData.unitId);

    const updatedUser: User = {
      ...selectedUser,
      employeeId: nip,
      name,
      email,
      department: formData.department.trim(),
      position: formData.position.trim() || undefined,
      role: formData.role,
      unitId: formData.unitId,
      unitName: selectedUnitObj?.unitName || formData.unitName,
      unitCode: selectedUnitObj?.unitCode || formData.unitCode,
      team: formData.team.trim() || undefined,
      expertise: formData.expertise
        ? formData.expertise.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
      phone: formData.phone.trim() || undefined,
      isActive: formData.isActive,
    };

    try { await storageService.saveUser(updatedUser); } catch (error) { setFormError(error instanceof Error ? error.message : 'Gagal menyimpan pengguna.'); triggerToast(error instanceof Error ? error.message : 'Gagal menyimpan pengguna.', 'error'); return; }


    refreshData();
    triggerToast(`Data pengguna ${updatedUser.name} berhasil diperbarui.`);
    setShowEditModal(false);
  };

  // Handlers for Change Role
  const handleOpenRoleModal = (u: User) => {
    setSelectedUser(u);
    setFormData((prev) => ({ ...prev, role: u.role }));
    setFormError(null);
    setShowRoleModal(true);
  };

  const handleRoleChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const check = storageService.validateRoleChange(
      selectedUser,
      formData.role,
      currentUser
    );
    if (!check.valid) {
      setFormError(check.message || 'Perubahan role tidak diperbolehkan.');
      return;
    }

    const updated: User = {
      ...selectedUser,
      role: formData.role,
    };

    try { await storageService.saveUser(updated); } catch (error) { setFormError(error instanceof Error ? error.message : 'Gagal menyimpan pengguna.'); triggerToast(error instanceof Error ? error.message : 'Gagal menyimpan pengguna.', 'error'); return; }


    refreshData();
    triggerToast(`Peran pengguna ${updated.name} berhasil diubah.`);
    setShowRoleModal(false);
  };

  // Handlers for Toggle Status (Activate / Deactivate)
  const handleOpenStatusModal = (u: User) => {
    setSelectedUser(u);
    setFormError(null);
    setReassignTargetPicId('');
    setReassignReason('Pengalihan tiket karena PIC dinonaktifkan sementara.');

    if (u.isActive) {
      // Check if user is PIC and has active tickets
      if (u.role === 'pic') {
        const activeTix = storageService.getActiveTicketsForPic(u.uid);
        setActiveTicketsToReassign(activeTix);
      } else {
        setActiveTicketsToReassign([]);
      }
    } else {
      setActiveTicketsToReassign([]);
    }

    setShowStatusModal(true);
  };

  const handleConfirmStatusToggle = async () => {
    if (!selectedUser) return;

    const newStatus = !selectedUser.isActive;

    // Validate if deactivating admin
    const check = storageService.validateStatusChange(
      selectedUser,
      newStatus,
      currentUser
    );
    if (!check.valid) {
      setFormError(check.message || 'Operasi perubahan status gagal.');
      return;
    }

    // If deactivating a PIC with active tickets and a reassignment target was chosen
    if (!newStatus && selectedUser.role === 'pic' && activeTicketsToReassign.length > 0) {
      if (reassignTargetPicId) {
        try { await storageService.reassignActiveTickets(
          selectedUser.uid,
          reassignTargetPicId,
          currentUser,
          reassignReason
        ); } catch (error) { setFormError(error instanceof Error ? error.message : 'Gagal mengalihkan tiket.'); return; }
      }
    }

    const updated: User = {
      ...selectedUser,
      isActive: newStatus,
    };

    try { await storageService.saveUser(updated); } catch (error) { setFormError(error instanceof Error ? error.message : 'Gagal menyimpan pengguna.'); triggerToast(error instanceof Error ? error.message : 'Gagal menyimpan pengguna.', 'error'); return; }


    refreshData();
    triggerToast(newStatus ? `Akun ${updated.name} berhasil diaktifkan.` : `Akun ${updated.name} berhasil dinonaktifkan.`);
    setShowStatusModal(false);
  };

  // Handlers for Reset Password
  const handleOpenResetModal = (u: User) => {
    setNewPassword('');
    setSelectedUser(u);
    setResetSuccessMessage(null);
    setShowResetModal(true);
  };

  const handleConfirmResetPassword = async () => {
    if (!selectedUser) return;
    try {
      await resetUserPassword(selectedUser.uid, newPassword);
      setNewPassword('');
      setResetSuccessMessage('Password berhasil diperbarui di PostgreSQL. Seluruh sesi lama pengguna telah dicabut.');
      triggerToast(`Password ${selectedUser.name} berhasil diperbarui.`);
      await storageService.refresh(); refreshData();
    } catch (error) { triggerToast(error instanceof Error ? error.message : 'Reset password gagal.', 'error'); }
  };

  // Handler for Export to CSV
  const handleExportCsv = () => {
    const headers = [
      'ID Pengguna',
      'ID Pegawai (NIP)',
      'Nama Lengkap',
      'Email',
      'Departemen',
      'Unit Organisasi (UPDL)',
      'Kode Unit',
      'Jabatan',
      'Role',
      'Tim',
      'Keahlian',
      'Tanggal Dibuat',
      'Terakhir Login',
      'Status Akun',
    ];

    const rows = filteredUsers.map((u) => {
      const picTag = getPicTag(u.uid);
      const roleName =
        u.role === 'admin'
          ? 'Admin Ticketing'
          : u.role === 'manajemen'
          ? 'Manajemen CorpU'
          : u.role === 'pic'
          ? picTag || 'PIC'
          : 'Pelapor';

      return [
        `"${u.uid}"`,
        `"${u.employeeId}"`,
        `"${u.name.replace(/"/g, '""')}"`,
        `"${u.email}"`,
        `"${(u.department || '').replace(/"/g, '""')}"`,
        `"${(u.unitName || 'PLN Corpu').replace(/"/g, '""')}"`,
        `"${(u.unitCode || 'PLN_CORPU').replace(/"/g, '""')}"`,
        `"${(u.position || 'Staff Fungsional').replace(/"/g, '""')}"`,
        `"${roleName}"`,
        `"${(u.team || '-').replace(/"/g, '""')}"`,
        `"${(u.expertise && u.expertise.length > 0 ? u.expertise.join(', ') : '-').replace(/"/g, '""')}"`,
        `"${new Date(u.createdAt).toLocaleDateString('id-ID')}"`,
        `"${u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('id-ID') : 'Belum pernah'}"`,
        `"${u.isActive ? 'Aktif' : 'Nonaktif'}"`,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    link.setAttribute('download', `PLN_CorpU_Data_Pengguna_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    triggerToast(`Daftar pengguna (${filteredUsers.length} akun) berhasil diekspor ke CSV.`);
  };

  // Format PIC Badge component
  const renderPicTagBadge = (u: User) => {
    const tag = getPicTag(u.uid);
    if (!tag && u.role !== 'pic') return null;

    if (tag === 'PIC 1') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
          <Wrench className="w-2.5 h-2.5 text-amber-700" />
          PIC 1 (Network)
        </span>
      );
    }
    if (tag === 'PIC 2') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300">
          <Wrench className="w-2.5 h-2.5 text-blue-700" />
          PIC 2 (Hardware)
        </span>
      );
    }
    if (tag === 'PIC 3') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
          <Wrench className="w-2.5 h-2.5 text-emerald-700" />
          PIC 3 (Aplikasi)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-sky-100 text-sky-900 border border-sky-300">
        <Wrench className="w-2.5 h-2.5 text-sky-700" />
        PIC
      </span>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in-50">
      {/* Top Banner / Navigation Tabs */}
      <div className="bg-gradient-hero p-5 rounded-2xl border border-[#DCEAF7] shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#2589E8] to-[#1765B3] text-white flex items-center justify-center shadow-xs">
              <UserCog className="w-4 h-4" />
            </span>
            <h1 className="text-xl font-extrabold text-[#172B4D] tracking-tight">
              Manajemen User
            </h1>
          </div>
          <p className="text-xs text-[#64748B] mt-1.5 max-w-2xl">
            Kelola akun, role, status, dan hak akses pengguna.
          </p>
        </div>

        {/* Tab Switcher & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="flex bg-white/80 p-1 rounded-xl border border-[#DCEAF7] text-xs font-semibold shadow-2xs">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-[#E5F2FF] text-[#1765B3] font-bold shadow-2xs border border-[#B8DEFF]'
                  : 'text-[#64748B] hover:text-[#172B4D]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-[#2589E8]" />
              <span>Daftar Pengguna ({users.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('registrations')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer relative ${
                activeTab === 'registrations'
                  ? 'bg-[#E5F2FF] text-[#1765B3] font-bold shadow-2xs border border-[#B8DEFF]'
                  : 'text-[#64748B] hover:text-[#172B4D]'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5 text-[#2589E8]" />
              <span>Permohonan Pendaftaran</span>
              {pendingRequestsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500 text-white ml-0.5 animate-badge-pop">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-[#E5F2FF] text-[#1765B3] font-bold shadow-2xs border border-[#B8DEFF]'
                  : 'text-[#64748B] hover:text-[#172B4D]'
              }`}
            >
              <History className="w-3.5 h-3.5 text-[#2589E8]" />
              <span>Aktivitas Admin ({auditLogs.length})</span>
            </button>
          </div>

          {activeTab === 'users' && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="px-3.5 py-2 bg-white hover:bg-[#F0F7FF] text-[#1765B3] border border-[#DCEAF7] rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Ekspor Data Pengguna ke File CSV"
              >
                <Download className="w-4 h-4 text-[#2589E8]" />
                <span>Ekspor CSV</span>
              </button>

              <button
                onClick={handleOpenAddModal}
                className="px-3.5 py-2 bg-gradient-primary hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Tambah Pengguna</span>
              </button>
            </div>
          )}

          {activeTab === 'registrations' && onNavigate && (
            <button
              onClick={() => onNavigate('registration-requests')}
              className="px-3.5 py-2 bg-[#417F85] hover:bg-[#326A70] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Aksi Massal & Verifikasi Lengkap</span>
            </button>
          )}
        </div>
      </div>

      {/* DASHBOARD STATISTIK PENGGUNA */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-gradient-card p-4 rounded-xl border border-[#DCEAF7] shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Total Pengguna</span>
            <span className="p-2 bg-[#EFF8FF] text-[#2589E8] rounded-lg border border-[#B8DEFF]/60">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#172B4D] font-mono-numbers">{stats.total}</span>
            <span className="text-[11px] text-[#64748B] font-medium">Akun</span>
          </div>
          <p className="text-[10px] text-[#1765B3] font-bold mt-1">
            {stats.activeCount} Aktif · {stats.inactiveCount} Nonaktif
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#DCEAF7] shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Admin Ticketing</span>
            <span className="p-2 bg-[#EFF8FF] text-[#1765B3] rounded-lg border border-[#B8DEFF]/60">
              <Shield className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#172B4D] font-mono-numbers">{stats.adminCount}</span>
            <span className="text-[11px] text-[#64748B] font-medium">Admin</span>
          </div>
          <p className="text-[10px] text-[#64748B] mt-1">
            Hak Akses Administratif Penuh
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#DCEAF7] shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Petugas PIC</span>
            <span className="p-2 bg-[#EFF8FF] text-[#2589E8] rounded-lg border border-[#B8DEFF]/60">
              <Wrench className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#172B4D] font-mono-numbers">{stats.picUsers.length}</span>
            <span className="text-[11px] text-[#64748B] font-medium">Petugas</span>
          </div>
          <p className="text-[10px] text-[#1765B3] font-bold mt-1">
            PIC 1, PIC 2, & PIC 3 Terdaftar
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#DCEAF7] shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Pelapor Karyawan</span>
            <span className="p-2 bg-[#EFF8FF] text-[#2589E8] rounded-lg border border-[#B8DEFF]/60">
              <UserIcon className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#172B4D] font-mono-numbers">{stats.pelaporCount}</span>
            <span className="text-[11px] text-[#64748B] font-medium">Pegawai</span>
          </div>
          <p className="text-[10px] text-[#64748B] mt-1">
            Pembuat Tiket Divisi CorpU
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#DCEAF7] shadow-2xs hover:shadow-xs transition-shadow col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Akun Nonaktif</span>
            <span className="p-2 bg-slate-100 text-slate-600 rounded-lg border border-slate-200">
              <UserX className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-700 font-mono-numbers">{stats.inactiveCount}</span>
            <span className="text-[11px] text-[#64748B] font-medium">Akun</span>
          </div>
          <p className="text-[10px] text-[#64748B] mt-1">
            {stats.inactiveCount > 0 ? 'Akses Dinonaktifkan' : 'Semua Akun Aktif'}
          </p>
        </div>
      </div>

      {/* TAB 1: USERS LIST */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-[#DCEAF7] shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari nama, NIP, email, jabatan, atau keahlian..."
                className="w-full pl-9 pr-3 py-2 bg-[#F5FAFF] border border-[#DCEAF7] rounded-lg text-[#172B4D] focus:outline-hidden focus:ring-2 focus:ring-[#2589E8] focus:bg-white text-xs font-medium placeholder:text-[#94A3B8] transition-all"
              />
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5 pointer-events-none" />
            </div>

            {/* Filter Role */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#F5FAFF] border border-[#DCEAF7] rounded-lg px-2.5 py-2 text-[#172B4D] font-medium focus:ring-2 focus:ring-[#2589E8] focus:outline-hidden"
              >
                <option value="ALL">Semua Role</option>
                <option value="admin">Admin Ticketing</option>
                <option value="pic">Petugas PIC (1, 2, 3)</option>
                <option value="pelapor">Pelapor Karyawan</option>
                <option value="manajemen">Manajemen CorpU</option>
              </select>
            </div>

            {/* Filter Departemen */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Dept:</span>
              <select
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#F5FAFF] border border-[#DCEAF7] rounded-lg px-2.5 py-2 text-[#172B4D] font-medium focus:ring-2 focus:ring-[#2589E8] focus:outline-hidden max-w-[180px] truncate"
              >
                <option value="ALL">Semua Departemen</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Unit (12 Pilihan: 11 UPDL & PLN Corpu) */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Unit:</span>
              <select
                value={unitFilter}
                onChange={(e) => {
                  setUnitFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#F5FAFF] border border-[#DCEAF7] rounded-lg px-2.5 py-2 text-[#172B4D] font-medium focus:ring-2 focus:ring-[#2589E8] focus:outline-hidden max-w-[190px] truncate"
              >
                <option value="ALL">Semua Unit (12 Unit)</option>
                <optgroup label="Wilayah Pulau Jawa (6 UPDL)">
                  {ALL_REGISTERED_UNITS.filter((u) => u.unitRegion === 'Jawa').map((u) => (
                    <option key={u.unitId} value={u.unitId}>
                      {u.unitName}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Wilayah Luar Jawa (5 UPDL)">
                  {ALL_REGISTERED_UNITS.filter((u) => u.unitRegion === 'Luar Jawa').map((u) => (
                    <option key={u.unitId} value={u.unitId}>
                      {u.unitName}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Unit Korporat (1 Unit)">
                  {ALL_REGISTERED_UNITS.filter((u) => u.unitRegion === 'Korporat').map((u) => (
                    <option key={u.unitId} value={u.unitId}>
                      {u.unitName}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Filter Status Akun */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-[#F5FAFF] border border-[#DCEAF7] rounded-lg px-2.5 py-2 text-[#172B4D] font-medium focus:ring-2 focus:ring-[#2589E8] focus:outline-hidden"
              >
                <option value="ALL">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-xl border border-[#DCEAF7] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F0F7FF] border-b border-[#DCEAF7] text-[11px] font-bold text-[#172B4D] uppercase tracking-wider">
                    <th className="py-3 px-3.5 whitespace-nowrap">ID Pengguna</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">ID Pegawai</th>
                    <th className="py-3 px-4 min-w-[190px]">Nama Lengkap</th>
                    <th className="py-3 px-3.5 min-w-[170px]">Email</th>
                    <th className="py-3 px-3.5 min-w-[160px]">Departemen</th>
                    <th className="py-3 px-3.5 min-w-[150px]">Jabatan</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">Role</th>
                    <th className="py-3 px-3.5 min-w-[180px]">Tim atau Keahlian</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">Tanggal Dibuat</th>
                    <th className="py-3 px-3.5 whitespace-nowrap">Terakhir Login</th>
                    <th className="py-3 px-3.5 text-center whitespace-nowrap">Status Akun</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCEAF7]/60 text-xs text-[#172B4D]">
                  {paginatedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-[#94A3B8]">
                        <UserX className="w-8 h-8 mx-auto mb-2 text-[#B8DEFF]" />
                        <p className="font-semibold text-[#172B4D]">Tidak ada data pengguna yang sesuai.</p>
                        <p className="text-[11px] text-[#64748B]">Coba ubah kueri pencarian atau reset filter.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((u) => {
                      const picTag = getPicTag(u.uid);
                      const isSelf = u.uid === currentUser.uid;

                      return (
                        <tr key={u.uid} className="hover:bg-[#F5FAFF] transition-colors">
                          {/* 1. ID Pengguna */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            <code className="text-[11px] font-mono bg-[#EFF8FF] text-[#1765B3] font-bold px-2 py-0.5 rounded border border-[#DCEAF7]">
                              {u.uid}
                            </code>
                          </td>

                          {/* 2. ID Pegawai (NIP) */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            <span className="font-mono text-[11px] font-bold text-[#172B4D]">
                              {u.employeeId}
                            </span>
                          </td>

                          {/* 3. Nama Lengkap */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                  u.role === 'admin'
                                    ? 'bg-gradient-to-br from-[#2589E8] to-[#1765B3] text-white shadow-2xs'
                                    : u.role === 'manajemen'
                                    ? 'bg-purple-800 text-white'
                                    : u.role === 'pic'
                                    ? 'bg-gradient-to-br from-[#2589E8] to-[#1765B3] text-white shadow-2xs'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {u.name.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-[#172B4D]">{u.name}</span>
                                  {isSelf && (
                                    <span className="text-[9px] bg-[#EFF8FF] text-[#1765B3] border border-[#B8DEFF] px-1.5 py-0.2 rounded font-bold">
                                      Anda
                                    </span>
                                  )}
                                </div>
                                {renderPicTagBadge(u) && (
                                  <div className="mt-0.5">{renderPicTagBadge(u)}</div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 4. Email */}
                          <td className="py-3.5 px-3.5">
                            <span className="text-[#172B4D] block truncate max-w-[190px] font-medium" title={u.email}>
                              {u.email}
                            </span>
                            {u.phone && (
                              <span className="text-[10px] text-[#64748B] block font-mono mt-0.5">
                                {u.phone}
                              </span>
                            )}
                          </td>

                          {/* 5. Departemen & Unit UPDL */}
                          <td className="py-3.5 px-3.5">
                            <span className="font-semibold text-[#172B4D] block truncate max-w-[170px]" title={u.department}>
                              {u.department}
                            </span>
                            <span className="inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-[#EFF8FF] text-[#1765B3] border border-[#B8DEFF] truncate max-w-[160px]" title={u.unitName || 'PLN Corpu'}>
                              {u.unitName || 'PLN Corpu'}
                            </span>
                          </td>

                          {/* 6. Jabatan */}
                          <td className="py-3.5 px-3.5">
                            <span className="text-[#64748B] block truncate max-w-[160px]" title={u.position || 'Staff Fungsional'}>
                              {u.position || 'Staff Fungsional'}
                            </span>
                          </td>

                          {/* 7. Role */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap">
                            <span
                              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                u.role === 'admin'
                                  ? 'bg-[#D9EEFF] text-[#1765B3] border border-[#B8DEFF]'
                                  : u.role === 'manajemen'
                                  ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                  : u.role === 'pic'
                                  ? 'bg-[#EFF8FF] text-[#1765B3] border border-[#DCEAF7]'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {u.role === 'admin' && <Shield className="w-3 h-3 text-[#1765B3]" />}
                              {u.role === 'manajemen' && <Briefcase className="w-3 h-3 text-purple-700" />}
                              {u.role === 'pic' && <Wrench className="w-3 h-3 text-[#2589E8]" />}
                              {u.role === 'pelapor' && <UserIcon className="w-3 h-3 text-slate-500" />}
                              {u.role === 'admin'
                                ? 'Admin Ticketing'
                                : u.role === 'manajemen'
                                ? 'Manajemen CorpU'
                                : u.role === 'pic'
                                ? picTag || 'PIC'
                                : 'Pelapor'}
                            </span>
                          </td>

                          {/* 8. Tim atau Keahlian */}
                          <td className="py-3.5 px-3.5 max-w-[220px]">
                            {u.team && (
                              <span className="text-[11px] font-semibold text-[#172B4D] block truncate mb-1">
                                {u.team}
                              </span>
                            )}
                            {u.expertise && u.expertise.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {u.expertise.slice(0, 2).map((exp) => (
                                  <span
                                    key={exp}
                                    className="text-[9px] bg-[#EFF8FF] text-[#1765B3] border border-[#DCEAF7] px-1.5 py-0.5 rounded font-medium truncate max-w-[120px]"
                                  >
                                    {exp}
                                  </span>
                                ))}
                                {u.expertise.length > 2 && (
                                  <span className="text-[9px] text-[#94A3B8] font-bold">
                                    +{u.expertise.length - 2}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#94A3B8] text-[11px] italic">-</span>
                            )}
                          </td>

                          {/* 9. Tanggal Dibuat */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap font-mono-numbers text-[11px] text-[#64748B]">
                            {new Date(u.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>

                          {/* 10. Terakhir Login */}
                          <td className="py-3.5 px-3.5 whitespace-nowrap font-mono-numbers text-[11px]">
                            {u.lastLoginAt ? (
                              <span className="text-[#172B4D]">
                                {new Date(u.lastLoginAt).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            ) : (
                              <span className="text-[#94A3B8] italic">Belum pernah</span>
                            )}
                          </td>

                          {/* 11. Status Akun */}
                          <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                                u.isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-300'
                              }`}
                            >
                              {u.isActive ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Aktif
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 text-slate-500" />
                                  Nonaktif
                                </>
                              )}
                            </span>
                          </td>

                          {/* 12. Aksi */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {/* Detail */}
                              <button
                                onClick={() => {
                                  setSelectedUser(u);
                                  setShowDetailModal(true);
                                }}
                                title="Lihat Detail Profil & Histori"
                                className="p-1.5 text-[#64748B] hover:text-[#2589E8] hover:bg-[#EFF8FF] rounded-lg transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit Data */}
                              <button
                                onClick={() => handleOpenEditModal(u)}
                                title="Edit Data Pengguna"
                                className="p-1.5 text-[#64748B] hover:text-[#1765B3] hover:bg-[#EFF8FF] rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Ubah Role */}
                              <button
                                onClick={() => handleOpenRoleModal(u)}
                                title="Ubah Peran (Role)"
                                className="p-1.5 text-[#64748B] hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </button>

                              {/* Reset Password */}
                              <button
                                onClick={() => handleOpenResetModal(u)}
                                title="Reset Password Akun"
                                className="p-1.5 text-[#64748B] hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>

                              {/* Toggle Status Aktif/Nonaktif */}
                              <button
                                onClick={() => handleOpenStatusModal(u)}
                                title={u.isActive ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                                className={`px-2 py-1 text-[11px] font-bold rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                                  u.isActive
                                    ? 'border-[#DCEAF7] text-[#64748B] hover:bg-slate-100 hover:text-slate-800'
                                    : 'border-[#B8DEFF] bg-[#EFF8FF] text-[#1765B3] hover:bg-[#D9EEFF]'
                                }`}
                              >
                                {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 bg-[#F5FAFF] border-t border-[#DCEAF7] flex items-center justify-between text-xs text-[#64748B]">
                <span>
                  Menampilkan {(currentPage - 1) * itemsPerPage + 1} -{' '}
                  {Math.min(currentPage * itemsPerPage, filteredUsers.length)} dari{' '}
                  {filteredUsers.length} pengguna
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-[#DCEAF7] bg-white hover:bg-[#EFF8FF] text-[#1765B3] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 font-bold text-[#1765B3]">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-[#DCEAF7] bg-white hover:bg-[#EFF8FF] text-[#1765B3] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: PERMOHONAN PENDAFTARAN AKUN */}
      {activeTab === 'registrations' && (
        <div className="space-y-4">
          {/* STATISTIK PERMOHONAN */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-xl border border-[#DCEAF7] shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                  Total Permohonan
                </span>
                <span className="p-2 bg-[#EFF8FF] text-[#2589E8] rounded-lg">
                  <FileText className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#172B4D] font-mono-numbers">
                  {regStats.total}
                </span>
                <span className="text-[11px] text-[#64748B]">Pengajuan</span>
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
                  {regStats.pending}
                </span>
                <span className="text-[11px] text-amber-700 font-medium">Perlu Disposisi</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs bg-emerald-50/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Disetujui & Aktif
                </span>
                <span className="p-2 bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-900 font-mono-numbers">
                  {regStats.approved}
                </span>
                <span className="text-[11px] text-emerald-700 font-medium">Akun Aktif</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-2xs bg-rose-50/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                  Ditolak
                </span>
                <span className="p-2 bg-rose-100 text-rose-700 rounded-lg border border-rose-200">
                  <XCircle className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-rose-900 font-mono-numbers">
                  {regStats.rejected}
                </span>
                <span className="text-[11px] text-rose-700 font-medium">Pengajuan</span>
              </div>
            </div>
          </div>

          {/* TABLE CONTAINER */}
          <div className="bg-white rounded-2xl border border-[#DCEAF7] shadow-2xs overflow-hidden">
            {/* Filter Bar */}
            <div className="p-4 border-b border-[#DCEAF7] bg-[#F5FAFF] space-y-3">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={regSearchQuery}
                    onChange={(e) => {
                      setRegSearchQuery(e.target.value);
                      setRegCurrentPage(1);
                    }}
                    placeholder="Cari nama, NIP, email, unit, atau ID..."
                    className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-[#DCEAF7] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#2589E8] text-[#172B4D] placeholder:text-[#94A3B8]"
                  />
                  {regSearchQuery && (
                    <button
                      onClick={() => setRegSearchQuery('')}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={regStatusFilter}
                    onChange={(e) => {
                      setRegStatusFilter(e.target.value);
                      setRegCurrentPage(1);
                    }}
                    className="text-xs py-2 px-3 bg-white border border-[#DCEAF7] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#2589E8] text-[#172B4D] font-medium"
                  >
                    <option value="ALL">Semua Status Permohonan</option>
                    <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                    <option value="Disetujui">Disetujui</option>
                    <option value="Ditolak">Ditolak</option>
                  </select>

                  <select
                    value={regUnitFilter}
                    onChange={(e) => {
                      setRegUnitFilter(e.target.value);
                      setRegCurrentPage(1);
                    }}
                    className="text-xs py-2 px-3 bg-white border border-[#DCEAF7] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#2589E8] text-[#172B4D] font-medium max-w-[200px]"
                  >
                    <option value="ALL">Semua Unit Kerja</option>
                    {ALL_REGISTERED_UNITS.map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.unitName}
                      </option>
                    ))}
                  </select>

                  {(regSearchQuery || regStatusFilter !== 'ALL' || regUnitFilter !== 'ALL') && (
                    <button
                      onClick={() => {
                        setRegSearchQuery('');
                        setRegStatusFilter('ALL');
                        setRegUnitFilter('ALL');
                        setRegCurrentPage(1);
                      }}
                      className="px-2.5 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-xl font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#EFF8FF] border-b border-[#DCEAF7] text-[#1765B3] font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">ID Permohonan</th>
                    <th className="py-3 px-4">Calon Pengguna & NIP</th>
                    <th className="py-3 px-4">Email & Kontak</th>
                    <th className="py-3 px-4">Unit Kerja & Jabatan</th>
                    <th className="py-3 px-4">Waktu Pengajuan</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCEAF7]/60">
                  {filteredRegistrations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#64748B]">
                        <div className="max-w-xs mx-auto space-y-2">
                          <FileCheck className="w-8 h-8 text-[#94A3B8] mx-auto" />
                          <p className="font-bold text-[#172B4D]">Tidak Ada Permohonan Ditemukan</p>
                          <p className="text-[11px] text-[#64748B]">
                            {regSearchQuery || regStatusFilter !== 'ALL' || regUnitFilter !== 'ALL'
                              ? 'Tidak ada permohonan yang sesuai dengan filter pencarian Anda.'
                              : 'Belum ada pengajuan pendaftaran akun baru saat ini.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRegistrations.map((req) => (
                      <tr key={req.id} className="hover:bg-[#F8FBFE] transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#1765B3] whitespace-nowrap">
                          {req.id}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#172B4D]">{req.fullName}</div>
                          <div className="font-mono text-[11px] text-[#64748B]">
                            NIP: {req.employeeId}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-[#172B4D] font-medium">{req.corporateEmail}</div>
                          {req.phone && (
                            <div className="text-[11px] text-[#64748B] flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-[#2589E8]" />
                              <span>{req.phone}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#172B4D]">{req.unitName}</div>
                          <div className="text-[11px] text-[#64748B]">{req.position}</div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-[#64748B]">
                          <div>
                            {new Date(req.submittedAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                          <div className="text-[10px] text-[#94A3B8]">
                            {new Date(req.submittedAt).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            WIB
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {req.status === 'Menunggu Verifikasi' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Menunggu Verifikasi
                            </span>
                          )}
                          {req.status === 'Disetujui' && (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Disetujui
                              </span>
                              {req.assignedRole && (
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Role: {req.assignedRole}
                                </div>
                              )}
                            </div>
                          )}
                          {req.status === 'Ditolak' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              Ditolak
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {req.status === 'Menunggu Verifikasi' ? (
                            <button
                              onClick={() => handleOpenReviewModal(req, 'approve')}
                              className="px-3 py-1.5 bg-[#417F85] hover:bg-[#326A70] text-white rounded-lg font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 ml-auto cursor-pointer"
                            >
                              <Shield className="w-3.5 h-3.5" />
                              <span>Tinjau & Verifikasi</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenReviewModal(req, 'approve')}
                              className="px-3 py-1.5 bg-[#EFF8FF] hover:bg-[#D9EEFF] text-[#1765B3] border border-[#B8DEFF] rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 ml-auto cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Detail Verifikasi</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalRegPages > 1 && (
              <div className="p-4 bg-[#F5FAFF] border-t border-[#DCEAF7] flex items-center justify-between text-xs text-[#64748B]">
                <span>
                  Menampilkan {(regCurrentPage - 1) * regItemsPerPage + 1} -{' '}
                  {Math.min(regCurrentPage * regItemsPerPage, filteredRegistrations.length)} dari{' '}
                  {filteredRegistrations.length} permohonan
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={regCurrentPage === 1}
                    onClick={() => setRegCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-[#DCEAF7] bg-white hover:bg-[#EFF8FF] text-[#1765B3] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 font-bold text-[#1765B3]">
                    {regCurrentPage} / {totalRegPages}
                  </span>
                  <button
                    disabled={regCurrentPage === totalRegPages}
                    onClick={() => setRegCurrentPage((p) => Math.min(totalRegPages, p + 1))}
                    className="p-1.5 rounded-lg border border-[#DCEAF7] bg-white hover:bg-[#EFF8FF] text-[#1765B3] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT LOG (Riwayat Aktivitas Administratif) */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-2xl border border-[#DCEAF7] shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-[#DCEAF7] bg-[#F5FAFF] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#172B4D] flex items-center gap-2">
                <History className="w-4 h-4 text-[#2589E8]" />
                Riwayat Aktivitas Administratif Pengguna
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Catatan perubahan peran, penambahan akun, pengalihan penugasan tiket, dan reset password.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Belum ada aktivitas administratif tercatat.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors flex items-start gap-3.5">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                      log.action === 'USER_CREATED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : log.action === 'ROLE_CHANGED'
                        ? 'bg-purple-100 text-purple-900'
                        : log.action === 'STATUS_CHANGED'
                        ? 'bg-amber-100 text-amber-900'
                        : log.action === 'TICKETS_REASSIGNED'
                        ? 'bg-blue-100 text-blue-900'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {log.action === 'USER_CREATED' && <PlusCircle className="w-4 h-4" />}
                    {log.action === 'ROLE_CHANGED' && <ArrowRightLeft className="w-4 h-4" />}
                    {log.action === 'STATUS_CHANGED' && <ShieldAlert className="w-4 h-4" />}
                    {log.action === 'TICKETS_REASSIGNED' && <RefreshCw className="w-4 h-4" />}
                    {log.action === 'PASSWORD_RESET' && <KeyRound className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">
                          {log.actorName}
                        </span>
                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          {log.action.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono-numbers">
                        {new Date(log.createdAt).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                      {log.details}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                      <span>Target Akun: <strong>{log.targetUserName}</strong></span>
                      {log.targetUserNip && (
                        <span>· NIP: <code className="font-mono">{log.targetUserNip}</code></span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: TAMBAH PENGGUNA */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-backdrop">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#DCEAF7] space-y-4 max-h-[90vh] overflow-y-auto animate-modal-enter">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <PlusCircle className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Tambah Pengguna Baru
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUserSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    ID Pegawai (NIP) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    placeholder="Contoh: 19950810-PLN-TI"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono-numbers"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nama Lengkap Pegawai"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Email Perusahaan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="nama@pln-corpu.co.id"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Nomor Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0812-xxxx-xxxx"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono-numbers"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Departemen / Divisi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="Nama Departemen"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Jabatan (Position)
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="Contoh: Specialist Jaringan & Fiber Optic"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              {/* Unit Organisasi UPDL */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Unit Organisasi (11 UPDL & PLN Corpu) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.unitId}
                  onChange={(e) => {
                    const selUnit = ALL_REGISTERED_UNITS.find((u) => u.unitId === e.target.value);
                    setFormData({
                      ...formData,
                      unitId: e.target.value,
                      unitName: selUnit?.unitName || '',
                      unitCode: selUnit?.unitCode || '',
                    });
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                >
                  <optgroup label="Wilayah Pulau Jawa (6 UPDL)">
                    {ALL_REGISTERED_UNITS.filter((u) => u.unitRegion === 'Jawa').map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.unitName} ({u.unitCode})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Wilayah Luar Jawa (5 UPDL)">
                    {ALL_REGISTERED_UNITS.filter((u) => u.unitRegion === 'Luar Jawa').map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.unitName} ({u.unitCode})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Unit Korporat (1 Unit)">
                    {ALL_REGISTERED_UNITS.filter((u) => u.unitRegion === 'Korporat').map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.unitName} ({u.unitCode})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Peran Sistem (Role) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  >
                    <option value="pelapor">Pelapor Karyawan</option>
                    <option value="pic">Petugas Penanganan (PIC)</option>
                    <option value="admin">Admin Ticketing</option>
                    <option value="manajemen">Manajemen CorpU</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Tim Penugasan <span className="text-slate-400 font-normal">(Khusus PIC)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.team}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    placeholder="Contoh: Network & Infrastructure"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              {formData.role === 'pic' && (
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Keahlian Teknis (Pisahkan dengan koma)
                  </label>
                  <input
                    type="text"
                    value={formData.expertise}
                    onChange={(e) => setFormData({ ...formData, expertise: e.target.value })}
                    placeholder="Cisco, MikroTik, Access Point, Windows Server, etc."
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  <label className="block">Password awal
                    <input type="password" autoComplete="new-password" value={newPassword} minLength={12} required onChange={e => setNewPassword(e.target.value)} className="block w-full mt-2 border rounded-lg p-2" />
                  </label>
                  Minimal 12 karakter, maksimal 72 byte UTF-8. Tidak ada password bawaan.
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-lg hover:bg-emerald-800 cursor-pointer shadow-xs"
                  >
                    Simpan Pengguna
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT PENGGUNA */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-backdrop">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#DCEAF7] space-y-4 max-h-[90vh] overflow-y-auto animate-modal-enter">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Data Pengguna
                </h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditUserSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    ID Pegawai (NIP) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono-numbers"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Email Perusahaan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Nomor Telepon
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono-numbers"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Departemen / Divisi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Jabatan (Position)
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              {/* Unit Organisasi UPDL */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Unit Organisasi (11 UPDL & PLN Corpu) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.unitId}
                  onChange={(e) => {
                    const selUnit = ALL_REGISTERED_UNITS.find((u) => u.unitId === e.target.value);
                    setFormData({
                      ...formData,
                      unitId: e.target.value,
                      unitName: selUnit?.unitName || '',
                      unitCode: selUnit?.unitCode || '',
                    });
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                >
                  <optgroup label="Wilayah Pulau Jawa (6 UPDL)">
                    {ALL_REGISTERED_UNITS.filter((u) => u.unitRegion === 'Jawa').map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.unitName} ({u.unitCode})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Wilayah Luar Jawa (5 UPDL)">
                    {ALL_REGISTERED_UNITS.filter((u) => u.unitRegion === 'Luar Jawa').map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.unitName} ({u.unitCode})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Unit Korporat (1 Unit)">
                    {ALL_REGISTERED_UNITS.filter((u) => u.unitRegion === 'Korporat').map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.unitName} ({u.unitCode})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Peran Sistem (Role) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium"
                  >
                    <option value="pelapor">Pelapor Karyawan</option>
                    <option value="pic">Petugas Penanganan (PIC)</option>
                    <option value="admin">Admin Ticketing</option>
                    <option value="manajemen">Manajemen CorpU</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Tim Penugasan
                  </label>
                  <input
                    type="text"
                    value={formData.team}
                    onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              {formData.role === 'pic' && (
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Keahlian Teknis (Pisahkan dengan koma)
                  </label>
                  <input
                    type="text"
                    value={formData.expertise}
                    onChange={(e) => setFormData({ ...formData, expertise: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-700 text-white font-bold rounded-lg hover:bg-blue-800 cursor-pointer shadow-xs"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: UBAH ROLE */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-backdrop">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DCEAF7] space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Ubah Hak Akses / Role
                </h3>
              </div>
              <button
                onClick={() => setShowRoleModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="text-slate-500 block">Pengguna:</span>
              <span className="font-bold text-slate-900 block text-sm">{selectedUser.name}</span>
              <span className="text-slate-500 font-mono-numbers block">{selectedUser.employeeId} · {selectedUser.email}</span>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleRoleChangeSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  Pilih Peran Baru:
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'admin', label: 'Admin Ticketing', desc: 'Hak akses penuh verifikasi, auto-assignment, & kelola sistem.' },
                    { id: 'pic', label: 'Petugas Penanganan (PIC)', desc: 'Menangani tiket sesuai keahlian & tim teknis.' },
                    { id: 'pelapor', label: 'Pelapor Karyawan', desc: 'Mengajukan keluhan & memantau status tiket miliknya.' },
                    { id: 'manajemen', label: 'Manajemen CorpU', desc: 'Akses pantau laporan, analitik, dan KPI kepatuhan SLA.' },
                  ].map((r) => (
                    <label
                      key={r.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        formData.role === r.id
                          ? 'bg-purple-50/70 border-purple-500 text-purple-950 ring-1 ring-purple-400'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="roleSelect"
                        checked={formData.role === r.id}
                        onChange={() => setFormData({ ...formData, role: r.id as Role })}
                        className="mt-0.5 text-purple-700"
                      />
                      <div>
                        <span className="font-bold block text-slate-900">{r.label}</span>
                        <span className="text-[11px] text-slate-500">{r.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-700 text-white font-bold rounded-lg hover:bg-purple-800 cursor-pointer shadow-xs"
                >
                  Simpan Perubahan Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: AKTIFKAN / NONAKTIFKAN AKUN (DENGAN REASSIGNMENT ALERT) */}
      {showStatusModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-backdrop">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DCEAF7] space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    selectedUser.isActive
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {selectedUser.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedUser.isActive ? 'Nonaktifkan Akun Pengguna' : 'Aktifkan Kembali Akun'}
                </h3>
              </div>
              <button
                onClick={() => setShowStatusModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <p className="text-xs text-slate-600 leading-relaxed">
              Anda akan {selectedUser.isActive ? 'menonaktifkan' : 'mengaktifkan'} akun milik{' '}
              <strong>{selectedUser.name}</strong> ({selectedUser.employeeId}).
              {selectedUser.isActive
                ? ' Pengguna tidak akan dapat login ke sistem atau menerima penugasan tiket baru.'
                : ' Pengguna akan dapat login kembali dan menerima penugasan tiket.'}
            </p>

            {/* Warning if PIC has active tickets */}
            {selectedUser.isActive && selectedUser.role === 'pic' && activeTicketsToReassign.length > 0 && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2.5">
                <div className="flex items-start gap-2 text-amber-900 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    Peringatan: {selectedUser.name} memiliki {activeTicketsToReassign.length} tiket aktif!
                  </span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Sesuai SOP Ticketing PLN CorpU, silakan alihkan seluruh tiket yang sedang berjalan kepada petugas PIC aktif lainnya:
                </p>

                <div>
                  <label className="block text-[11px] font-bold text-slate-800 mb-1">
                    Alihkan tiket ke PIC aktif:
                  </label>
                  <select
                    value={reassignTargetPicId}
                    onChange={(e) => setReassignTargetPicId(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-amber-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Tetap Biarkan / Tidak Dialihkan Sekarang --</option>
                    {activePics.map((p) => (
                      <option key={p.uid} value={p.uid}>
                        {formatPicDisplayName(p.uid, p.name)} ({p.team || 'Tim Teknis'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusToggle}
                className={`px-4 py-2 text-white font-bold rounded-lg cursor-pointer shadow-xs ${
                  selectedUser.isActive
                    ? 'bg-rose-700 hover:bg-rose-800'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                {selectedUser.isActive ? 'Konfirmasi Nonaktifkan' : 'Konfirmasi Aktifkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: RESET PASSWORD */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-backdrop">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#DCEAF7] space-y-4 animate-modal-enter">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Reset Password Akun
                </h3>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetSuccessMessage ? (
              <div className="space-y-4">
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{resetSuccessMessage}</span>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowResetModal(false)}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  Apakah Anda yakin ingin me-reset password akun untuk <strong>{selectedUser.name}</strong> ({selectedUser.email})?
                </p>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500">
                  Masukkan password baru minimal 12 karakter, maksimal 72 byte UTF-8. Password disimpan sebagai hash; sesi lama otomatis dicabut.
                  <input type="password" autoComplete="new-password" aria-label="Password baru" minLength={12} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="block w-full mt-3 border rounded-lg p-2 bg-white" />
                </div>

                <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmResetPassword}
                    className="px-4 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 cursor-pointer shadow-xs"
                  >
                    Mulai Reset Password
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 6: DETAIL PENGGUNA */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-backdrop">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#DCEAF7] space-y-4 max-h-[90vh] overflow-y-auto animate-modal-enter">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <UserIcon className="w-4 h-4" />
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  Rincian Profil Pengguna
                </h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Header */}
            <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="w-12 h-12 rounded-full bg-emerald-800 text-white flex items-center justify-center font-extrabold text-base">
                {selectedUser.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-slate-900 text-sm truncate">{selectedUser.name}</h4>
                  {renderPicTagBadge(selectedUser)}
                </div>
                <p className="text-xs text-slate-500 font-mono-numbers">{selectedUser.employeeId}</p>
                <p className="text-xs text-emerald-800 font-semibold">{selectedUser.position || selectedUser.department}</p>
              </div>
            </div>

            {/* Profile Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Role Akses</span>
                <span className="font-bold text-slate-800 uppercase">{selectedUser.role}</span>
              </div>
              <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Status Akun</span>
                <span className={`font-bold ${selectedUser.isActive ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {selectedUser.isActive ? 'Aktif (Dapat Login)' : 'Nonaktif (Diblokir)'}
                </span>
              </div>
              <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Email</span>
                <span className="font-medium text-slate-800 break-all">{selectedUser.email}</span>
              </div>
              <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Kontak Telepon</span>
                <span className="font-mono-numbers text-slate-800">{selectedUser.phone || '-'}</span>
              </div>
              <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Tanggal Bergabung</span>
                <span className="font-mono-numbers text-slate-800">
                  {new Date(selectedUser.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-100">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Terakhir Login</span>
                <span className="font-mono-numbers text-slate-800">
                  {selectedUser.lastLoginAt
                    ? new Date(selectedUser.lastLoginAt).toLocaleString('id-ID')
                    : 'Belum pernah'}
                </span>
              </div>
            </div>

            {/* Special Section for PIC: Team & Expertise */}
            {selectedUser.role === 'pic' && (
              <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl text-xs space-y-2">
                <span className="font-bold text-amber-900 block flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-amber-700" />
                  Keahlian & Spesialisasi Penugasan
                </span>
                <p className="text-slate-600">
                  Tim: <strong>{selectedUser.team || 'Tim Teknis IT'}</strong>
                </p>
                {selectedUser.expertise && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedUser.expertise.map((e) => (
                      <span key={e} className="text-[10px] bg-white border border-amber-300 text-amber-900 px-2 py-0.5 rounded font-medium">
                        {e}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Associated Tickets count */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-500 block">Keterlibatan Tiket:</span>
                <span className="font-bold text-slate-900">
                  {selectedUser.role === 'pic'
                    ? `${tickets.filter((t) => t.currentPicId === selectedUser.uid).length} tiket ditangani (${
                        storageService.getActiveTicketsForPic(selectedUser.uid).length
                      } aktif)`
                    : `${tickets.filter((t) => t.reporterId === selectedUser.uid).length} tiket dilaporkan`}
                </span>
              </div>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-1 rounded font-bold font-mono-numbers">
                UID: {selectedUser.uid}
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TINJAU & VERIFIKASI PERMOHONAN PENDAFTARAN */}
      {showReviewModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-[#DCEAF7] shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#DCEAF7] pb-3.5">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-[#EFF8FF] text-[#2589E8] flex items-center justify-center border border-[#B8DEFF]/60 shadow-xs">
                  <ShieldCheck className="w-5 h-5 text-[#417F85]" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-[#172B4D]">
                    Tinjau Permohonan Pendaftaran
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs font-bold text-[#417F85] bg-[#E7EFF1] px-2 py-0.5 rounded">
                      {selectedRequest.id}
                    </span>
                    <span className="text-xs text-[#64748B]">·</span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                        selectedRequest.status === 'Menunggu Verifikasi'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : selectedRequest.status === 'Disetujui'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-rose-100 text-rose-900 border border-rose-300'
                      }`}
                    >
                      {selectedRequest.status}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Applicant Summary Card */}
            <div className="bg-[#F5FAFA] p-4 rounded-xl border border-[#D5E0E3] space-y-3">
              <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                Informasi Calon Pengguna
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#64748B] block text-[11px]">Nama Lengkap</span>
                  <span className="font-bold text-[#172B4D]">{selectedRequest.fullName}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[11px]">NIP / ID Pegawai</span>
                  <span className="font-mono font-bold text-[#172B4D]">{selectedRequest.employeeId}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[11px]">Email Korporat</span>
                  <span className="font-medium text-[#172B4D] break-all">{selectedRequest.corporateEmail}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[11px]">Nomor Telepon</span>
                  <span className="font-medium text-[#172B4D]">{selectedRequest.phone || 'Tidak dicantumkan'}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[11px]">Unit Kerja Terpilih</span>
                  <span className="font-semibold text-[#172B4D]">{selectedRequest.unitName}</span>
                </div>
                <div>
                  <span className="text-[#64748B] block text-[11px]">Jabatan / Peran</span>
                  <span className="font-medium text-[#172B4D]">{selectedRequest.position}</span>
                </div>
                <div className="sm:col-span-2 pt-1 border-t border-[#D5E0E3] flex items-center justify-between text-[11px] text-[#64748B]">
                  <span>
                    Diajukan pada: {new Date(selectedRequest.submittedAt).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
                  </span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Ketentuan Disetujui
                  </span>
                </div>
              </div>
            </div>

            {/* If status is "Menunggu Verifikasi", show Action options */}
            {selectedRequest.status === 'Menunggu Verifikasi' ? (
              <div className="space-y-4 pt-1">
                {/* Switcher: Setujui vs Tolak */}
                <div className="flex bg-[#E7EFF1] p-1 rounded-xl border border-[#D5E0E3] text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setReviewTabMode('approve')}
                    className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      reviewTabMode === 'approve'
                        ? 'bg-white text-[#417F85] shadow-xs border border-[#D5E0E3]'
                        : 'text-[#64748B] hover:text-[#172B4D]'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Setujui Permohonan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewTabMode('reject')}
                    className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      reviewTabMode === 'reject'
                        ? 'bg-white text-rose-700 shadow-xs border border-[#D5E0E3]'
                        : 'text-[#64748B] hover:text-[#172B4D]'
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Tolak Permohonan</span>
                  </button>
                </div>

                {reviewTabMode === 'approve' ? (
                  <div className="space-y-3.5 bg-emerald-50/30 p-4 rounded-xl border border-emerald-200">
                    <div>
                      <label className="block text-xs font-bold text-[#172B4D] mb-1.5">
                        Tetapkan Hak Akses (Role) Pengguna <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={assignedRoleChoice}
                        onChange={(e) => setAssignedRoleChoice(e.target.value as Role)}
                        className="w-full text-xs py-2 px-3 bg-white border border-[#DCEAF7] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#172B4D] font-bold cursor-pointer"
                      >
                        <option value="pelapor">Pelapor 11 UPDL / Unit (Standar Pengguna Layanan)</option>
                        <option value="pic">Petugas PIC Helpdesk (Penanganan Kendala & Tiket)</option>
                        <option value="manajemen">Manajemen CorpU (Monitoring Eksekutif & Laporan)</option>
                        <option value="admin">Administrator Ticketing (Pengelolaan Penuh Helpdesk)</option>
                      </select>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-emerald-200 text-[11px] text-[#64748B] space-y-1">
                      <p className="font-bold text-emerald-900">Deskripsi Hak Akses yang Dipilih:</p>
                      {assignedRoleChoice === 'pelapor' && (
                        <p>Dapat membuat tiket permohonan/keluhan baru, memantau riwayat tiket sendiri, dan memberikan rating/feedback.</p>
                      )}
                      {assignedRoleChoice === 'pic' && (
                        <p>Dapat menerima disposisi tiket, mengubah status pengerjaan, mengunggah bukti penyelesaian kendala, dan mencatat progres.</p>
                      )}
                      {assignedRoleChoice === 'manajemen' && (
                        <p>Dapat memantau seluruh tiket, performa SLA unit UPDL, monitoring beban kerja PIC, serta laporan analitik.</p>
                      )}
                      {assignedRoleChoice === 'admin' && (
                        <p>Memiliki wewenang administrator helpdesk penuh, manajemen pengguna, verifikasi permohonan, dan konfigurasi SLA.</p>
                      )}
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => setShowReviewModal(false)}
                        className="px-3.5 py-2 text-xs font-bold text-[#64748B] hover:text-[#172B4D] cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={isProcessingReg}
                        onClick={handleConfirmApprove}
                        className="px-4 py-2 bg-[#417F85] hover:bg-[#326A70] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isProcessingReg ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Menyimpan...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Setujui & Aktifkan Akun</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5 bg-rose-50/40 p-4 rounded-xl border border-rose-200">
                    <div>
                      <label className="block text-xs font-bold text-rose-900 mb-1.5">
                        Alasan Penolakan Permohonan <span className="text-rose-600">*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={rejectionReasonText}
                        onChange={(e) => setRejectionReasonText(e.target.value)}
                        placeholder="Masukkan alasan penolakan yang jelas untuk pemohon..."
                        className="w-full text-xs p-3 bg-white border border-rose-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-[#172B4D] placeholder:text-rose-300 font-medium"
                      />
                    </div>

                    {/* Quick suggestion buttons */}
                    <div>
                      <span className="text-[10px] font-bold text-rose-800 block mb-1">
                        Pilihan Alasan Cepat:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          'NIP tidak ditemukan dalam master data HRMS kepegawaian',
                          'Email yang digunakan bukan email korporat resmi PLN',
                          'Unit penugasan tidak sesuai dengan data kepegawaian',
                          'Pengajuan akun ganda dengan identitas serupa',
                        ].map((txt) => (
                          <button
                            key={txt}
                            type="button"
                            onClick={() => setRejectionReasonText(txt)}
                            className="text-[10px] bg-white hover:bg-rose-100 text-rose-800 border border-rose-200 px-2 py-1 rounded-md transition-colors cursor-pointer text-left"
                          >
                            + {txt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => setShowReviewModal(false)}
                        className="px-3.5 py-2 text-xs font-bold text-[#64748B] hover:text-[#172B4D] cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={isProcessingReg || !rejectionReasonText.trim()}
                        onClick={handleConfirmReject}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isProcessingReg ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Memproses...</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Tolak Permohonan</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Already processed: Show audit resolution */
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="font-bold text-[#172B4D] flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-[#2589E8]" />
                  <span>Riwayat Disposisi Permohonan</span>
                </div>
                <div className="text-[11px] text-[#64748B] space-y-1">
                  <div>
                    <span className="font-semibold text-slate-700">Diverifikasi oleh:</span>{' '}
                    {selectedRequest.processedByAdminName || 'Admin Ticketing'}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Waktu Pemrosesan:</span>{' '}
                    {selectedRequest.processedAt
                      ? new Date(selectedRequest.processedAt).toLocaleString('id-ID', {
                          dateStyle: 'long',
                          timeStyle: 'short',
                        })
                      : '-'}
                  </div>
                  {selectedRequest.status === 'Disetujui' && (
                    <div>
                      <span className="font-semibold text-emerald-800">Peran yang Ditetapkan:</span>{' '}
                      <span className="font-bold uppercase text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                        {selectedRequest.assignedRole}
                      </span>
                    </div>
                  )}
                  {selectedRequest.status === 'Ditolak' && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 mt-2">
                      <span className="font-bold block">Alasan Penolakan:</span>
                      <p className="mt-0.5 leading-relaxed">{selectedRequest.rejectionReason}</p>
                    </div>
                  )}
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setShowReviewModal(false)}
                    className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700 cursor-pointer"
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
