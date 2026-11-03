/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, ClipboardList, AlertCircle } from 'lucide-react';
import { storageService } from './services/storageService';
import { getCurrentApiUser, signOutFromApi } from './services/authApiService';
import { listCategories, listTickets } from './services/ticketApiService';
import { listNotifications } from './services/notificationApiService';
import { listRegistrationRequests } from './services/registrationApiService';
import { User, Ticket, Category } from './types';
import { TopNavbar } from './components/layout/TopNavbar';
import { Sidebar } from './components/layout/Sidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { PageTransition } from './components/common/PageTransition';

// Views
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { TicketListView } from './views/TicketListView';
import { CreateTicketView } from './views/CreateTicketView';
import { TicketDetailView } from './views/TicketDetailView';
import { PicManagementView } from './views/PicManagementView';
import { UserManagementView } from './views/UserManagementView';
import { CategoryManagementView } from './views/CategoryManagementView';
import { SlaManagementView } from './views/SlaManagementView';
import { AutoAssignmentSettingsView } from './views/AutoAssignmentSettingsView';
import { ReportsAnalyticsView } from './views/ReportsAnalyticsView';
import { AuditLogView } from './views/AuditLogView';
import { NotificationView } from './views/NotificationView';
import { ProfileView } from './views/ProfileView';
import { SettingsView } from './views/SettingsView';
import { RegisterView } from './views/RegisterView';
import { RegistrationManagementView } from './views/RegistrationManagementView';
import { UpdlUnitTicketsView } from './views/UpdlUnitTicketsView';
import { CorpuUnitTicketsView } from './views/CorpuUnitTicketsView';
import { NonUpdlUnitTicketsView } from './views/NonUpdlUnitTicketsView';
import { MasterDataUnitView } from './views/MasterDataUnitView';
import {
  canAccessView,
  canAccessUnit,
  canAccessUnitType,
  canViewTicket,
  getScopedTickets,
  getDefaultUnitForUser,
} from './utils/authPermissions';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [createTicketPreselectedUnitId, setCreateTicketPreselectedUnitId] = useState<string | null>(null);
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ticketDataError, setTicketDataError] = useState<string | null>(null);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [pendingRegistrationsCount, setPendingRegistrationsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const refreshAppData = async (user: User | null = userRef.current) => {
    if (!user) { storageService.clear(); setTickets([]); setCategories([]); return; }
    try {
      await storageService.refresh(user);
      if (userRef.current?.uid !== user.uid) return;
      setTickets(storageService.getTickets());
      setCategories(storageService.getCategories());
      setTicketDataError(null);
    } catch (error) {
      setTickets([]); setCategories([]);
      setTicketDataError(error instanceof Error ? error.message : 'Gagal memuat data PostgreSQL.');
    }
  };

  useEffect(() => {
    const refresh = () => void refreshAppData();
    window.addEventListener('ticket-data-changed', refresh);
    return () => {
      window.removeEventListener('ticket-data-changed', refresh);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void getCurrentApiUser()
      .then(async (user) => {
        if (!mounted) return;
        userRef.current=user; setCurrentUser(user);
        if (user) await refreshAppData(user);
      })
      .catch(() => {
        if (mounted) setCurrentUser(null);
      })
      .finally(() => {
        if (mounted) setIsAuthLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setNotificationsCount(0);
      setPendingRegistrationsCount(0);
      return;
    }
    let cancelled = false;
    const refreshCounts = async () => {
      try {
        const notifications = await listNotifications();
        if (!cancelled) setNotificationsCount(notifications.filter((notification) => !notification.isRead).length);
        if (currentUser.role === 'admin') {
          const requests = await listRegistrationRequests();
          if (!cancelled) setPendingRegistrationsCount(requests.filter((request) => request.status === 'Menunggu Verifikasi' || request.status === 'PENDING').length);
        } else if (!cancelled) {
          setPendingRegistrationsCount(0);
        }
      } catch {
        if (!cancelled) {
          setNotificationsCount(0);
          setPendingRegistrationsCount(0);
        }
      }
    };
    const refresh = () => void refreshCounts();
    void refreshCounts();
    window.addEventListener('ticket-data-changed', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('ticket-data-changed', refresh);
    };
  }, [currentUser?.uid, currentUser?.role]);

  // Sync URL hash with app state (Section 6: Routing & Navigasi)
  useEffect(() => {
    const parseHashRoute = () => {
      const rawHash = window.location.hash.replace(/^#\/?/, '');
      if (!rawHash) {
        return;
      }

      const [path, queryString] = rawHash.split('?');
      const parts = path.split('/').filter(Boolean);
      if (parts.length === 0) return;

      const firstPart = parts[0].toLowerCase();
      const secondPart = parts[1] ? decodeURIComponent(parts[1]).trim() : undefined;

      // Route: #/units/:unitId/tickets or #/units/:unitId
      if (firstPart === 'units' && secondPart) {
        if (currentUser && !canAccessUnitType(currentUser, 'UPDL')) {
          setCurrentView('dashboard');
          window.location.hash = '#/dashboard';
          return;
        }
        if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'manajemen') {
          const safeUnit = currentUser.unitId || getDefaultUnitForUser(currentUser);
          setSelectedUnitId(safeUnit);
          setCurrentView('unit-tickets');
          if (secondPart.toUpperCase() === 'ALL' || !canAccessUnit(currentUser, secondPart)) {
            window.location.hash = `#/units/${encodeURIComponent(safeUnit)}/tickets`;
          }
          return;
        }
        setSelectedUnitId(secondPart.toUpperCase() === 'ALL' ? 'ALL' : secondPart);
        setCurrentView('unit-tickets');
        return;
      }

      // Route: #/units or #/tickets/updl or #/updl-tickets or #/updl
      if (
        firstPart === 'units' ||
        (firstPart === 'tickets' && secondPart?.toLowerCase() === 'updl') ||
        firstPart === 'updl-tickets' ||
        firstPart === 'updl'
      ) {
        if (currentUser && !canAccessUnitType(currentUser, 'UPDL')) {
          setCurrentView('dashboard');
          window.location.hash = '#/dashboard';
          return;
        }
        if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'manajemen') {
          const safeUnit = currentUser.unitId || getDefaultUnitForUser(currentUser);
          setSelectedUnitId(safeUnit);
          setCurrentView('unit-tickets');
          window.location.hash = `#/units/${encodeURIComponent(safeUnit)}/tickets`;
          return;
        }
        setSelectedUnitId('ALL');
        setCurrentView('unit-tickets');
        return;
      }

      // Route: #/tickets/corpu or #/corpu-tickets or #/corpu
      if (
        (firstPart === 'tickets' && secondPart?.toLowerCase() === 'corpu') ||
        firstPart === 'corpu-tickets' ||
        firstPart === 'corpu'
      ) {
        if (currentUser && !canAccessUnitType(currentUser, 'CORPU')) {
          setCurrentView('dashboard');
          window.location.hash = '#/dashboard';
          return;
        }
        setSelectedUnitId('unit-pln-corpu');
        setCurrentView('corpu-tickets');
        return;
      }

      // Route: #/tickets/umum or #/umum-tickets or #/umum or #/non-updl
      if (
        (firstPart === 'tickets' && secondPart?.toLowerCase() === 'umum') ||
        firstPart === 'umum-tickets' ||
        firstPart === 'umum' ||
        firstPart === 'non-updl'
      ) {
        if (currentUser && !canAccessUnitType(currentUser, 'NON_UPDL')) {
          setCurrentView('dashboard');
          window.location.hash = '#/dashboard';
          return;
        }
        const safeUnit =
          currentUser && currentUser.role !== 'admin' && currentUser.role !== 'manajemen'
            ? currentUser.unitId || null
            : null;
        setSelectedUnitId(safeUnit);
        setCurrentView('umum-tickets');
        return;
      }

      // Route: #/tickets/ALL or #/tickets/all -> go to all tickets
      if (firstPart === 'tickets' && secondPart?.toUpperCase() === 'ALL') {
        setCurrentView('all-tickets');
        return;
      }

      // Route: #/tickets/:ticketId or #/ticket/:ticketId or #/ticket-detail/:ticketId
      if ((firstPart === 'tickets' || firstPart === 'ticket' || firstPart === 'ticket-detail') && secondPart) {
        setSelectedTicketId(secondPart);
        setCurrentView('ticket-detail');
        return;
      }

      // Route: #/tickets
      if (firstPart === 'tickets') {
        setCurrentView('all-tickets');
        return;
      }

      // Route: #/create-ticket?unit=:unitId
      if (firstPart === 'create-ticket') {
        if (queryString) {
          const params = new URLSearchParams(queryString);
          const uParam = params.get('unit');
          const isGlobal = currentUser && (currentUser.role === 'admin' || currentUser.role === 'manajemen');
          setCreateTicketPreselectedUnitId(isGlobal && uParam && uParam.toUpperCase() !== 'ALL' ? uParam : null);
        } else {
          setCreateTicketPreselectedUnitId(null);
        }
        setCurrentView('create-ticket');
        return;
      }

      if (firstPart === 'registration-requests') {
        if (currentUser && !canAccessView(currentUser, 'registration-requests')) {
          setCurrentView('dashboard');
          window.location.hash = '#/dashboard';
          return;
        }
        if (queryString) {
          const params = new URLSearchParams(queryString);
          setSelectedRegistrationId(params.get('id') || null);
        }
        setCurrentView('registration-requests');
        return;
      }

      // Explicit view routes matching standard app views with permission validation
      if (currentUser && !canAccessView(currentUser, parts[0])) {
        setCurrentView('dashboard');
        window.location.hash = '#/dashboard';
        return;
      }

      setCurrentView(parts[0]);
    };

    parseHashRoute();
    window.addEventListener('hashchange', parseHashRoute);
    window.addEventListener('popstate', parseHashRoute);
    return () => {
      window.removeEventListener('hashchange', parseHashRoute);
      window.removeEventListener('popstate', parseHashRoute);
    };
  }, [currentUser]);

  const handleNavigate = (view: string, id?: string) => {
    setIsMobileSidebarOpen(false);
    const cleanView = (view || '').trim();
    const cleanId = typeof id === 'string' ? id.trim() : undefined;

    if (currentUser && !canAccessView(currentUser, cleanView)) {
      setCurrentView('dashboard');
      window.location.hash = '#/dashboard';
      return;
    }

    if (cleanView === 'registration-requests') {
      setSelectedRegistrationId(cleanId || null);
      setCurrentView('registration-requests');
      window.location.hash = '#/registration-requests';
    } else if (cleanView === 'unit-tickets' || cleanView === 'updl-tickets') {
      if (currentUser && !canAccessUnitType(currentUser, 'UPDL')) {
        setCurrentView('dashboard');
        window.location.hash = '#/dashboard';
        return;
      }
      const isGlobal = currentUser && (currentUser.role === 'admin' || currentUser.role === 'manajemen');
      const targetUnit = isGlobal ? (cleanId || 'ALL') : (currentUser ? (currentUser.unitId || getDefaultUnitForUser(currentUser)) : 'ALL');
      setSelectedUnitId(targetUnit);
      setCurrentView('unit-tickets');
      if (targetUnit === 'ALL') {
        window.location.hash = '#/tickets/updl';
      } else {
        window.location.hash = `#/units/${encodeURIComponent(targetUnit)}/tickets`;
      }
    } else if (cleanView === 'units-overview') {
      if (currentUser && !canAccessUnitType(currentUser, 'UPDL')) {
        setCurrentView('dashboard');
        window.location.hash = '#/dashboard';
        return;
      }
      const isGlobal = currentUser && (currentUser.role === 'admin' || currentUser.role === 'manajemen');
      const targetUnit = isGlobal ? 'ALL' : (currentUser ? (currentUser.unitId || getDefaultUnitForUser(currentUser)) : 'ALL');
      setSelectedUnitId(targetUnit);
      setCurrentView('unit-tickets');
      window.location.hash = targetUnit === 'ALL' ? '#/tickets/updl' : `#/units/${encodeURIComponent(targetUnit)}/tickets`;
    } else if (cleanView === 'corpu-tickets') {
      if (currentUser && !canAccessUnitType(currentUser, 'CORPU')) {
        setCurrentView('dashboard');
        window.location.hash = '#/dashboard';
        return;
      }
      setSelectedUnitId('unit-pln-corpu');
      setCurrentView('corpu-tickets');
      window.location.hash = '#/tickets/corpu';
    } else if (cleanView === 'umum-tickets') {
      if (currentUser && !canAccessUnitType(currentUser, 'NON_UPDL')) {
        setCurrentView('dashboard');
        window.location.hash = '#/dashboard';
        return;
      }
      const isGlobal = currentUser && (currentUser.role === 'admin' || currentUser.role === 'manajemen');
      const targetUnit = isGlobal ? null : (currentUser?.unitId || null);
      setSelectedUnitId(targetUnit);
      setCurrentView('umum-tickets');
      window.location.hash = '#/tickets/umum';
    } else if (cleanView === 'create-ticket') {
      const isGlobal = currentUser && (currentUser.role === 'admin' || currentUser.role === 'manajemen');
      const safeUnitParam = isGlobal && cleanId && cleanId.toUpperCase() !== 'ALL' ? cleanId : null;
      setCreateTicketPreselectedUnitId(safeUnitParam);
      setCurrentView('create-ticket');
      window.location.hash = safeUnitParam ? `#/create-ticket?unit=${encodeURIComponent(safeUnitParam)}` : '#/create-ticket';
    } else if (cleanView === 'ticket-detail' || cleanView === 'ticket') {
      if (cleanId && cleanId.toUpperCase() !== 'ALL') {
        setSelectedTicketId(cleanId);
        setCurrentView('ticket-detail');
        window.location.hash = `#/tickets/${encodeURIComponent(cleanId)}`;
      } else {
        setCurrentView('all-tickets');
        window.location.hash = '#/tickets';
      }
    } else {
      setCurrentView(cleanView);
      if (cleanView === 'all-tickets') {
        window.location.hash = '#/tickets';
      } else {
        window.location.hash = `#/${cleanView}`;
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGlobalSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleLoginSuccess = async (user: User) => {
    setIsAuthLoading(true); userRef.current=user; setCurrentUser(user);
    await refreshAppData(user); setIsAuthLoading(false);
    setCurrentView('dashboard');
    window.location.hash = '#/dashboard';
  };

  const handleLogout = async () => {
    try { await signOutFromApi(); }
    catch { window.alert('Server belum mengonfirmasi logout. Coba lagi setelah koneksi pulih; sesi cookie mungkin masih aktif.'); return; }
    userRef.current=null; storageService.clear(); setTickets([]); setCategories([]);
    setCurrentUser(null); setAuthMode('login'); setCurrentView('dashboard');
    setSelectedTicketId(null); setSelectedUnitId(null); window.location.hash='#/login';
  };

  if (isAuthLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#E7EFF1] text-sm font-semibold text-[#35666D]">Memeriksa sesi autentikasi...</div>;
  }

  // If NOT authenticated, present Login or Register based on authMode
  if (!currentUser) {
    if (authMode === 'register') {
      return <RegisterView onNavigateToLogin={() => setAuthMode('login')} />;
    }
    return (
      <LoginView
        onLoginSuccess={handleLoginSuccess}
        onNavigateToRegister={() => setAuthMode('register')}
      />
    );
  }

  // Role permissions check
  const isAdmin = currentUser.role === 'admin';
  const isManajemen = currentUser.role === 'manajemen';
  const isPic = currentUser.role === 'pic';
  const isPelapor = currentUser.role === 'pelapor';

  // Badge counters scoped strictly to user's permissions and unit
  const myTicketsCount = tickets.filter((t) => t.reporterId === currentUser.uid).length;
  const assignedTicketsCount = getScopedTickets(currentUser, tickets).filter(
    (t) => t.currentPicId === currentUser.uid
  ).length;
  return (
    <div className="min-h-screen bg-[#E7EFF1] flex flex-col text-[#20272B]">
      {/* Top Header */}
      <TopNavbar
        currentUser={currentUser}
        onNavigate={handleNavigate}
        onSearch={handleGlobalSearch}
        onLogout={handleLogout}
        onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        isSidebarOpen={isMobileSidebarOpen}
      />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar Navigation with dynamic unit menu filtering */}
        <Sidebar
          currentView={currentView}
          selectedUnitId={selectedUnitId}
          onNavigate={handleNavigate}
          currentUser={currentUser}
          counts={{
            allTickets: isAdmin || isManajemen ? tickets.length : isPic ? assignedTicketsCount : myTicketsCount,
            myTickets: myTicketsCount,
            assignedTickets: assignedTicketsCount,
            notifications: notificationsCount,
            pendingRegistrations: pendingRegistrationsCount,
            updlTickets: 0,
            corpuTickets: 0,
            nonUpdlTickets: 0,
          }}
          onLogout={handleLogout}
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Viewport with Route Protection & Smooth Page Transitions */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8 pb-24 lg:pb-8 w-full min-w-0">
          {ticketDataError && (
            <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
              <span>Gagal memuat data dari database: {ticketDataError}</span>
              <button type="button" onClick={() => void refreshAppData()} className="shrink-0 font-bold underline">
                Coba lagi
              </button>
            </div>
          )}
          <PageTransition pageKey={`${currentView}-${selectedTicketId || selectedUnitId || ''}`}>
            {currentView === 'dashboard' && (
              <DashboardView
                tickets={tickets}
                currentUser={currentUser}
                onNavigate={handleNavigate}
              />
            )}

            {/* All Tickets - Global Tickets View for all authorized roles */}
            {currentView === 'all-tickets' && (
              <TicketListView
                mode="all"
                tickets={tickets}
                currentUser={currentUser}
                onNavigate={handleNavigate}
                initialSearch={searchQuery}
              />
            )}

            {/* Dedicated Page for Tiket Unit UPDL (Single Page with Unit Dropdown Filter) */}
            {(currentView === 'unit-tickets' || currentView === 'updl-tickets' || currentView === 'units-overview') && (
              canAccessUnitType(currentUser, 'UPDL') ? (
                <UpdlUnitTicketsView
                  unitId={selectedUnitId || (isAdmin || isManajemen ? 'ALL' : (currentUser.unitId || 'unit-updl-pdg'))}
                  currentUser={currentUser}
                  onNavigate={handleNavigate}
                  initialSearch={searchQuery}
                />
              ) : (
                <DashboardView
                  tickets={tickets}
                  currentUser={currentUser}
                  onNavigate={handleNavigate}
                />
              )
            )}

            {/* Dedicated Page for Tiket Unit PLN Corpu (Menu Tersendiri) */}
            {currentView === 'corpu-tickets' && (
              canAccessUnitType(currentUser, 'CORPU') ? (
                <CorpuUnitTicketsView
                  currentUser={currentUser}
                  onNavigate={handleNavigate}
                  initialSearch={searchQuery}
                />
              ) : (
                <DashboardView
                  tickets={tickets}
                  currentUser={currentUser}
                  onNavigate={handleNavigate}
                />
              )
            )}

            {/* Dedicated Page for Tiket Unit PLN Umum (Menu Tersendiri) */}
            {currentView === 'umum-tickets' && (
              canAccessUnitType(currentUser, 'NON_UPDL') ? (
                <NonUpdlUnitTicketsView
                  currentUser={currentUser}
                  onNavigate={handleNavigate}
                  initialSearch={searchQuery}
                />
              ) : (
                <DashboardView
                  tickets={tickets}
                  currentUser={currentUser}
                  onNavigate={handleNavigate}
                />
              )
            )}

            {/* My Tickets - Pelapor or Admin */}
            {currentView === 'my-tickets' && (
              <TicketListView
                mode="my-tickets"
                tickets={tickets}
                currentUser={currentUser}
                onNavigate={handleNavigate}
                initialSearch={searchQuery}
              />
            )}

            {/* My Assignments - PIC or Admin */}
            {currentView === 'my-assignments' && (isPic || isAdmin) && (
              <TicketListView
                mode="my-assignments"
                tickets={tickets}
                currentUser={currentUser}
                onNavigate={handleNavigate}
                initialSearch={searchQuery}
              />
            )}

            {/* My Assignments Notice for non-PIC users */}
            {currentView === 'my-assignments' && !isPic && !isAdmin && (
              <div className="bg-white p-8 sm:p-12 text-center rounded-2xl border border-slate-200 shadow-sm max-w-lg mx-auto my-8 space-y-4">
                <div className="w-14 h-14 rounded-full bg-[#E7EFF1] text-[#35666D] flex items-center justify-center mx-auto border border-[#D5E0E3]">
                  <ClipboardList className="w-8 h-8 text-[#417F85]" />
                </div>
                <h2 className="text-base font-bold text-[#20272B]">Menu Khusus Penugasan Petugas PIC</h2>
                <p className="text-xs text-[#69777D] leading-relaxed">
                  Halaman ini menampilkan antrean tiket yang ditugaskan kepada Petugas PIC Helpdesk. Sebagai {currentUser.role === 'pelapor' ? 'Pelapor' : 'Manajemen'}, Anda dapat melihat daftar tiket pada menu "Tiket Saya" atau "Semua Tiket".
                </p>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                  <button
                    onClick={() => handleNavigate('my-tickets')}
                    className="px-4 py-2 bg-[#417F85] text-white rounded-lg text-xs font-bold hover:bg-[#326A70] transition-colors cursor-pointer"
                  >
                    Buka Tiket Saya
                  </button>
                  <button
                    onClick={() => handleNavigate('dashboard')}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Kembali ke Dashboard
                  </button>
                </div>
              </div>
            )}

            {/* Create Ticket - Accessible for all authenticated roles (Supports preselectedUnitId) */}
            {currentView === 'create-ticket' && (
              <CreateTicketView
                currentUser={currentUser}
                categories={categories}
                onNavigate={handleNavigate}
                preselectedUnitId={createTicketPreselectedUnitId}
              />
            )}

            {/* Ticket Detail - Protected by internal access checker and parameter validator */}
            {currentView === 'ticket-detail' && (
              <TicketDetailView
                ticketId={selectedTicketId || ''}
                currentUser={currentUser}
                onNavigate={handleNavigate}
                onBack={() => {
                  if (selectedUnitId && selectedUnitId !== 'ALL') {
                    handleNavigate('unit-tickets', selectedUnitId);
                  } else if (isPelapor) {
                    handleNavigate('my-tickets');
                  } else if (isPic) {
                    handleNavigate('my-assignments');
                  } else {
                    handleNavigate('all-tickets');
                  }
                }}
              />
            )}

            {/* Admin & Manajemen Management Views */}
            {currentView === 'pic-management' && (isAdmin || isManajemen) && (
              <PicManagementView
                tickets={tickets}
                currentUser={currentUser}
                onNavigate={handleNavigate}
              />
            )}

            {/* Registration Requests - Admin only */}
            {currentView === 'registration-requests' && isAdmin && (
              <RegistrationManagementView
                currentUser={currentUser}
                onNavigate={handleNavigate}
                initialSelectedId={selectedRegistrationId}
              />
            )}

            {currentView === 'user-management' && isAdmin && (
              <UserManagementView currentUser={currentUser} onNavigate={handleNavigate} />
            )}

            {currentView === 'category-management' && isAdmin && <CategoryManagementView />}

            {currentView === 'sla-management' && isAdmin && <SlaManagementView />}

            {currentView === 'auto-assignment' && isAdmin && (
              <AutoAssignmentSettingsView currentUser={currentUser} />
            )}

            {/* Reports - Admin, Manajemen, or PIC */}
            {currentView === 'reports' && (isAdmin || isPic || isManajemen) && (
              <ReportsAnalyticsView tickets={tickets} categories={categories} />
            )}

            {/* Audit Log - Admin & Manajemen */}
            {currentView === 'audit-log' && (isAdmin || isManajemen) && (
              <AuditLogView onNavigate={handleNavigate} />
            )}

            {/* Notifications - All Authenticated Users */}
            {currentView === 'notifications' && (
              <NotificationView currentUser={currentUser} onNavigate={handleNavigate} />
            )}

            {/* Profile - All Authenticated Users */}
            {currentView === 'profile' && (
              <ProfileView
                currentUser={currentUser}
                tickets={tickets}
                onNavigate={handleNavigate}
              />
            )}

            {currentView === 'master-units' && isAdmin && (
              <MasterDataUnitView currentUser={currentUser} onNavigate={handleNavigate} />
            )}

            {/* Settings - Admin only */}
            {currentView === 'settings' && isAdmin && <SettingsView />}

            {/* Access Denied Guard for Administrator Modules */}
            {((currentView === 'registration-requests' ||
              currentView === 'user-management' ||
              currentView === 'category-management' ||
              currentView === 'sla-management' ||
              currentView === 'auto-assignment' ||
              currentView === 'master-units' ||
              currentView === 'settings') &&
              !isAdmin) && (
              <div className="bg-white p-8 sm:p-12 text-center rounded-2xl border border-rose-200 shadow-sm max-w-lg mx-auto my-8 space-y-4">
                <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Akses Ditolak (403 Forbidden)</h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Modul ini memerlukan hak akses peran Administrator Ticketing PLN Corporate University. Peran akun Anda saat ini: <span className="font-bold uppercase text-[#35666D]">{currentUser.role}</span>.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                  <button
                    onClick={() => handleNavigate('dashboard')}
                    className="w-full sm:w-auto px-4 py-2 bg-[#417F85] text-white rounded-lg text-xs font-bold hover:bg-[#326A70] transition-colors cursor-pointer"
                  >
                    Kembali ke Dashboard
                  </button>
                  <button
                    onClick={() => handleNavigate(isPelapor ? 'my-tickets' : isPic ? 'my-assignments' : 'all-tickets')}
                    className="w-full sm:w-auto px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    {isPelapor ? 'Buka Tiket Saya' : isPic ? 'Buka Penugasan Saya' : 'Buka Semua Tiket'}
                  </button>
                </div>
              </div>
            )}

            {/* Access Denied Guard for PIC Management & Audit Trail */}
            {((currentView === 'pic-management' || currentView === 'audit-log') &&
              !isAdmin &&
              !isManajemen) && (
              <div className="bg-white p-8 sm:p-12 text-center rounded-2xl border border-rose-200 shadow-sm max-w-lg mx-auto my-8 space-y-4">
                <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Akses Ditolak (403 Forbidden)</h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Modul ini khusus bagi Tim Administrator dan Manajemen Eksekutif PLN CorpU untuk keperluan supervisi dan kepatuhan.
                </p>
                <div className="pt-2 flex items-center justify-center gap-2.5">
                  <button
                    onClick={() => handleNavigate('dashboard')}
                    className="px-4 py-2 bg-[#417F85] text-white rounded-lg text-xs font-bold hover:bg-[#326A70] transition-colors cursor-pointer"
                  >
                    Kembali ke Dashboard
                  </button>
                </div>
              </div>
            )}

            {/* Access Denied Guard for Reports & Analytics */}
            {(currentView === 'reports' && !isAdmin && !isPic && !isManajemen) && (
              <div className="bg-white p-8 sm:p-12 text-center rounded-2xl border border-rose-200 shadow-sm max-w-lg mx-auto my-8 space-y-4">
                <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Akses Ditolak (403 Forbidden)</h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Laporan dan analitik performa helpdesk hanya dapat diakses oleh Administrator, Petugas PIC, dan Manajemen Eksekutif.
                </p>
                <div className="pt-2 flex items-center justify-center gap-2.5">
                  <button
                    onClick={() => handleNavigate('dashboard')}
                    className="px-4 py-2 bg-[#417F85] text-white rounded-lg text-xs font-bold hover:bg-[#326A70] transition-colors cursor-pointer"
                  >
                    Kembali ke Dashboard
                  </button>
                </div>
              </div>
            )}

            {/* Fallback 404 Route Not Found for unmapped URLs */}
            {![
              'dashboard',
              'all-tickets',
              'unit-tickets',
              'updl-tickets',
              'units-overview',
              'corpu-tickets',
              'umum-tickets',
              'my-tickets',
              'my-assignments',
              'create-ticket',
              'ticket-detail',
              'pic-management',
              'registration-requests',
              'user-management',
              'category-management',
              'sla-management',
              'auto-assignment',
              'reports',
              'audit-log',
              'notifications',
              'profile',
              'settings',
            ].includes(currentView) && (
              <div className="bg-white p-8 sm:p-12 text-center rounded-2xl border border-slate-200 shadow-sm max-w-lg mx-auto my-8 space-y-4">
                <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto border border-slate-200">
                  <AlertCircle className="w-8 h-8 text-slate-600" />
                </div>
                <h2 className="text-base font-bold text-slate-800">Halaman Tidak Ditemukan (404)</h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Rute menu atau tautan halaman <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-slate-800">#/{currentView}</code> tidak terdaftar dalam sistem PLN Corporate University Ticketing.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => handleNavigate('dashboard')}
                    className="px-4 py-2 bg-[#417F85] text-white rounded-lg text-xs font-bold hover:bg-[#326A70] transition-colors cursor-pointer"
                  >
                    Kembali ke Dashboard
                  </button>
                </div>
              </div>
            )}
          </PageTransition>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        currentView={currentView}
        onNavigate={handleNavigate}
        onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        currentUser={currentUser}
        counts={{
          allTickets: isAdmin || isManajemen ? tickets.length : isPic ? assignedTicketsCount : myTicketsCount,
          myTickets: myTicketsCount,
          assignedTickets: assignedTicketsCount,
          notifications: notificationsCount,
        }}
      />
    </div>
  );
}
