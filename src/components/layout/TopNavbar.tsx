import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Search,
  User,
  ChevronDown,
  LogOut,
  Layers,
  Clock,
  Sparkles,
  Settings as SettingsIcon,
  Menu,
  X,
} from 'lucide-react';
import { User as UserType, AppNotification } from '../../types';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/notificationApiService';

interface TopNavbarProps {
  currentUser: UserType;
  onNavigate: (view: string, ticketId?: string) => void;
  onSearch: (query: string) => void;
  onLogout: () => void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  currentUser,
  onNavigate,
  onSearch,
  onLogout,
  onToggleSidebar,
  isSidebarOpen = false,
}) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const refreshData = async () => {
    try {
      setNotifications(await listNotifications());
    } catch {
      setNotifications([]);
    }
  };

  useEffect(() => {
    const refresh = () => void refreshData();
    void refreshData();
    window.addEventListener('ticket-data-changed', refresh);
    return () => window.removeEventListener('ticket-data-changed', refresh);
  }, [currentUser.uid]);

  // Click outside and Escape key to close dropdowns smoothly
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifDropdown(false);
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifDropdown(false);
        setShowUserDropdown(false);
        setShowMobileSearch(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
      onNavigate(currentUser.role === 'pelapor' ? 'my-tickets' : 'all-tickets');
      setShowMobileSearch(false);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    void refreshData();
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    await markNotificationRead(notif.id);
    setShowNotifDropdown(false);
    if (notif.type === 'registration') {
      const regId = notif.registrationDetails?.requestId || notif.ticketId;
      onNavigate('registration-requests', regId);
    } else if (notif.ticketId) {
      onNavigate('ticket-detail', notif.ticketId);
    }
    void refreshData();
  };

  const rolePill = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="bg-[#E7EFF1] text-[#35666D] border border-[#D5E0E3] text-[10px] font-bold px-2 py-0.5 rounded-full">
            ADMIN
          </span>
        );
      case 'manajemen':
        return (
          <span className="bg-purple-100 text-purple-900 border border-purple-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
            MANAJEMEN CORPU
          </span>
        );
      case 'pic': {
        const picLabel =
          currentUser.uid === 'user-pic-1'
            ? 'PIC 1 · NETWORK'
            : currentUser.uid === 'user-pic-2'
            ? 'PIC 2 · HARDWARE'
            : currentUser.uid === 'user-pic-3'
            ? 'PIC 3 · APLIKASI'
            : 'PETUGAS PIC';
        return (
          <span className="bg-[#E7EFF1] text-[#35666D] border border-[#D5E0E3] text-[10px] font-bold px-2 py-0.5 rounded-full">
            {picLabel}
          </span>
        );
      }
      case 'pelapor':
      default:
        return (
          <span className="bg-white/20 text-white border border-white/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
            PELAPOR
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#35666D] border-b border-[#2C555B] shadow-sm text-white">
      {/* Main Top Header - Dark Teal #35666D */}
      <div className="px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Hamburger & Brand Identity */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile Sidebar Hamburger Toggle */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="lg:hidden p-2 -ml-1 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer shrink-0"
            aria-label={isSidebarOpen ? 'Tutup navigasi' : 'Buka navigasi'}
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 sm:gap-2.5 text-left group cursor-pointer focus:outline-hidden min-w-0"
          >
            {/* Stylized PLN Bolt Logo Badge with Teal #417F85 */}
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#417F85] flex items-center justify-center text-amber-300 shadow-xs border border-white/20 group-hover:bg-[#326A70] transition-all shrink-0">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 fill-current" viewBox="0 0 24 24">
                <path d="M13 2L3 14h8l-2 8 10-12h-8l2-8z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs sm:text-base tracking-tight text-white leading-none truncate block">
                  PLN CORP UNIVERSITY
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] font-semibold text-[#E7EFF1] tracking-wider uppercase truncate block">
                Ticketing System
              </span>
            </div>
          </button>
        </div>

        {/* Center: Search Bar (Desktop) */}
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari no. tiket (#JAIT-...), kendala, atau departemen..."
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-[#FFFFFF] border border-[#D5E0E3] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D] transition-all shadow-2xs"
            />
            <Search className="w-4 h-4 text-[#69777D] absolute left-2.5 top-2.5 pointer-events-none" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  onSearch('');
                }}
                className="absolute right-2.5 top-2 text-[#69777D] hover:text-[#20272B] text-xs font-bold"
              >
                ×
              </button>
            )}
          </form>
        </div>

        {/* Right: Mobile Search Toggle, Notifications & User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Mobile Search Toggle Button */}
          <button
            type="button"
            onClick={() => setShowMobileSearch(!showMobileSearch)}
            className="md:hidden p-2 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors focus:outline-hidden cursor-pointer"
            aria-label="Cari tiket"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Notification Bell Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="relative p-2 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors focus:outline-hidden cursor-pointer"
              aria-label="Notifikasi"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[#417F85] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#35666D] font-mono-numbers shadow-2xs">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifDropdown && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-24px)] sm:w-96 max-w-sm bg-[#F5FAFA] rounded-xl shadow-xl border border-[#D5E0E3] z-50 overflow-hidden animate-dropdown text-[#20272B]">
                <div className="p-3 bg-[#E7EFF1] border-b border-[#D5E0E3] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-[#20272B]">Notifikasi</span>
                    {unreadCount > 0 && (
                      <span className="bg-[#417F85] text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-mono-numbers">
                        {unreadCount} baru
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-[#417F85] hover:text-[#326A70] font-semibold cursor-pointer"
                    >
                      Tandai sudah dibaca
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-[#D5E0E3]">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-[#69777D] text-xs">
                      Tidak ada notifikasi saat ini
                    </div>
                  ) : (
                    notifications.slice(0, 6).map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3 text-xs hover:bg-[#E7EFF1]/80 cursor-pointer transition-colors ${
                          !notif.isRead ? 'bg-[#E7EFF1]' : 'bg-[#F5FAFA]'
                        }`}
                      >
                        {notif.type === 'registration' && notif.registrationDetails ? (
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-1.5">
                              <span className="font-bold text-[#35666D] flex items-center gap-1.5 text-xs">
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                {notif.title}
                              </span>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                                {notif.registrationDetails.status}
                              </span>
                            </div>
                            <div className="p-2 bg-white rounded-lg border border-[#D5E0E3] text-[10px] space-y-0.5 text-[#20272B]">
                              <div><span className="text-[#69777D]">Nama:</span> <span className="font-semibold">{notif.registrationDetails.fullName}</span></div>
                              <div><span className="text-[#69777D]">NIP:</span> <span className="font-mono text-[#35666D]">{notif.registrationDetails.employeeId}</span></div>
                              <div><span className="text-[#69777D]">Email:</span> <span className="text-[#35666D]">{notif.registrationDetails.corporateEmail}</span></div>
                              <div><span className="text-[#69777D]">Unit kerja:</span> <span>{notif.registrationDetails.unitName}</span></div>
                              <div><span className="text-[#69777D]">Waktu pendaftaran:</span> <span>{new Date(notif.registrationDetails.submittedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
                            </div>
                            <p className="text-[#417F85] text-[10px] font-medium italic">
                              "{notif.message}"
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <span className={`font-semibold ${!notif.isRead ? 'text-[#35666D]' : 'text-[#20272B]'}`}>
                                {notif.title}
                              </span>
                              {!notif.isRead && (
                                <span className="w-2 h-2 rounded-full bg-[#417F85] shrink-0 mt-1" />
                              )}
                            </div>
                            <p className="text-[#69777D] text-[11px] line-clamp-2 mb-1">
                              {notif.message}
                            </p>
                          </>
                        )}
                        <span className="text-[10px] text-[#69777D] flex items-center gap-1 font-mono-numbers mt-1.5">
                          <Clock className="w-3 h-3 text-[#69777D]" />
                          {new Date(notif.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2.5 bg-[#E7EFF1] border-t border-[#D5E0E3] text-center">
                  <button
                    onClick={() => {
                      setShowNotifDropdown(false);
                      onNavigate('notifications');
                    }}
                    className="text-xs text-[#417F85] hover:text-[#326A70] font-bold cursor-pointer w-full"
                  >
                    Buka Semua Notifikasi ({notifications.length})
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Area */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-white/10 transition-colors focus:outline-hidden cursor-pointer"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#417F85] text-white font-bold text-xs flex items-center justify-center shadow-2xs border border-white/20">
                {currentUser.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <div className="hidden sm:block text-left">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate max-w-[130px]">
                    {currentUser.name}
                  </span>
                  {rolePill(currentUser.role)}
                </div>
                <span className="text-[11px] text-[#E7EFF1]/85 truncate max-w-[150px] block">
                  {currentUser.department}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#E7EFF1]" />
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-24px)] bg-[#F5FAFA] rounded-xl shadow-xl border border-[#D5E0E3] z-50 overflow-hidden py-1 animate-dropdown text-[#20272B]">
                <div className="p-3 bg-[#E7EFF1] border-b border-[#D5E0E3]">
                  <p className="text-xs font-bold text-[#20272B]">{currentUser.name}</p>
                  <p className="text-[11px] text-[#69777D] font-mono-numbers">{currentUser.employeeId}</p>
                  <p className="text-[11px] text-[#417F85] font-medium mt-0.5">{currentUser.email}</p>
                </div>
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    onNavigate('profile');
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-[#20272B] hover:bg-[#E7EFF1] flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <User className="w-4 h-4 text-[#417F85]" />
                  Profil Saya
                </button>
                {currentUser.role === 'admin' && (
                  <button
                    onClick={() => {
                      setShowUserDropdown(false);
                      onNavigate('settings');
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-[#20272B] hover:bg-[#E7EFF1] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <SettingsIcon className="w-4 h-4 text-[#417F85]" />
                    Pengaturan Akun
                  </button>
                )}
                <div className="border-t border-[#D5E0E3] my-1" />
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    onLogout();
                  }}
                  className="w-full px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold cursor-pointer transition-colors"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expandable Mobile Search Bar */}
      {showMobileSearch && (
        <div className="md:hidden px-3 py-2 bg-[#2C555B] border-t border-[#35666D]">
          <form onSubmit={handleSearchSubmit} className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari no. tiket, kendala..."
              autoFocus
              className="w-full pl-9 pr-8 py-2 text-xs bg-[#FFFFFF] border border-[#D5E0E3] rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#417F85] text-[#20272B] placeholder:text-[#69777D] shadow-2xs"
            />
            <Search className="w-4 h-4 text-[#69777D] absolute left-2.5 top-3 pointer-events-none" />
            <button
              type="button"
              onClick={() => setShowMobileSearch(false)}
              className="absolute right-2.5 top-2.5 text-[#69777D] hover:text-[#20272B] text-xs font-bold p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </header>
  );
};
