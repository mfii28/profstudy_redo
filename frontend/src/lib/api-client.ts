'use client';

/**
 * Shared API client for calling the Python backend.
 * Automatically attaches Supabase JWT when available (client-side only).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

  return fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers,
  });
}
