import type { User as FirebaseUser } from 'firebase/auth';
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
export async function claimRequiresEmailVerification(firebaseUser: FirebaseUser): Promise<boolean> {
  const token = await firebaseUser.getIdTokenResult();
  return token.claims.emailVerified !== true;
}

export async function requiresEmailVerification(
  firebaseUser: FirebaseUser,
  appUser: Pick<AppUser, 'role' | 'emailVerified'>
): Promise<boolean> {
  if (isAdminRole(appUser.role)) return false;
  const [claimNeeds, profileNeeds] = await Promise.all([
    claimRequiresEmailVerification(firebaseUser),
    Promise.resolve(profileRequiresEmailVerification(appUser)),
  ]);
  return claimNeeds || profileNeeds;
}

export async function refreshSessionCookie(firebaseUser: FirebaseUser): Promise<void> {
  const token = await firebaseUser.getIdToken(true);
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const maxAge = 60 * 60;
  const secureFlag = isSecure ? '; Secure' : '';
  document.cookie = `__session=${token}; path=/; max-age=${maxAge}; SameSite=Lax${secureFlag}`;
}

export function getRoleDashboardPath(role?: string): string {
  if (isAdminRole(role)) return '/admin';
  if (role === 'tutor') return '/tutor-dashboard';
  return '/student-dashboard';
}
