import type { User } from '../types';

async function readResponse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) {
    throw new Error(body.message || `Permintaan autentikasi gagal (${response.status}).`);
  }
  return body;
}

export async function getCurrentApiUser(): Promise<User | null> {
  const response = await fetch('/api/auth/me', { headers: { Accept: 'application/json' } });
  if (response.status === 401) return null;
  const body = await readResponse(response);
  return body.user as User;
}

export async function signInWithApi(
  identifier: string,
  password: string
): Promise<{ user?: User; error?: string }> {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identifier: identifier.trim(), password }),
    });
    const body = await readResponse(response);
    return { user: body.user as User };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Login gagal menghubungi backend.' };
  }
}

export async function signOutFromApi(): Promise<void> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  await readResponse(response);
}