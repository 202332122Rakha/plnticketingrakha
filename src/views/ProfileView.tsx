import React from 'react';
import {
  User,
  Shield,
  Mail,
  Phone,
  Building,
  CheckCircle2,
  Clock,
  Ticket,
} from 'lucide-react';
import { User as UserType, Ticket as TicketType } from '../types';

interface ProfileViewProps {
  currentUser: UserType;
  tickets: TicketType[];
  onNavigate: (view: string, ticketId?: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  tickets,
  onNavigate,
}) => {
  const userTickets = tickets.filter((t) => t.reporterId === currentUser.uid);
  const assignedTickets = tickets.filter((t) => t.currentPicId === currentUser.uid);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Profile Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 border-b border-slate-100 pb-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-800 text-white font-extrabold text-2xl flex items-center justify-center shadow-xs">
            {currentUser.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900">{currentUser.name}</h1>
              <span className="bg-emerald-100 text-emerald-800 text-xs uppercase font-extrabold px-2.5 py-0.5 rounded-full">
                {currentUser.role}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono-numbers">NIP: {currentUser.employeeId}</p>
            <p className="text-xs text-slate-600 font-medium">{currentUser.department}</p>
          </div>
        </div>

        {/* Contact & Organization Details with Official Work Unit */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-emerald-700" />
              Email Perusahaan
            </span>
            <p className="font-semibold text-slate-800 truncate">{currentUser.email}</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-700" />
              Kontak / Telepon
            </span>
            <p className="font-semibold text-slate-800 font-mono-numbers">{currentUser.phone || '-'}</p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-emerald-700" />
              Unit Kerja Terdaftar (Read-Only)
            </span>
            <p className="font-extrabold text-[#35666D] truncate">
              {currentUser.unitName || 'Unit belum ditentukan'}
            </p>
            <span className="text-[10px] text-[#69777D] block font-mono">
              Kode: {currentUser.unitCode || '-'} · {currentUser.unitType || 'UPDL'}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-700" />
              Status Unit
            </span>
            <p className="font-semibold text-slate-800">Unit Resmi Terverifikasi</p>
            <span className="text-[10px] text-[#417F85] block font-medium">
              Terkunci sesuai akun resmi
            </span>
          </div>
        </div>

        {/* Privileges Breakdown */}
        <div className="pt-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Hak Akses & Otorisasi Sistem ({currentUser.role.toUpperCase()})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
            {currentUser.role === 'admin' && (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Verifikasi & Triase seluruh tiket laporan</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Penetapan dan penggantian petugas PIC</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Penyesuaian prioritas dan matriks SLA</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Akses penuh Audit Log & Laporan Kinerja</span>
                </div>
              </>
            )}

            {currentUser.role === 'pic' && (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Menerima & menangani penugasan tiket teknis</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Mencatat progres teknis & catatan internal rahasia</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Meminta informasi tambahan dari pelapor</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Mendokumentasikan solusi & menyelesaikan tiket</span>
                </div>
              </>
            )}

            {currentUser.role === 'pelapor' && (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Menerbitkan tiket laporan insiden & keluhan</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Melacak progres penyelesaian secara real-time</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Berkomunikasi langsung dengan petugas melalui pesan</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Mengonfirmasi hasil solusi atau mengajukan buka kembali</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
