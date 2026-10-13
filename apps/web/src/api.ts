const API_BASE = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

export function getToken(): string | null {
  return localStorage.getItem('ziozen_access_token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('ziozen_access_token', token);
  else localStorage.removeItem('ziozen_access_token');
}

export type RequestOptions = RequestInit & { json?: unknown };

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  return response.json() as Promise<T>;
}
