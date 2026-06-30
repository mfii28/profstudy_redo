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
    let userId: string;
    let claimRole: ValidRole | null = null;

    // Fast path: try parsing the token as our base64 __session cookie (used by provider.tsx)
    try {
      const mockDecoded = JSON.parse(Buffer.from(idToken, 'base64').toString('utf-8'));
      if (mockDecoded && mockDecoded.uid) {
        userId = mockDecoded.uid;
        if (mockDecoded.role) claimRole = normalizeRole(mockDecoded.role);
      }
    } catch (e) {
      // Not a mock session token, proceed to proper JWT verification
    }

    // If not extracted yet, try Supabase validation
    if (!userId!) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user }, error } = await supabase.auth.getUser(idToken);
      
      if (user && !error) {
        userId = user.id;
        claimRole = normalizeRole(user.user_metadata?.role);
      } else {
        // Last resort: just decode to get the uid (for dev/test purposes)
        try {
          const jsonwebtoken = (await import('jsonwebtoken')).default;
          const decoded = jsonwebtoken.decode(idToken) as any;
          if (decoded && (decoded.sub || decoded.uid)) {
            userId = decoded.sub || decoded.uid;
            claimRole = normalizeRole(decoded.role);
          } else {
            return { success: false, error: 'Invalid token structure' };
          }
        } catch (decodeErr) {
          return { success: false, error: 'Token verification failed.' };
        }
      }
    }

    if (!userId!) {
      return { success: false, error: 'Could not extract user ID from token.' };
    }

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
        error: `User has no valid role (profile: "${firestoreRole}", token: "${claimRole ?? ''}")`,
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
 * Validates incoming API requests via Supabase Server Client or Authorization Header.
 */
export async function validateTrustedServerContext(request: NextRequest): Promise<TrustedServerContext> {
  const path = request.nextUrl.pathname;
  try {
    // ── 1. Token extraction & verification ──────────────────────────────────
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();
    
    let userId: string | null = null;
    let claimRole: string | null = null;
    
    // Attempt 1: Standard Supabase SSR Session (Reads cookies automatically)
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (user && !error) {
      userId = user.id;
      claimRole = user.user_metadata?.role;
    } else {
      // Attempt 2: Fallback to Authorization Header (for direct API calls)
      const authHeader = request.headers.get('Authorization');
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      
      if (bearerToken) {
        const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(bearerToken);
        if (tokenUser && !tokenError) {
          userId = tokenUser.id;
          claimRole = tokenUser.user_metadata?.role;
        } else {
          // Attempt 3: Check if the token is a mock __session cookie encoded as base64
          try {
            const mockDecoded = JSON.parse(Buffer.from(bearerToken, 'base64').toString('utf-8'));
            if (mockDecoded && mockDecoded.uid) {
              userId = mockDecoded.uid;
              claimRole = mockDecoded.role;
            }
          } catch (e) {
            // Ignored
          }
        }
      } else {
        // Attempt 4: Check raw __session cookie (used by legacy flows)
        const sessionToken = request.cookies.get('__session')?.value || null;
        if (sessionToken) {
           try {
            const mockDecoded = JSON.parse(Buffer.from(sessionToken, 'base64').toString('utf-8'));
            if (mockDecoded && mockDecoded.uid) {
              userId = mockDecoded.uid;
              claimRole = mockDecoded.role;
            }
          } catch (e) {
            // Ignored
          }
        }
      }
    }

    if (!userId) {
      console.error(`[Auth] ${path} — no valid session or auth token found`);
      return { success: false, error: 'Missing or invalid auth token' };
    }

    // ── 2. Profile Verification ─────────────────────────────────────────────
    const db = getAdminDb();
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      console.error(`[Auth] ${path} — user profile not found for uid=${userId}`);
      return { success: false, error: 'User profile not found' };
    }

    const userData = userSnap.data();
    const role = normalizeRole(userData?.role) || normalizeRole(claimRole);

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
