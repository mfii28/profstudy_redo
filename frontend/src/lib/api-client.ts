'use client';

/**
 * Shared API client for calling the Python backend.
 * Automatically attaches Supabase JWT when available.
 */

import { supabase } from '@/lib/supabase-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function apiFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  let token: string | undefined;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token;
  } catch {
    // Not in browser or not authenticated
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
