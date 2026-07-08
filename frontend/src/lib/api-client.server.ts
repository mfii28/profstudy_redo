/**
 * Server-safe API client.
 * Does NOT import any client-only modules (Firebase).
 */

import { cookies } from 'next/headers';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

export async function apiFetchServer(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (sessionCookie) {
      headers['Authorization'] = `Bearer ${sessionCookie}`;
    }
  } catch (err) {
    // If cookies() is called outside a valid request context, ignore.
  }

  // Build the full URL. API_URL should be something like:
  //   http://localhost:8000/api/v1   (local dev, from .env)
  //   https://api.example.com        (production, no prefix)
  let cleanPath = path;
  if (cleanPath.startsWith('/api/v1')) {
    cleanPath = cleanPath.substring(7); // remove '/api/v1'
  }
  
  const apiPrefix = API_URL.includes('/api/v1') ? '' : '/api/v1';
  const separator = cleanPath.startsWith('/') ? '' : '/';
  
  return fetch(`${API_URL}${apiPrefix}${separator}${cleanPath}`, {
    ...options,
    headers,
  });
}
