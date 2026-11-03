import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  Ticket as TicketIcon,
  ChevronRight,
  Shield,
  MessageSquare,
  AlertTriangle,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { AppNotification, User as UserType } from '../types';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../services/notificationApiService';
import { formatTicketNumberDisplay } from '../utils/ticketHelpers';

interface NotificationViewProps {
  currentUser: UserType;
  onNavigate: (view: string, ticketId?: string) => void;
}

export const NotificationView: React.FC<NotificationViewProps> = ({
  currentUser,
  onNavigate,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshData = async () => {
    try {
      setNotifications(await listNotifications());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Gagal memuat notifikasi dari database.');
    }
  };

  React.useEffect(() => {
    const refresh = () => void refreshData();
    void refreshData();
    window.addEventListener('ticket-data-changed', refresh);
    return () => window.removeEventListener('ticket-data-changed', refresh);
  }, [currentUser.uid]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      await refreshData();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Gagal memperbarui notifikasi.');
    }
  };

  const handleClick = async (notif: AppNotification) => {
    try {
      await markNotificationRead(notif.id);
      void refreshData();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Gagal memperbarui notifikasi.');
    }
    if (notif.type === 'registration') {
      const regId = notif.registrationDetails?.requestId || notif.ticketId;
      onNavigate('registration-requests', regId);
    } else if (notif.ticketId) {
      onNavigate('ticket-detail', notif.ticketId);
    }
  };

  const filteredNotifs = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {loadError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">{loadError}</div>}
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Pusat Notifikasi
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Informasi terkini mengenai tiket Anda, penugasan baru, dan permohonan registrasi pengguna.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              Semua ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                filter === 'unread' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'
              }`}
            >
              Belum Dibaca ({unreadCount})
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
            >
              Tandai Semua Dibaca
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden divide-y divide-slate-100">
        {filteredNotifs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Bell className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700">Tidak ada notifikasi saat ini</p>
            <p className="text-slate-400 mt-0.5">Semua pesan dan notifikasi telah Anda baca.</p>
          </div>
        ) : (
          filteredNotifs.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleClick(notif)}
              className={`p-4 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                !notif.isRead ? 'bg-emerald-50/40' : ''
              }`}
            >
              <div className="flex items-start gap-3.5 flex-1">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    notif.type === 'registration'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : notif.type === 'assignment'
                      ? 'bg-sky-100 text-sky-700'
                      : notif.type === 'sla'
                      ? 'bg-rose-100 text-rose-700'
                      : notif.type === 'comment'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {notif.type === 'registration' && <UserCheck className="w-4 h-4" />}
                  {notif.type === 'assignment' && <TicketIcon className="w-4 h-4" />}
                  {notif.type === 'sla' && <AlertTriangle className="w-4 h-4" />}
                  {notif.type === 'comment' && <MessageSquare className="w-4 h-4" />}
                  {notif.type === 'status' && <CheckCircle2 className="w-4 h-4" />}
                </div>

                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-xs">{notif.title}</span>
                    {!notif.isRead && (
                      <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                    )}
                    {notif.ticketNumber && (
                      <span className="text-[10px] bg-[#EFF8FF] text-[#1765B3] border border-[#B8DEFF] px-1.5 py-0.5 rounded font-mono font-bold">
                        {notif.ticketNumber.startsWith('REG-')
                          ? notif.ticketNumber
                          : formatTicketNumberDisplay(notif.ticketNumber)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">{notif.message}</p>

                  {/* Structured Registration Details Box if available */}
                  {notif.type === 'registration' && notif.registrationDetails && (
                    <div className="p-3 bg-[#F8FAFC] rounded-lg border border-slate-200 text-xs text-slate-700 space-y-1 my-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                        <div>
                          <span className="text-slate-500 font-medium">Nama: </span>
                          <span className="font-semibold text-slate-900">{notif.registrationDetails.fullName}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium">NIP: </span>
                          <span className="font-mono font-bold text-slate-900">{notif.registrationDetails.employeeId}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium">Email: </span>
                          <span className="text-slate-900 break-all">{notif.registrationDetails.corporateEmail}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium">Unit kerja: </span>
                          <span className="text-slate-900">{notif.registrationDetails.unitName}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium">Waktu pendaftaran: </span>
                          <span className="text-slate-900">
                            {new Date(notif.registrationDetails.submittedAt).toLocaleString('id-ID', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium">Status: </span>
                          <span className="inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                            {notif.registrationDetails.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <span className="text-[10px] text-slate-400 font-mono-numbers flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(notif.createdAt).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-2" />
            </div>
          ))
        )}
      </div>
    </div>
  );
};
