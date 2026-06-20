'use server';

import { adminAuth, adminDb } from '@/firebase/admin';
import { setUserRoleClaim } from '@/lib/auth-claims';
import { requireAdminContextFromIdToken } from '@/lib/trusted-server-context';

const SETTINGS_DOC = 'platformSettings/superadmin-temp-signup';

function getEnabledFromConfig(data: any): boolean {
  if (!data) return true;
  if (typeof data.enabled === 'boolean') return data.enabled;
  return true;
}

export async function isTempSuperadminSignupEnabled(): Promise<boolean> {
  const snap = await adminDb.doc(SETTINGS_DOC).get();
  return getEnabledFromConfig(snap.exists ? snap.data() : null);
}

export async function createTempSuperadminAccount(params: {
  name: string;
  email: string;
  password: string;
  setupKey: string;
}): Promise<{ success?: boolean; error?: string; uid?: string }> {
  try {
    const expectedKey = process.env.SUPERADMIN_TEMP_SIGNUP_KEY;
    if (!expectedKey) return { error: 'Temporary signup is not configured.' };
    if (!params.setupKey || params.setupKey !== expectedKey) return { error: 'Invalid setup key.' };

    const enabled = await isTempSuperadminSignupEnabled();
    if (!enabled) return { error: 'Temporary superadmin signup is disabled.' };

    const email = params.email.trim().toLowerCase();
    const name = params.name.trim();
    const password = params.password;
    if (!name) return { error: 'Name is required.' };
    if (!email || !email.includes('@')) return { error: 'Valid email is required.' };
    if (!password || password.length < 10) return { error: 'Password must be at least 10 characters.' };

    try {
      const existing = await adminAuth.getUserByEmail(email);
      if (existing) return { error: 'A user with this email already exists.' };
    } catch (error: any) {
      if (error?.code !== 'auth/user-not-found') throw error;
    }

    const created = await adminAuth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
      disabled: false,
    });

    const now = new Date().toISOString();
    await adminDb.doc(`users/${created.uid}`).set({
      id: created.uid,
      name,
      email,
      role: 'superadmin',
      status: 'active',
      avatar: '',
      bio: '',
      isPremium: false,
      studyStreak: 0,
      enrollments: [],
      aiUsage: { tokensRemaining: 500, lastResetDate: now },
      emailVerified: true,
      createdAt: now,
      createdBy: 'temp-superadmin-signup',
    });

    await setUserRoleClaim(created.uid, 'superadmin');

    await adminDb.collection('auditLogs').doc(`log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`).set({
      actorId: 'system',
      actorName: 'Temp Signup',
      action: 'TEMP_SUPERADMIN_CREATED',
      targetId: created.uid,
      targetType: 'user',
      severity: 'critical',
      details: `Temporary superadmin signup used for ${email}`,
      timestamp: now,
    }).catch(() => undefined);

    return { success: true, uid: created.uid };
  } catch (error: any) {
    return { error: error?.message || 'Failed to create superadmin account.' };
  }
}

export async function disableTempSuperadminSignup(idToken: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const adminCtx = await requireAdminContextFromIdToken(idToken);
    if (!adminCtx.ok || adminCtx.role !== 'superadmin') {
      return { error: 'Only superadmin can disable temporary signup.' };
    }

    const now = new Date().toISOString();
    await adminDb.doc(SETTINGS_DOC).set({
      enabled: false,
      disabledAt: now,
      disabledBy: adminCtx.userId,
    }, { merge: true });

    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Failed to disable temporary signup.' };
  }
}
