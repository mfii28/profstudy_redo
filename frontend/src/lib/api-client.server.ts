/**
 * Server-safe API client.
 * Does NOT import any client-only modules (Supabase).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function apiFetchServer(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  return fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers,
  });
}
