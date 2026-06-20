import { adminDb } from '@/firebase/admin';

/**
 * Get Firestore instance for server-side operations
 * Uses the shared Firebase Admin singleton from src/firebase/admin.ts
 */
export function getAdminDb() {
  return adminDb;
}
