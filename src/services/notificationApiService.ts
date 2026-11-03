import type { AppNotification } from '../types';
import { apiFetch, notifyDataChanged, readApiResponse } from './http';

function mapNotification(row: Record<string, any>): AppNotification {
  const type = ['status', 'assignment', 'comment', 'sla', 'system', 'registration'].includes(row.notification_type)
    ? row.notification_type
    : row.registration_request_id
      ? 'registration'
      : 'system';
  return {
    id: row.id,
    recipientId: row.user_id,
    ticketId: row.ticket_id || row.registration_request_id || '',
    ticketNumber: row.ticket_id || '',
    title: row.title,
    message: row.message,
    isRead: Boolean(row.is_read),
    type,
    createdAt: row.created_at,
    registrationDetails: row.registration_request_id
      ? {
          requestId: row.registration_request_id,
          fullName: '',
          employeeId: '',
          corporateEmail: '',
          unitName: '',
          submittedAt: row.created_at,
          status: 'Menunggu Verifikasi',
        }
      : undefined,
  };
}

export async function listNotifications(): Promise<AppNotification[]> {
  const response = await apiFetch('/api/notifications');
  const body = await readApiResponse(response);
  return (body.notifications as Array<Record<string, any>>).map(mapNotification);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const response = await apiFetch(`/api/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PATCH' });
  await readApiResponse(response);
  notifyDataChanged();
}

export async function markAllNotificationsRead(): Promise<void> {
  const response = await apiFetch('/api/notifications/read-all', { method: 'POST' });
  await readApiResponse(response);
  notifyDataChanged();
}
