import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ShieldCheck,
  ArrowRight,
  HelpCircle,
  CheckCircle2,
  Search,
  Clock,
  XCircle,
  X,
  FileText,
  Info,
} from 'lucide-react';
import { User as UserType, RegistrationRequest } from '../types';
import { signInWithApi } from '../services/authApiService';

interface LoginViewProps {
  onLoginSuccess: (user: UserType) => void;
  onNavigateToRegister?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, onNavigateToRegister }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status Check Modal State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusSearchQuery, setStatusSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<RegistrationRequest | null | 'NOT_FOUND'>(null);
  const [isSearchingStatus, setIsSearchingStatus] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setErrorMessage('Mohon masukkan NIP / Email korporat dan kata sandi Anda.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = await signInWithApi(identifier.trim(), password);
      if (result.user) {
        onLoginSuccess(result.user);
      } else {
        setErrorMessage(result.error || 'Email atau kata sandi tidak valid. Silakan coba kembali.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Terjadi kendala saat menghubungi server autentikasi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E7EFF1] flex flex-col justify-center items-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#417F85] text-white shadow-md border border-white/20 transition-transform duration-200 hover:scale-105">
            <svg className="w-8 h-8 fill-current text-amber-300" viewBox="0 0 24 24">
              <path d="M13 2L3 14h8l-2 8 10-12h-8l2-8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#20272B] tracking-tight">
              PLN CORPORATE UNIVERSITY
            </h1>
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#35666D] mt-0.5">
              TICKETING MANAGEMENT SYSTEM
            </p>
          </div>
          <p className="text-xs text-[#69777D] max-w-sm mx-auto">
            Portal Layanan Terpadu Kendala Pembelajaran Digital HXMS, Jaringan, dan Fasilitas Pelatihan PLN Pusdiklat
          </p>
        </div>

        {/* Main Login Card - Card/Panel #F5FAFA with Border #D5E0E3 */}
        <div className="bg-[#F5FAFA] p-6 sm:p-8 rounded-2xl border border-[#D5E0E3] shadow-md space-y-5">
          <div className="flex items-center justify-between border-b border-[#D5E0E3] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[#20272B]">Masuk ke Portal Layanan</h2>
              <p className="text-xs text-[#69777D] mt-0.5">
                Gunakan email korporat yang telah diverifikasi
              </p>
            </div>
            <span className="px-2.5 py-1 bg-[#E7EFF1] text-[#35666D] text-[10px] font-bold rounded-md border border-[#D5E0E3] uppercase tracking-wider">
              Akun Ticketing
            </span>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-in fade-in-50">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="leading-relaxed font-semibold">{errorMessage}</span>
                <p className="text-[11px] text-rose-700">
                  Pastikan NIP atau alamat email perusahaan yang dimasukkan sudah benar dan aktif.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Identifier: NIP or Corporate Email */}
            <div>
              <label className="block text-xs font-bold text-[#20272B] mb-1.5">
                Email Korporat <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  autoComplete="username"
                  disabled={isLoading}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="nama@perusahaan.co.id"
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-[#FFFFFF] border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D] font-medium transition-all duration-200 disabled:bg-[#B3BDC9]/30 disabled:text-[#69777D] shadow-2xs"
                />
                <Mail className="w-4 h-4 text-[#417F85] absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#20272B]">
                  Kata Sandi <span className="text-rose-500">*</span>
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Masukkan kata sandi akun Anda"
                  className="w-full text-xs pl-9 pr-10 py-2.5 bg-[#FFFFFF] border border-[#D5E0E3] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D] font-medium transition-all duration-200 disabled:bg-[#B3BDC9]/30 disabled:text-[#69777D] shadow-2xs"
                />
                <Lock className="w-4 h-4 text-[#417F85] absolute left-3 top-3 pointer-events-none" />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-[#69777D] hover:text-[#20272B] cursor-pointer focus:outline-hidden transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="text-xs text-[#69777D]">Sesi aman berlaku maksimal 8 jam</span>
            </div>

            {/* Submit Button - Teal #417F85 Hover #326A70 */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-[#417F85] hover:bg-[#326A70] active:scale-[0.98] disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-xs transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer btn-press"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Memverifikasi Kredensial...</span>
                  </>
                ) : (
                  <>
                    <span>Masuk ke Sistem</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Section: Belum memiliki akun? Daftar Akun */}
          <div className="pt-3 pb-1 border-t border-[#D5E0E3] text-center space-y-1">
            <div className="text-xs text-[#20272B]">
              <span className="text-[#69777D]">Belum memiliki akun?</span>{' '}
              <button
                type="button"
                onClick={onNavigateToRegister}
                className="font-bold text-[#417F85] hover:text-[#326A70] hover:underline cursor-pointer transition-colors inline-flex items-center gap-1 focus:outline-hidden"
              >
                <span>Daftar Akun</span>
              </button>
            </div>
            <p className="text-[11px] text-[#69777D]">
              Daftarkan akun untuk mengakses layanan Ticketing PLN Corporate University.
            </p>
          </div>

          {/* Help & Assistance note */}
          <div className="pt-2 border-t border-[#D5E0E3] text-[11px] text-[#69777D] flex items-start gap-2 bg-[#E7EFF1] p-2.5 rounded-xl border border-[#D5E0E3]">
            <HelpCircle className="w-4 h-4 text-[#417F85] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#20272B]">Bantuan Masuk:</span> Akun resmi terdaftar menggunakan NIP atau email korporat (Admin Ticketing, Manajemen CorpU, Petugas PIC 1–3, atau Pelapor 11 UPDL).
            </div>
          </div>
        </div>

        {/* Security & Copyright info */}
        <div className="text-center text-[11px] text-[#69777D] space-y-1">
          <p className="flex items-center justify-center gap-1 font-medium text-[#35666D]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#417F85]" />
            Koneksi Terenkripsi · Portal Autentikasi Tunggal PLN CorpU
          </p>
              <p>© 2026 PT PLN (Persero) Corporate University. Hak Cipta Dilindungi.</p>
        </div>
      </div>
    </div>
  );
};
