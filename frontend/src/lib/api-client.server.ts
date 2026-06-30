/**
 * Server-safe API client.
 * Does NOT import any client-only modules (Supabase).
 */

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

export async function apiFetchServer(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  // Build the full URL. API_URL should be something like:
  //   http://localhost:8000/api/v1   (local dev, from .env)
  //   https://api.example.com        (production, no prefix)
  // If the base URL doesn't already contain /api/v1, add it.
  const apiPrefix = API_URL.includes('/api/v1') ? '' : '/api/v1';
  const separator = path.startsWith('/') ? '' : '/';
  return fetch(`${API_URL}${apiPrefix}${separator}${path}`, {
    ...options,
    headers,
  });
}
