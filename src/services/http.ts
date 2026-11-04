export const DATA_CHANGED_EVENT = 'ticket-data-changed';

/** Base URL of the backend API. Set VITE_API_BASE_URL at build time when the
 *  frontend and backend are hosted on different origins. Leave blank for same-origin
 *  deployments (Cloudflare Worker API router, Laragon, Vite proxy, etc.). */
const API_BASE = (
  typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL)
    : ''
).replace(/\/$/, '');

export function notifyDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
}

export function listenDataChanged(handler: () => void) {
  window.addEventListener(DATA_CHANGED_EVENT, handler);
  return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  // Prefix relative /api paths with API_BASE when it is configured.
  if (API_BASE && typeof input === 'string' && input.startsWith('/')) {
    input = API_BASE + input;
  }
  const headers = new Headers(init.headers || {});
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });
}

export async function readApiResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(body.message || `Permintaan gagal (${response.status}).`);
  }
  return body;
}
