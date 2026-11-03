import React, { useEffect, useState } from 'react';
import {
  User as UserIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building,
  Briefcase,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  FileCheck,
  BadgeAlert,
  Info,
} from 'lucide-react';
import { RegistrationRequest, Unit, UnitRegion } from '../types';

interface RegisterViewProps {
  onNavigateToLogin: () => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({ onNavigateToLogin }) => {
  // Form fields
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [corporateEmail, setCorporateEmail] = useState('');
  const [unitCategory, setUnitCategory] = useState<'UPDL' | 'CORPU' | 'NON_UPDL'>('UPDL');
  const [unitId, setUnitId] = useState('');
  const [manualUnitName, setManualUnitName] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // UI interaction states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedRequest, setSubmittedRequest] = useState<RegistrationRequest | null>(null);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/units', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Gagal memuat master unit dari database.');
        }
        if (cancelled) return;
        const units: Unit[] = (data.units || []).map((unit: any) => ({
          unitId: unit.id,
          unitCode: unit.unit_code,
          unitName: unit.unit_name,
          unitRegion: (unit.unit_region || 'Non-UPDL') as UnitRegion,
          unitFocus: unit.unit_focus,
          unitType: unit.unit_type,
          isActive: Boolean(unit.is_active),
          createdAt: unit.created_at,
          updatedAt: unit.updated_at,
        }));
        setAvailableUnits(units);
        const firstUnit = units.find((unit) => unit.unitType === 'UPDL');
        if (firstUnit) setUnitId((current) => current || firstUnit.unitId);
      })
      .catch(() => {
        if (!cancelled) setErrorMessage('Gagal menghubungi API PostgreSQL untuk memuat master unit.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingUnits(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const categoryUnits = availableUnits.filter((u) => u.isActive && u.unitType === unitCategory);

  const handleCategoryChange = (newCat: 'UPDL' | 'CORPU' | 'NON_UPDL') => {
    setUnitCategory(newCat);
    setManualUnitName('');
    const matching = availableUnits.filter((u) => u.isActive && u.unitType === newCat);
    if (newCat === 'CORPU') {
      setUnitId(matching[0]?.unitId || '');
    } else if (matching.length > 0) {
      setUnitId(matching[0].unitId);
    } else {
      setUnitId('__OTHER__');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // 1. Validation checks
    const cleanName = fullName.trim();
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    const cleanNip = employeeId.trim();
    const cleanEmail = corporateEmail.trim().toLowerCase();
    const cleanDepartment = department.trim();
    const cleanPosition = position.trim();
    const cleanPhone = phone.trim();
    const isManual = unitId === '__OTHER__';
    const cleanManualUnit = manualUnitName.trim().replace(/\s+/g, ' ');

    if (!cleanName) {
      setErrorMessage('Nama lengkap wajib diisi sesuai identitas resmi.');
      return;
    }

    if (!cleanNip) {
      setErrorMessage('ID Pegawai atau NIP wajib diisi.');
      return;
    }

    if (cleanNip.length < 5) {
      setErrorMessage('Format NIP / ID Pegawai terlalu pendek (minimal 5 karakter).');
      return;
    }

    if (!cleanEmail) {
      setErrorMessage('Email korporat wajib diisi.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage('Format alamat email tidak valid.');
      return;
    }

    if (!cleanPosition) {
      setErrorMessage('Jabatan atau peran pekerjaan wajib diisi.');
      return;
    }

    if (!cleanDepartment) {
      setErrorMessage('Divisi atau departemen wajib diisi.');
      return;
    }

    if (isManual) {
      if (!cleanManualUnit) {
        setErrorMessage('Nama unit yang diajukan wajib diisi ketika memilih opsi "+ Unit lainnya (ketik sendiri)".');
        return;
      }
      if (cleanManualUnit.length < 3) {
        setErrorMessage('Nama unit yang diajukan minimal 3 karakter.');
        return;
      }
      if (cleanManualUnit.length > 100) {
        setErrorMessage('Nama unit yang diajukan terlalu panjang (maksimal 100 karakter).');
        return;
      }
    }

    if (!password) {
      setErrorMessage('Kata sandi wajib diisi.');
      return;
    }

    if (password.length < 12) {
      setErrorMessage('Kata sandi minimal terdiri dari 12 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Konfirmasi kata sandi tidak cocok dengan kata sandi yang dimasukkan.');
      return;
    }

    if (!agreedToTerms) {
      setErrorMessage('Anda harus menyetujui ketentuan penggunaan sistem dan kebijakan akses layanan.');
      return;
    }

    // 2. Resolve selected unit
    let finalUnitName = '';

    if (isManual) {
      finalUnitName = cleanManualUnit;
    } else {
      const selectedUnit = availableUnits.find((u) => u.unitId === unitId);
      if (!selectedUnit) {
        setErrorMessage('Pilih unit aktif dari master data database.');
        return;
      }
      finalUnitName = selectedUnit.unitName;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          username: cleanUsername,
          employeeId: cleanNip,
          fullName: cleanName,
          department: cleanDepartment,
          position: cleanPosition,
          phone: cleanPhone || null,
          unitId: isManual ? null : unitId,
          requestedUnitName: isManual ? cleanManualUnit : null,
          unitType: unitCategory,
          isManualUnit: isManual,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Pendaftaran gagal disimpan.');
      if (!data?.submitted || !data?.requestId) {
        throw new Error('Server tidak mengembalikan konfirmasi permohonan.');
      }
      setSubmittedRequest({
        id: data.requestId,
        username: cleanUsername,
        fullName: cleanName,
        employeeId: cleanNip,
        corporateEmail: cleanEmail,
        unitId: isManual ? '' : unitId,
        unitName: finalUnitName,
        unitCode: isManual ? '' : availableUnits.find((unit) => unit.unitId === unitId)?.unitCode || '',
        unitType: unitCategory,
        position: cleanPosition,
        phone: cleanPhone || undefined,
        passwordHash: '',
        agreedToTerms: true,
        status: 'Menunggu Verifikasi',
        submittedAt: data.submittedAt,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kendala saat menyimpan permohonan ke database.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E7EFF1] flex flex-col justify-center items-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full space-y-5 animate-page-enter">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#417F85] text-white shadow-md border border-white/20 transition-transform duration-200 hover:scale-105">
            <svg className="w-7 h-7 fill-current text-amber-300" viewBox="0 0 24 24">
              <path d="M13 2L3 14h8l-2 8 10-12h-8l2-8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-[#20272B] tracking-tight">
              PLN CORPORATE UNIVERSITY
            </h1>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#35666D] mt-0.5">
              TICKETING MANAGEMENT SYSTEM
            </p>
          </div>
        </div>

        {/* Card: Success State or Registration Form */}
        {submittedRequest ? (
          <div className="bg-[#F5FAFA] p-6 sm:p-8 rounded-2xl border border-[#D5E0E3] shadow-md space-y-6 animate-card-enter">
            {/* Header Success */}
            <div className="text-center space-y-3 pb-4 border-b border-[#D5E0E3]">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-300 shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <span className="inline-block px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-[11px] font-extrabold font-mono uppercase tracking-wider mb-2">
                  Status: Menunggu Verifikasi
                </span>
                <h2 className="text-lg font-bold text-[#20272B]">
                  Pendaftaran Berhasil Diajukan
                </h2>
                <p className="text-xs text-[#69777D] mt-1 max-w-md mx-auto leading-relaxed">
                  Pendaftaran berhasil diajukan. Akun Anda sedang menunggu verifikasi Admin Ticketing. Anda dapat masuk setelah akun disetujui dan diaktifkan.
                </p>
              </div>
            </div>

            {/* Submission Summary Box */}
            <div className="bg-[#FFFFFF] p-4 rounded-xl border border-[#D5E0E3] shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#D5E0E3]">
                <span className="text-xs font-bold text-[#69777D] uppercase tracking-wider">
                  Nomor Permohonan
                </span>
                <span className="font-mono text-xs font-bold text-[#35666D] bg-[#E7EFF1] px-2.5 py-0.5 rounded border border-[#D5E0E3]">
                  {submittedRequest.id}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div>
                  <span className="text-[#69777D] block text-[11px]">Nama Lengkap</span>
                  <span className="font-bold text-[#20272B]">{submittedRequest.fullName}</span>
                </div>
                <div>
                  <span className="text-[#69777D] block text-[11px]">NIP / ID Pegawai</span>
                  <span className="font-mono font-bold text-[#20272B]">{submittedRequest.employeeId}</span>
                </div>
                <div>
                  <span className="text-[#69777D] block text-[11px]">Email Korporat</span>
                  <span className="font-medium text-[#20272B] break-all">{submittedRequest.corporateEmail}</span>
                </div>
                <div>
                  <span className="text-[#69777D] block text-[11px]">Unit Kerja</span>
                  <span className="font-medium text-[#20272B]">{submittedRequest.unitName}</span>
                </div>
                <div>
                  <span className="text-[#69777D] block text-[11px]">Jabatan / Peran</span>
                  <span className="font-medium text-[#20272B]">{submittedRequest.position}</span>
                </div>
                <div>
                  <span className="text-[#69777D] block text-[11px]">Waktu Pengajuan</span>
                  <span className="font-medium text-[#20272B]">
                    {new Date(submittedRequest.submittedAt).toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Important Notes */}
            <div className="p-3 bg-[#E7EFF1] border border-[#D5E0E3] rounded-xl text-xs text-[#35666D] flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#417F85] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-[#20272B]">Alur Verifikasi Perusahaan:</p>
                <p className="text-[11px] text-[#69777D] leading-relaxed">
                  Administrator Ticketing akan memverifikasi data kepegawaian sesuai prosedur perusahaan dan menetapkan unit serta hak akses akun. Integrasi otomatis HRMS tidak termasuk dalam aplikasi ini.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2">
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="w-full py-2.5 px-4 bg-[#417F85] hover:bg-[#326A70] active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-xs transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer btn-press"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Halaman Masuk</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-[#F5FAFA] p-6 sm:p-8 rounded-2xl border border-[#D5E0E3] shadow-md space-y-5">
            {/* Form Header */}
            <div className="flex items-center justify-between border-b border-[#D5E0E3] pb-3.5">
              <div>
                <h2 className="text-base font-bold text-[#20272B]">Daftar Akun Portal Layanan</h2>
                <p className="text-xs text-[#69777D] mt-0.5">
                  Lengkapi data berikut untuk mengajukan akses ke Ticketing PLN Corporate University.
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="px-2.5 py-1 text-xs text-[#417F85] hover:text-[#326A70] font-semibold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali</span>
              </button>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in-50">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="leading-relaxed font-semibold">{errorMessage}</span>
                  <p className="text-[11px] text-rose-700">
                    Silakan periksa kembali data yang Anda masukkan sebelum mengajukan pendaftaran.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Row 1: Nama Lengkap & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#20272B] mb-1.5">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      disabled={isLoading}
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Contoh: Rizky Pratama, S.T."
                      className="w-full text-xs pl-9 pr-3 py-2 bg-[#FFFFFF] border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D] font-medium transition-all duration-200 disabled:bg-[#B3BDC9]/30 shadow-2xs"
                    />
                    <UserIcon className="w-4 h-4 text-[#417F85] absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#20272B] mb-1.5">
                    Username / ID Login <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      disabled={isLoading}
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Contoh: rizky.pratama"
                      className="w-full text-xs pl-9 pr-3 py-2 bg-[#FFFFFF] border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D] font-medium transition-all duration-200 disabled:bg-[#B3BDC9]/30 shadow-2xs font-mono"
                    />
                    <UserIcon className="w-4 h-4 text-[#417F85] absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Row 2: NIP & Email Korporat (Grid 2 cols on tablet/desktop) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#20272B] mb-1.5">
                    NIP / ID Pegawai <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      disabled={isLoading}
                      value={employeeId}
                      onChange={(e) => {
                        setEmployeeId(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Contoh: 19950714-PLN-BJB"
                      className="w-full text-xs pl-9 pr-3 py-2 bg-[#FFFFFF] border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D] font-medium transition-all duration-200 disabled:bg-[#B3BDC9]/30 shadow-2xs"
                    />
                    <Briefcase className="w-4 h-4 text-[#417F85] absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#20272B] mb-1.5">
                    Email Korporat <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      disabled={isLoading}
                      value={corporateEmail}
                      onChange={(e) => {
                        setCorporateEmail(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="nama@pln.co.id atau @pln-corpu.co.id"
                      className="w-full text-xs pl-9 pr-3 py-2 bg-[#FFFFFF] border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D] font-medium transition-all duration-200 disabled:bg-[#B3BDC9]/30 shadow-2xs"
                    />
                    <Mail className="w-4 h-4 text-[#417F85] absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Row 3: Unit Kerja / UPDL Selection */}
              <div className="space-y-2 p-3 bg-white/70 border border-[#D5E0E3] rounded-xl">
                <label className="block text-xs font-bold text-[#20272B]">
                  Kelompok & Unit Kerja Penugasan <span className="text-rose-500">*</span>
                </label>
                
                {/* Category selector */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#E7EFF1] rounded-lg">
                  <button
                    type="button"
                    onClick={() => handleCategoryChange('UPDL')}
                    className={`py-1.5 px-2 text-[11px] font-bold rounded-md transition-all text-center ${
                      unitCategory === 'UPDL'
                        ? 'bg-[#417F85] text-white shadow-2xs'
                        : 'text-[#69777D] hover:text-[#20272B]'
                    }`}
                  >
                    11 Unit UPDL
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCategoryChange('CORPU')}
                    className={`py-1.5 px-2 text-[11px] font-bold rounded-md transition-all text-center ${
                      unitCategory === 'CORPU'
                        ? 'bg-[#417F85] text-white shadow-2xs'
                        : 'text-[#69777D] hover:text-[#20272B]'
                    }`}
                  >
                    PLN CorpU
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCategoryChange('NON_UPDL')}
                    className={`py-1.5 px-2 text-[11px] font-bold rounded-md transition-all text-center ${
                      unitCategory === 'NON_UPDL'
                        ? 'bg-[#417F85] text-white shadow-2xs'
                        : 'text-[#69777D] hover:text-[#20272B]'
                    }`}
                  >
                    PLN Umum / Lain
                  </button>
                </div>

                {/* Unit dropdown */}
                <div className="relative">
                  <select
                    disabled={isLoading || isLoadingUnits}
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 bg-[#FFFFFF] border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] font-medium transition-all duration-200 disabled:bg-[#B3BDC9]/30 shadow-2xs cursor-pointer"
                  >
                    {isLoadingUnits && <option value="">Memuat master unit...</option>}
                    {!isLoadingUnits && categoryUnits.length === 0 && <option value="" disabled>Tidak ada unit terdaftar pada kategori ini</option>}
                    {categoryUnits.map((u) => (
                      <option key={u.unitId} value={u.unitId}>
                        {u.unitName} {u.unitRegion ? `(${u.unitRegion})` : ''}
                      </option>
                    ))}
                    <option value="__OTHER__">+ Unit lainnya (ketik sendiri)...</option>
                  </select>
                  <Building className="w-4 h-4 text-[#417F85] absolute left-3 top-2.5 pointer-events-none" />
                </div>

                {/* Manual Unit Input if __OTHER__ */}
                {unitId === '__OTHER__' && (
                  <div className="pt-1.5 animate-card-enter space-y-1">
                    <label className="block text-[11px] font-bold text-[#35666D]">
                      Ketik Nama Resmi Unit PLN Anda <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={manualUnitName}
                      onChange={(e) => setManualUnitName(e.target.value)}
                      placeholder="Contoh: PLN UPDL Jayapura atau PLN UIW Maluku"
                      className="w-full text-xs px-3 py-2 bg-[#FFFFFF] border-2 border-amber-400 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D] font-medium shadow-2xs"
                    />
                    <p className="text-[10px] text-amber-700">
                      Unit ini akan diverifikasi Admin; nama yang diketik tidak otomatis menjadi unit resmi.
                    </p>
                  </div>
                )}
                
                <p className="text-[10px] text-[#69777D]">
                  Pilih unit penugasan tempat Anda bertugas saat ini. Hak akses tiket dan menu akan disesuaikan otomatis dengan unit ini.
                </p>
              </div>

              {/* Row 4: Departemen, Jabatan & Nomor Telepon */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#20272B] mb-1.5">
                    Divisi / Departemen <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      disabled={isLoading}
                      value={department}
                      onChange={(e) => {
                        setDepartment(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Contoh: Divisi Pengembangan SDM"
                      className="w-full text-xs pl-9 pr-3 py-2 bg-[#FFFFFF] border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D] font-medium transition-all duration-200 disabled:bg-[#B3BDC9]/30 shadow-2xs"
                    />
                    <Building className="w-4 h-4 text-[#417F85] absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#20272B] mb-1.5">
                    Jabatan / Peran Pekerjaan <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      disabled={isLoading}
                      value={position}
                      onChange={(e) => {
                        setPosition(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Contoh: Instruktur / Staff IT"
                      className="w-full text-xs pl-9 pr-3 py-2 bg-[#FFFFFF] border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D] font-medium transition-all duration-200 disabled:bg-[#B3BDC9]/30 shadow-2xs"
                    />
                    <Briefcase className="w-4 h-4 text-[#417F85] absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#20272B] mb-1.5">
                    Nomor Telepon / WhatsApp <span className="text-[#69777D] font-normal">(Opsional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      disabled={isLoading}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Contoh: 0812-3456-7890"
                      className="w-full text-xs pl-9 pr-3 py-2 bg-[#FFFFFF] border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D] font-medium transition-all duration-200 disabled:bg-[#B3BDC9]/30 shadow-2xs"
                    />
                    <Phone className="w-4 h-4 text-[#417F85] absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Row 5: Kata Sandi & Konfirmasi Kata Sandi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#20272B] mb-1.5">
                    Kata Sandi <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      disabled={isLoading}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      minLength={12}
                      placeholder="Minimal 12 karakter"
                      className="w-full text-xs pl-9 pr-10 py-2 bg-[#FFFFFF] border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D] font-medium transition-all duration-200 disabled:bg-[#B3BDC9]/30 shadow-2xs"
                    />
                    <Lock className="w-4 h-4 text-[#417F85] absolute left-3 top-2.5 pointer-events-none" />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2 text-[#69777D] hover:text-[#20272B] cursor-pointer focus:outline-hidden"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#20272B] mb-1.5">
                    Konfirmasi Kata Sandi <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      disabled={isLoading}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Ulangi kata sandi"
                      className="w-full text-xs pl-9 pr-10 py-2 bg-[#FFFFFF] border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D] font-medium transition-all duration-200 disabled:bg-[#B3BDC9]/30 shadow-2xs"
                    />
                    <Lock className="w-4 h-4 text-[#417F85] absolute left-3 top-2.5 pointer-events-none" />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2 text-[#69777D] hover:text-[#20272B] cursor-pointer focus:outline-hidden"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Checkbox Persetujuan Kebijakan */}
              <div className="pt-1">
                <label className="flex items-start gap-2.5 cursor-pointer select-none text-xs text-[#20272B]">
                  <input
                    type="checkbox"
                    required
                    checked={agreedToTerms}
                    onChange={(e) => {
                      setAgreedToTerms(e.target.checked);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    className="mt-0.5 rounded border-[#D5E0E3] text-[#417F85] focus:ring-[#417F85] cursor-pointer"
                  />
                  <span className="leading-relaxed text-[#69777D]">
                    Saya menyetujui ketentuan penggunaan sistem dan kebijakan akses layanan Ticketing PLN Corporate University. Data yang saya isi adalah benar dan sah. <span className="text-rose-500">*</span>
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-[#417F85] hover:bg-[#326A70] active:scale-[0.98] disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-xs transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer btn-press"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Memproses Pengajuan...</span>
                    </>
                  ) : (
                    <>
                      <span>Ajukan Pendaftaran</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Back to Login Link */}
            <div className="pt-3 border-t border-[#D5E0E3] text-center">
              <span className="text-xs text-[#69777D]">Sudah memiliki akun?</span>{' '}
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="text-xs font-bold text-[#417F85] hover:text-[#326A70] hover:underline cursor-pointer transition-colors inline-flex items-center gap-1 focus:outline-hidden"
              >
                <span>Masuk ke Sistem</span>
              </button>
            </div>
          </div>
        )}

        {/* Security & Copyright info */}
        <div className="text-center text-[11px] text-[#69777D] space-y-1">
          <p className="flex items-center justify-center gap-1 font-medium text-[#35666D]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#417F85]" />
            Verifikasi Otoritas Terpusat · PT PLN (Persero) Corporate University
          </p>
          <p>© 2026 PT PLN (Persero) Corporate University. Hak Cipta Dilindungi.</p>
        </div>
      </div>
    </div>
  );
};
