import {
  supabase,
  supabasePublishableKey,
  supabaseUrl,
} from '@/lib/supabase';

const API_URL =
  (process.env.NEXT_PUBLIC_API_URL || `${supabaseUrl}/functions/v1/api`).replace(
    /\/$/,
    '',
  );

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('apikey', supabasePublishableKey);
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw error;
  const token = session?.access_token;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const body: unknown = await response
      .json()
      .catch(() => ({ detail: 'Request failed' }));
    const message =
      typeof body === 'object' &&
      body !== null &&
      'detail' in body &&
      typeof body.detail === 'string'
        ? body.detail
        : 'Request failed';
    throw new ApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}
