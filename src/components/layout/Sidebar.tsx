import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  Ticket,
  PlusCircle,
  Inbox,
  ClipboardList,
  Bell,
  Users,
  UserCog,
  Layers,
  Clock,
  BarChart3,
  ShieldCheck,
  Settings,
  User,
  LogOut,
  Sparkles,
  UserCheck,
  Building2,
  Building,
  GraduationCap,
  X,
} from 'lucide-react';
import { User as UserType } from '../../types';
import { storageService } from '../../services/storageService';
import { canAccessUnitType } from '../../utils/authPermissions';

interface SidebarProps {
  currentView: string;
  selectedUnitId?: string | null;
  onNavigate: (view: string, id?: string) => void;
  currentUser: UserType;
  counts: {
    allTickets: number;
    myTickets: number;
    assignedTickets: number;
    notifications: number;
    pendingRegistrations?: number;
    updlTickets?: number;
    corpuTickets?: number;
    nonUpdlTickets?: number;
  };
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  selectedUnitId,
  onNavigate,
  currentUser,
  counts,
  onLogout,
  isOpen = false,
  onClose,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const isPic = currentUser.role === 'pic';
  const isPelapor = currentUser.role === 'pelapor';
  const isManajemen = currentUser.role === 'manajemen';

  // Handle ESC key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Total active tickets count for all UPDL units
  const totalUpdlActiveCount = useMemo(() => {
    return storageService.getUpdlActiveCount(currentUser);
  }, [counts.allTickets, currentUser]);

  const handleItemClick = (id: string) => {
    if (id === 'unit-tickets') {
      const defaultTarget = isAdmin || isManajemen ? 'ALL' : (currentUser.unitId || 'ALL');
      onNavigate('unit-tickets', defaultTarget);
    } else {
      onNavigate(id);
    }
    if (onClose) {
      onClose();
    }
  };

