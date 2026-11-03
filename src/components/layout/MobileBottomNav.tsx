import React from 'react';
import {
  LayoutDashboard,
  Inbox,
  PlusCircle,
  Bell,
  Menu,
} from 'lucide-react';
import { User as UserType } from '../../types';

interface MobileBottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onToggleSidebar: () => void;
  currentUser: UserType;
  counts: {
    allTickets: number;
    myTickets: number;
    assignedTickets: number;
    notifications: number;
  };
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  onNavigate,
  onToggleSidebar,
  currentUser,
  counts,
}) => {
  const isPelapor = currentUser.role === 'pelapor';
  const isPic = currentUser.role === 'pic';
  const ticketsViewTarget = isPelapor ? 'my-tickets' : isPic ? 'my-assignments' : 'all-tickets';
  const isTicketsActive =
    currentView === 'all-tickets' ||
    currentView === 'my-tickets' ||
    currentView === 'my-assignments' ||
    currentView === 'unit-tickets' ||
    currentView === 'corpu-tickets' ||
    currentView === 'umum-tickets';

  const ticketBadgeCount = isPelapor
    ? counts.myTickets
    : isPic
    ? counts.assignedTickets
    : counts.allTickets;

  return (
    <nav
      aria-label="Navigasi Bawah Mobile"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#FFFFFF]/95 backdrop-blur-md border-t border-[#D5E0E3] shadow-lg px-2 py-1.5 flex items-center justify-around safe-bottom"
    >
      {/* 1. Dashboard */}
      <button
        type="button"
        onClick={() => onNavigate('dashboard')}
        className={`flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-colors cursor-pointer relative ${
          currentView === 'dashboard'
            ? 'text-[#35666D] font-bold'
            : 'text-[#69777D] hover:text-[#20272B]'
        }`}
      >
        <LayoutDashboard className={`w-5 h-5 ${currentView === 'dashboard' ? 'text-[#417F85]' : ''}`} />
        <span className="text-[10px] mt-0.5 leading-tight">Dashboard</span>
      </button>

      {/* 2. Tiket */}
      <button
        type="button"
        onClick={() => onNavigate(ticketsViewTarget)}
        className={`flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-colors cursor-pointer relative ${
          isTicketsActive ? 'text-[#35666D] font-bold' : 'text-[#69777D] hover:text-[#20272B]'
        }`}
      >
        <div className="relative">
          <Inbox className={`w-5 h-5 ${isTicketsActive ? 'text-[#417F85]' : ''}`} />
          {ticketBadgeCount > 0 && (
            <span className="absolute -top-1 -right-2 min-w-4 h-4 bg-[#417F85] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 font-mono-numbers">
              {ticketBadgeCount > 99 ? '99+' : ticketBadgeCount}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-0.5 leading-tight">Tiket</span>
      </button>

      {/* 3. Buat Tiket (Central Primary Action) */}
      <button
        type="button"
        onClick={() => onNavigate('create-ticket')}
        className="flex flex-col items-center justify-center -mt-4 group cursor-pointer"
        aria-label="Buat Tiket Baru"
      >
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md transition-transform duration-200 group-active:scale-95 ${
            currentView === 'create-ticket'
              ? 'bg-[#35666D] ring-4 ring-[#417F85]/20'
              : 'bg-[#417F85] hover:bg-[#326A70]'
          }`}
        >
          <PlusCircle className="w-6 h-6 stroke-[2.2]" />
        </div>
        <span
          className={`text-[10px] mt-1 font-semibold leading-tight ${
            currentView === 'create-ticket' ? 'text-[#35666D] font-bold' : 'text-[#69777D]'
          }`}
        >
          Buat Tiket
        </span>
      </button>

      {/* 4. Notifikasi */}
      <button
        type="button"
        onClick={() => onNavigate('notifications')}
        className={`flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-colors cursor-pointer relative ${
          currentView === 'notifications'
            ? 'text-[#35666D] font-bold'
            : 'text-[#69777D] hover:text-[#20272B]'
        }`}
      >
        <div className="relative">
          <Bell className={`w-5 h-5 ${currentView === 'notifications' ? 'text-[#417F85]' : ''}`} />
          {counts.notifications > 0 && (
            <span className="absolute -top-1 -right-2 min-w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 font-mono-numbers">
              {counts.notifications > 99 ? '99+' : counts.notifications}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-0.5 leading-tight">Notifikasi</span>
      </button>

      {/* 5. Menu Drawer Trigger */}
      <button
        type="button"
        onClick={onToggleSidebar}
        className="flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-colors cursor-pointer text-[#69777D] hover:text-[#20272B]"
        aria-label="Buka Semua Menu"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 leading-tight">Semua Menu</span>
      </button>
    </nav>
  );
};
