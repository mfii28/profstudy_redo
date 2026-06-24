'use client';

/**
 * Supabase Auth and data access layer.
 * Replaces the previous Firebase integration.
 *
 * Core exports:
 * - `useUser` — current authenticated user
 * - `useAuth` — Supabase Auth client
 * - `useFirestore` — deprecated (returns empty object; use REST API calls instead)
 * - `SupabaseClientProvider` — wraps the app with auth context
 */
export * from './provider';
export * from './client-provider';
