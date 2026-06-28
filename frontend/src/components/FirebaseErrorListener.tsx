'use client';

/**
 * Removed — Firebase is no longer used.
 * This component previously listened for Firestore permission errors.
 * Kept as a no-op to avoid breaking imports.
 */

import { type ReactNode } from 'react';

export function FirebaseErrorListener({ children }: { children?: ReactNode }) {
  return children ?? null;
}