  const navItem = (
    id: string,
    label: string,
    Icon: React.ElementType,
    badgeCount?: number
  ) => {
    const isActive =
      id === 'unit-tickets'
        ? currentView === 'unit-tickets' || currentView === 'updl-tickets' || currentView === 'units-overview'
        : currentView === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => handleItemClick(id)}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-all duration-200 group cursor-pointer relative select-none ${
          isActive
            ? 'bg-[#E7EFF1] text-[#35666D] font-bold border-l-4 border-[#417F85] shadow-2xs'
            : 'text-[#69777D] hover:text-[#20272B] hover:bg-[#E7EFF1]/70 border-l-4 border-transparent active:scale-[0.985]'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Icon
            className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-105 ${
              isActive ? 'text-[#417F85] scale-105' : 'text-[#69777D] group-hover:text-[#417F85]'
            }`}
          />
          <span className="truncate">{label}</span>
        </div>
        {typeof badgeCount === 'number' && badgeCount > 0 && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono-numbers shrink-0 transition-all duration-200 ${
              isActive
                ? 'bg-[#417F85] text-white shadow-2xs scale-105'
                : 'bg-[#E7EFF1] text-[#35666D] border border-[#D5E0E3]'
            }`}
          >
            {badgeCount}
          </span>
        )}
      </button>
    );
  };

  const sidebarContent = (
    <>
      {/* Mobile Drawer Header */}
      <div className="lg:hidden p-3.5 bg-[#35666D] text-white flex items-center justify-between border-b border-[#2C555B] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#417F85] flex items-center justify-center text-amber-300">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M13 2L3 14h8l-2 8 10-12h-8l2-8z" />
            </svg>
          </div>
          <div>
            <div className="font-extrabold text-xs tracking-tight leading-tight">PLN CORP UNIVERSITY</div>
            <div className="text-[10px] text-[#E7EFF1] tracking-wider uppercase">Ticketing System</div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Tutup menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable menu content */}
      <div className="p-3 space-y-5 flex-1 overflow-y-auto">
        {/* Main Menu */}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-bold tracking-wider uppercase text-[#69777D]">
            Menu Utama
          </div>
          <div className="space-y-0.5">
            {/* 1. Dashboard */}
            {navItem('dashboard', isManajemen ? 'Executive Dashboard' : 'Dashboard', LayoutDashboard)}

            {/* 2. Semua Tiket (Global tickets view) */}
            {(isAdmin || isManajemen) && navItem('all-tickets', 'Semua Tiket', Inbox, counts.allTickets)}
            {isPelapor && navItem('all-tickets', 'Semua Tiket', Inbox, counts.allTickets)}
            {isPic && navItem('all-tickets', 'Semua Tiket', Inbox, counts.allTickets)}

            {/* 3. Tiket Unit UPDL */}
            {canAccessUnitType(currentUser, 'UPDL') &&
              navItem(
                'unit-tickets',
                'Tiket Unit UPDL',
                Building2,
                counts.updlTickets !== undefined ? counts.updlTickets : totalUpdlActiveCount
              )}

            {/* 4. Tiket Unit PLN Corpu */}
            {canAccessUnitType(currentUser, 'CORPU') &&
              navItem('corpu-tickets', 'Tiket Unit PLN Corpu', GraduationCap, counts.corpuTickets)}

            {/* 5. Tiket Unit PLN Umum */}
            {canAccessUnitType(currentUser, 'NON_UPDL') &&
              navItem('umum-tickets', 'Tiket Unit PLN Umum', Building, counts.nonUpdlTickets)}

            {/* 6. Buat Tiket Baru */}
            {(isAdmin || isPelapor || isPic) && navItem('create-ticket', 'Buat Tiket Baru', PlusCircle)}

            {/* Pelapor items */}
            {isPelapor && navItem('my-tickets', 'Tiket Saya', Ticket, counts.myTickets)}

            {/* PIC items */}
            {isPic && navItem('my-assignments', 'Penugasan Saya', ClipboardList, counts.assignedTickets)}

            {/* Notifications */}
            {navItem('notifications', 'Notifikasi', Bell, counts.notifications)}
          </div>
        </div>

        {/* Management & Helpdesk Menu (Admin only) */}
        {isAdmin && (
          <div>
            <div className="px-3 pb-1.5 text-[10px] font-bold tracking-wider uppercase text-[#69777D]">
              Pengelolaan & Helpdesk
            </div>
            <div className="space-y-0.5">
              {navItem('registration-requests', 'Permohonan Registrasi', UserCheck, counts.pendingRegistrations)}
              {navItem('pic-management', 'Manajemen PIC', Users)}
              {navItem('auto-assignment', 'Pengaturan Penugasan', Sparkles)}
              {navItem('user-management', 'Manajemen User', UserCog)}
              {navItem('category-management', 'Kategori Tiket', Layers)}
              {navItem('sla-management', 'SLA dan Prioritas', Clock)}
              {navItem('master-units', 'Master Data Unit', Building2)}
            </div>
          </div>
        )}

        {/* Reports & Audit (Admin & Manajemen) */}
        {(isAdmin || isManajemen) && (
          <div>
            <div className="px-3 pb-1.5 text-[10px] font-bold tracking-wider uppercase text-[#69777D]">
              {isManajemen ? 'Pengawasan & Kepatuhan' : 'Laporan & Kepatuhan'}
            </div>
            <div className="space-y-0.5">
              {navItem('reports', 'Laporan & Analitik', BarChart3)}
              {navItem('audit-log', 'Audit Trail', ShieldCheck)}
              {isManajemen && navItem('pic-management', 'Monitoring Beban PIC', Users)}
            </div>
          </div>
        )}

        {/* System Settings */}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-bold tracking-wider uppercase text-[#69777D]">
            Sistem & Akun
          </div>
          <div className="space-y-0.5">
            {navItem('profile', 'Profil Pengguna', User)}
            {isAdmin && navItem('settings', 'Pengaturan Aplikasi', Settings)}
            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                onLogout();
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50/70 transition-colors group cursor-pointer border-l-4 border-transparent"
            >
              <div className="flex items-center gap-2.5">
                <LogOut className="w-4 h-4 text-rose-400 group-hover:text-rose-600" />
                <span>Keluar (Logout)</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* User Info Footer card */}
      <div className="p-3 border-t border-[#D5E0E3] bg-[#E7EFF1] shrink-0">
        <div className="p-2.5 bg-[#FFFFFF] rounded-lg border border-[#D5E0E3] shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-[#20272B] truncate max-w-[140px]" title={currentUser.name}>
              {currentUser.name}
            </span>
            <span
              className={`text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded shrink-0 ${
                isAdmin
                  ? 'text-[#35666D] bg-[#E7EFF1] border border-[#D5E0E3]'
                  : isManajemen
                  ? 'text-purple-900 bg-purple-100 border border-purple-200'
                  : isPic
                  ? 'text-[#35666D] bg-[#E7EFF1] border border-[#D5E0E3]'
                  : 'text-[#20272B] bg-[#E7EFF1] border border-[#D5E0E3]'
              }`}
            >
              {isPic
                ? currentUser.uid === 'user-pic-1'
                  ? 'PIC 1'
                  : currentUser.uid === 'user-pic-2'
                  ? 'PIC 2'
                  : currentUser.uid === 'user-pic-3'
                  ? 'PIC 3'
                  : 'PIC'
                : currentUser.role}
            </span>
          </div>
          <p className="text-[10px] text-[#69777D] truncate mb-1">
            {currentUser.unitName || currentUser.department}
          </p>
          <div className="flex items-center justify-between pt-1 border-t border-[#D5E0E3] text-[10px] text-[#69777D]">
            <span className="font-mono-numbers">{currentUser.employeeId.split('-')[0]}</span>
            <span className="text-[#417F85] font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#417F85]" />
              Aktif
            </span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar (Only visible on lg: screens and up) */}
      <aside className="hidden lg:flex w-64 bg-[#F5FAFA] border-r border-[#D5E0E3] flex-col shrink-0 min-h-[calc(100vh-65px)] select-none">
        {sidebarContent}
      </aside>

      {/* 2. Mobile Responsive Drawer (Overlay modal on mobile screens) */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-visibility duration-300 ${
          isOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
        }`}
        aria-hidden={!isOpen}
      >
        {/* Backdrop overlay */}
        <div
          onClick={onClose}
          className={`fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${
            isOpen ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label="Tutup overlay menu"
        />

        {/* Drawer slide-out panel */}
        <div
          className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#F5FAFA] shadow-2xl flex flex-col z-10 transform transition-transform duration-300 ease-enterprise ${
            isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebarContent}
        </div>
      </div>
    </>
  );
};
