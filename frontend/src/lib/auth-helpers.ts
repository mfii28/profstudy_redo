'use server';

import { adminAuth } from '@/firebase/admin';

/**
 * Verifies a Firebase ID token and returns the decoded UID.
 * Used as a lightweight auth gate for expensive operations like AI calls.
 */
export async function verifyAuth(idToken: string): Promise<{ uid: string } | { error: string }> {
  if (!idToken) {
    return { error: 'Authentication required.' };
  }
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return { uid: decoded.uid };
  } catch {
    return { error: 'Session expired. Please sign in again.' };
  }
}
