'use client';

/**
 * Firebase Auth and data access layer.
 *
 * Core exports:
 * - `useUser` — current authenticated user
 * - `useAuth` — Auth client
 * - `FirebaseClientProvider` — wraps the app with auth context
 */
export * from './provider';
export * from './client-provider';

export function useFirestore() { return null; }
export function useAuth() { return { user: null }; }
