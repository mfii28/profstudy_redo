import { type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/admin-db';
import { adminAuth } from '@/firebase/admin';

export interface TrustedServerContext {
  success: boolean;
  userId?: string;
  role?: 'student' | 'tutor' | 'admin' | 'subadmin' | 'superadmin';
  error?: string;
}

const VALID_ROLES = ['student', 'tutor', 'admin', 'subadmin', 'superadmin'] as const;
type ValidRole = typeof VALID_ROLES[number];
export type AdminRole = 'admin' | 'subadmin' | 'superadmin';

export function isAdminRole(role: TrustedServerContext['role'] | null | undefined): role is AdminRole {
  return role === 'admin' || role === 'subadmin' || role === 'superadmin';
}

const DEFAULT_ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  admin: ['*'],
  superadmin: ['*'],
  subadmin: [
    'dashboard:view:main',
    'dashboard:view:analytics',
    'users:read',
    'courses:read',
    'courses:approve',
    'finance:read',
  ],
};

async function hasServerPermission(role: AdminRole, roleId: string | undefined, permissionId: string): Promise<boolean> {
  if (role === 'superadmin' || role === 'admin') return true;

  if (roleId) {
    const db = getAdminDb();
    const roleSnap = await db.collection('roles').doc(roleId).get();
    if (roleSnap.exists) {
      const permissions = (roleSnap.data()?.permissions || []) as string[];
      return permissions.includes('*') || permissions.includes(permissionId);
    }
  }

  const fallback = DEFAULT_ROLE_PERMISSIONS[role] || [];
  return fallback.includes('*') || fallback.includes(permissionId);
}

function roleFromDecodedToken(decodedToken: Record<string, unknown>): ValidRole | null {
  return normalizeRole(decodedToken.role);
}

function resolveTrustedRole(
  firestoreRole: unknown,
  claimRole: ValidRole | null
): ValidRole | null {
  const docRole = normalizeRole(firestoreRole);

  if (docRole && claimRole) {
    if (isAdminRole(claimRole) && !isAdminRole(docRole)) {
      return claimRole;
    }
    return docRole;
  }

  return docRole || claimRole;
}

export async function getTrustedServerContextFromIdToken(idToken: string): Promise<TrustedServerContext> {
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const claimRole = roleFromDecodedToken(decodedToken as Record<string, unknown>);
    const db = getAdminDb();
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      if (claimRole) {
        return { success: true, userId, role: claimRole };
      }
      return { success: false, error: 'User profile not found' };
    }

    const role = resolveTrustedRole(userSnap.data()?.role, claimRole);
    if (!role) {
      const firestoreRole = userSnap.data()?.role;
      return {
        success: false,
        error: `User has no valid role (profile: "${firestoreRole}", token: "${(decodedToken as Record<string, unknown>).role ?? ''}")`,
      };
    }

    return { success: true, userId, role };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Token verification failed.' };
  }
}

export async function requireAdminContextFromIdToken(
  idToken: string,
  permissionId?: string
): Promise<{ ok: true; userId: string; role: AdminRole } | { ok: false; error: string }> {
  const ctx = await getTrustedServerContextFromIdToken(idToken);
  if (!ctx.success || !ctx.userId) {
    return { ok: false, error: ctx.error || 'Authentication failed.' };
  }
  if (!isAdminRole(ctx.role)) {
    return {
      ok: false,
      error:
        ctx.role === 'student' || ctx.role === 'tutor'
          ? 'Your account does not have admin access. Sign out and use an admin account, or ask a super-admin to update your role.'
          : `Admin access denied (role: ${ctx.role ?? 'unknown'}).`,
    };
  }

  if (!permissionId) {
    return { ok: true, userId: ctx.userId, role: ctx.role };
  }

  const db = getAdminDb();
  const callerSnap = await db.collection('users').doc(ctx.userId).get();
  const roleId = callerSnap.data()?.roleId as string | undefined;
  const allowed = await hasServerPermission(ctx.role, roleId, permissionId);
  if (!allowed) {
    return { ok: false, error: 'Permission denied.' };
  }

  return { ok: true, userId: ctx.userId, role: ctx.role };
}

function normalizeRole(value: unknown): ValidRole | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim().toLowerCase();
  // Accept common mis-spellings / legacy values
  if (raw === 'students' || raw === 'learner' || raw === 'learners') return 'student';
  if (raw === 'administrator') return 'admin';
  if (raw === 'super_admin' || raw === 'super-admin') return 'superadmin';
  if (raw === 'sub_admin' || raw === 'sub-admin') return 'subadmin';
  return (VALID_ROLES as readonly string[]).includes(raw) ? (raw as ValidRole) : null;
}

/**
 * Validates incoming API requests via Firebase ID Token (Bearer) or __session cookie.
 */
export async function validateTrustedServerContext(request: NextRequest): Promise<TrustedServerContext> {
  const path = request.nextUrl.pathname;
  try {
    // ── 1. Token extraction ─────────────────────────────────────────────────
    const authHeader = request.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const sessionToken = request.cookies.get('__session')?.value || null;
    const idToken = bearerToken || sessionToken;

    if (!idToken) {
      console.error(`[Auth] ${path} — no token or __session cookie present`);
      return { success: false, error: 'Missing auth token or session cookie' };
    }

    // ── 2. Token verification ────────────────────────────────────────────────
    let decodedToken: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (tokenErr: any) {
      console.error(`[Auth] ${path} — verifyIdToken failed:`, tokenErr.code, tokenErr.message);
      return { success: false, error: `Token verification failed: ${tokenErr.code ?? tokenErr.message}` };
    }

    const userId = decodedToken.uid;
    const db = getAdminDb();
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      console.error(`[Auth] ${path} — user profile not found for uid=${userId}`);
      return { success: false, error: 'User profile not found' };
    }

    const userData = userSnap.data();
    const role = normalizeRole(userData?.role);

    if (!role) {
      console.error(`[Auth] ${path} — invalid role "${userData?.role}" for uid=${userId}`);
      return { success: false, error: `User has no valid role (got: "${userData?.role}")` };
    }

    return { success: true, userId, role };
  } catch (error: any) {
    console.error(`[Auth] ${path} — unexpected error:`, error);
    return { success: false, error: error.message };
  }
}
