'use client';

/**
 * Shared API client for calling the Python backend.
 * Automatically attaches Supabase JWT when available (client-side only).
 */

const BASE_API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

async function getClientToken(): Promise<string | undefined> {
  try {
    // Dynamic import ensures @supabase/ssr is only loaded on the client
    const mod = await import('@/lib/supabase-client');
    const { data: { session } } = await mod.supabase.auth.getSession();
    return session?.access_token;
  } catch {
    return undefined;
  }
}

export async function apiFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  let token: string | undefined;

  // Only attempt token retrieval on the client side
  if (typeof window !== 'undefined') {
    token = await getClientToken();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Build the full URL. BASE_API_URL should be something like:
  //   http://localhost:8000/api/v1   (local dev, from .env)
  //   https://api.example.com        (production, no prefix)
  // If the base URL doesn't already contain /api/v1, add it.
  const apiPrefix = BASE_API_URL.includes('/api/v1') ? '' : '/api/v1';
  const separator = path.startsWith('/') ? '' : '/';
  return fetch(`${BASE_API_URL}${apiPrefix}${separator}${path}`, {
    ...options,
    headers,
  });
}
