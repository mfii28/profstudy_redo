import type { User as AppUser } from '@/lib/db';

const ADMIN_ROLES = new Set(['admin', 'superadmin', 'subadmin']);

export function isAdminRole(role?: string): boolean {
  return ADMIN_ROLES.has(role || '');
}

/** Firestore profile indicates the user still needs email verification. */
export function profileRequiresEmailVerification(appUser: Pick<AppUser, 'role' | 'emailVerified'>): boolean {
  if (isAdminRole(appUser.role)) return false;
  return appUser.emailVerified !== true;
}

/** JWT custom claim used by middleware for the verification gate. */
export async function claimRequiresEmailVerification(supabaseUser: { id: string; email?: string }): Promise<boolean> {
  // Email verification gate - simplified for Supabase
  return false;
}

export async function requiresEmailVerification(
  _firebaseUser: { uid: string },
  appUser: Pick<AppUser, 'role' | 'emailVerified'>
): Promise<boolean> {
  if (isAdminRole(appUser.role)) return false;
  const [claimNeeds, profileNeeds] = await Promise.all([
    claimRequiresEmailVerification({ id: _firebaseUser.uid }),
    Promise.resolve(profileRequiresEmailVerification(appUser)),
  ]);
  return claimNeeds || profileNeeds;
}

export async function refreshSessionCookie(_firebaseUser: { uid: string }): Promise<void> {
  // Simplified for Supabase — session managed by @supabase/ssr
}

export function getRoleDashboardPath(role?: string): string {
  if (isAdminRole(role)) return '/admin';
  if (role === 'tutor') return '/tutor-dashboard';
  return '/student-dashboard';
}
