'use server';

import { adminDb, adminAuth } from '@/firebase/admin';
import { z } from 'zod';
import { logger } from '@/lib/logging';
import { dispatchCommunication } from '@/lib/communications';
import { getTrustedServerContextFromIdToken, requireAdminContextFromIdToken } from '@/lib/trusted-server-context';
import { setUserRoleClaim } from '@/lib/auth-claims';

/**
 * Aligns Firebase Auth custom claims with the user's Firestore role.
 * Call after admin login so server actions recognize admin JWT claims.
 */
export async function syncAdminSessionClaims(
  idToken: string
): Promise<{ success?: true; error?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const userSnap = await adminDb.doc(`users/${decoded.uid}`).get();
    if (!userSnap.exists) {
      return { error: 'User profile not found' };
    }

    const rawRole = userSnap.data()?.role;
    const role = typeof rawRole === 'string' ? rawRole.trim().toLowerCase() : '';
    if (!['admin', 'superadmin', 'subadmin'].includes(role)) {
      return { error: 'Not an admin account.' };
    }

    const claimResult = await setUserRoleClaim(decoded.uid, role);
    if (claimResult.error) {
      return { error: claimResult.error };
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to sync admin session.';
    logger.error('[User Action] syncAdminSessionClaims failed', { errorMessage: message });
    return { error: message };
  }
}

export async function syncUserEmailVerification(params: {
  uid: string;
  verified: boolean;
  idToken: string;
}): Promise<{ success?: true; error?: string }> {
  const ctx = await getTrustedServerContextFromIdToken(params.idToken);
  if (!ctx.success || ctx.userId !== params.uid) {
    return { error: 'Unauthorized.' };
  }
  const { setEmailVerifiedClaim } = await import('@/lib/auth-claims');
  const claimResult = await setEmailVerifiedClaim(params.uid, params.verified);
  if (claimResult.error) {
    return { error: claimResult.error };
  }
  await adminDb.doc(`users/${params.uid}`).set({ emailVerified: params.verified }, { merge: true });
  return { success: true };
}

// Validation schemas
const updateEmailPreferencesSchema = z.object({
  token: z.string().min(1, 'Unsubscribe token is required'),
  preferences: z.object({
    subscribedToMarketing: z.boolean().optional(),
    subscribedToTransactional: z.boolean().optional(),
  }),
});

/**
 * Updates a user's email preferences in the database.
 * @param token The user's unsubscribe token.
 * @param preferences The new email preferences.
 */
export async function updateUserEmailPreferences(token: string, preferences: { subscribedToMarketing?: boolean, subscribedToTransactional?: boolean }) {
  try {
    // SECURITY: Validate input
    const validInput = updateEmailPreferencesSchema.safeParse({ token, preferences });
    if (!validInput.success) {
      logger.warn('[User Action] Invalid email preferences input', {
        errors: validInput.error.issues,
      });
      return { error: 'Invalid input: ' + validInput.error.issues.map(i => i.message).join(', ') };
    }

    const querySnapshot = await adminDb
      .collection('users')
      .where('unsubscribeToken', '==', token)
      .limit(1)
      .get();

    if (querySnapshot.empty) {
      logger.warn('[User Action] Invalid unsubscribe token provided');
      return { error: "Invalid unsubscribe token." };
    }

    const userDoc = querySnapshot.docs[0];
    const userRef = adminDb.doc(`users/${userDoc.id}`);

    await userRef.update({
      'preferences.notifPromotions': preferences.subscribedToMarketing,
      'preferences.notifCourseAnnouncements': preferences.subscribedToTransactional,
    });

    logger.info('[User Action] Email preferences updated successfully', {
      userId: userDoc.id,
    });

    return { success: true };
  } catch (error: any) {
    logger.error('[User Action] Failed to update email preferences', {
      errorMessage: error.message,
    });
    return { error: "Failed to update your preferences." };
  }
}

const setRoleSchema = z.object({
  targetUid: z.string().min(1),
  role: z.enum(['admin', 'superadmin', 'subadmin', 'tutor', 'student']),
  idToken: z.string().min(1),
});

/**
 * Role hierarchy for privilege checking (higher index = more privileges)
 */
const ROLE_HIERARCHY = ['student', 'tutor', 'subadmin', 'admin', 'superadmin'] as const;
type Role = typeof ROLE_HIERARCHY[number];

function getRoleLevel(role: string): number {
  return ROLE_HIERARCHY.indexOf(role as Role);
}

function canAssignRole(callerRole: string, targetRole: string): boolean {
  const callerLevel = getRoleLevel(callerRole);
  const targetLevel = getRoleLevel(targetRole);
  // Caller must have higher privileges than the role they're assigning
  return callerLevel > targetLevel;
}

/**
 * Updates a user's role in both Firestore and Firebase Auth custom claims.
 * SECURITY: Requires a valid idToken from an admin/superadmin/subadmin caller.
 * RBAC: Subadmins can only assign roles below their level (student, tutor).
 *       Only admin/superadmin can assign admin-level roles.
 */
export async function setRole(targetUid: string, role: 'admin' | 'superadmin' | 'subadmin' | 'tutor' | 'student', idToken: string) {
  try {
    const validInput = setRoleSchema.safeParse({ targetUid, role, idToken });
    if (!validInput.success) return { error: 'Invalid input.' };

    const adminCtx = await requireAdminContextFromIdToken(idToken);
    if (!adminCtx.ok) {
      return { error: adminCtx.error };
    }
    const callerDoc = await adminDb.doc(`users/${adminCtx.userId}`).get();
    const callerRole = callerDoc.data()?.role;

    // Check if caller can assign the specific target role (prevents privilege escalation)
    if (!canAssignRole(callerRole, role)) {
      return { error: `Unauthorized. You cannot assign the role '${role}'.` };
    }

    // Update Firestore
    await adminDb.doc(`users/${targetUid}`).update({ role });

    // Update Custom Claims
    const { setUserRoleClaim } = await import('@/lib/auth-claims');
    await setUserRoleClaim(targetUid, role);

    logger.info('[User Action] Role updated for user', { targetUid, role, callerId: adminCtx.userId, callerRole });
    return { success: true };
  } catch (error: any) {
    logger.error('[User Action] Role update failed', { targetUid, role, errorMessage: error.message });
    return { error: 'Failed to update role.' };
  }
}

// ─── User profile bootstrap with welcome email ────────────────────────────────

/**
 * Builds a default user profile from Firebase Auth decoded token fields.
 * Server-side equivalent of buildDefaultUserProfile in user-data.ts.
 */
function buildServerUserProfile(
  uid: string,
  email: string,
  displayName: string | null,
  photoURL: string | null,
  phoneNumber?: string | null,
) {
  return {
    id: uid,
    name: displayName || 'Learner',
    email,
    role: 'student' as const,
    status: 'active' as const,
    avatar: photoURL || '',
    phone_number: phoneNumber || '',
    isPremium: false,
    enrollments: [],
    aiUsage: { tokensRemaining: 50, lastResetDate: new Date().toISOString() },
    studyStreak: 0,
    bio: '',
  };
}

/**
 * Server action: verifies the user's idToken, creates a Firestore profile if one does
 * not exist yet (via Admin SDK), and sends the welcome email via internal secret.
 * Idempotent — safe to call every session; exits immediately if profile already exists.
 */
export async function bootstrapUserProfile(
  idToken: string,
): Promise<{ isNew: boolean; error?: string }> {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();

    let user;
    // Attempt with token
    if (idToken) {
      const { data, error } = await supabase.auth.getUser(idToken);
      if (data.user && !error) user = data.user;
    }

    // Attempt with session cookies if token failed
    if (!user) {
      const { data, error } = await supabase.auth.getUser();
      if (data.user && !error) user = data.user;
    }

    if (!user) {
      return { isNew: false, error: 'Could not authenticate user for bootstrap.' };
    }

    const uid = user.id;
    const email = user.email;
    const displayName = user.user_metadata?.name || user.user_metadata?.full_name || '';
    const photoURL = user.user_metadata?.avatar_url || '';
    const phoneNumber = user.phone || '';

    if (!email) {
      logger.warn('[UserBootstrap] Token has no email', { uid });
      return { isNew: false };
    }

    const userRef = adminDb.doc(`users/${uid}`);
    const snap = await userRef.get();

    if (snap.exists) {
      return { isNew: false };
    }

    // New user — create profile server-side with Admin SDK
    const profile = buildServerUserProfile(uid, email, displayName || null, photoURL || null, phoneNumber || null);
    await userRef.set(profile);
    logger.info('[UserBootstrap] Created new user profile', { uid });

    // Send welcome email via trusted internal secret (no client token needed)
    const { sendTransactionalEmail } = await import('./email');
    const emailResult = await sendTransactionalEmail({
      type: 'welcome',
      to: email,
      recipientName: profile.name,
      internalSecret: process.env.INTERNAL_EMAIL_SECRET,
    });

    if (emailResult.error) {
      logger.warn('[UserBootstrap] Welcome email failed after profile creation', {
        uid,
        error: emailResult.error,
      });
      // Write audit entry so admins can see the failure
      const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      await adminDb.doc(`auditLogs/${logId}`).set({
        actorId: 'system',
        actorName: 'System',
        action: 'welcome-email-failed',
        targetId: uid,
        targetType: 'user',
        severity: 'warn',
        details: emailResult.error,
        timestamp: new Date().toISOString(),
      }).catch(() => {});
    }

    if (profile.phone_number) {
      dispatchCommunication({
        eventKey: 'welcome',
        userId: uid,
        phoneNumber: profile.phone_number,
        email,
        title: 'Welcome to Profs Training Solutions',
        message: `Welcome to Profs Training Solutions, ${profile.name}. Your account is ready.`,
        metadata: {
          source: 'bootstrapUserProfile',
          user_name: profile.name,
        },
      }).catch(() => undefined);
    }

    return { isNew: true };
  } catch (error: any) {
    logger.error('[UserBootstrap] Error bootstrapping user profile', { error: error?.message });
    return { isNew: false, error: error?.message || 'Profile bootstrap failed.' };
  }
}

// ─── Admin: Create Student Account ────────────────────────────────────────────

const createStudentSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  password: z.string().min(8).optional(),
  idToken: z.string().min(1),
});

/**
 * Admin-only server action: creates a new Firebase Auth account with role=student.
 * If password is provided, sets it directly.
 * If no password, generates and sends a password-reset link so the student can set their own.
 *
 * SECURITY: Caller must be admin/superadmin/subadmin (verified via idToken).
 */
export async function createStudentAccount(params: {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  idToken: string;
}): Promise<{ success?: true; uid?: string; error?: string }> {
  try {
    const valid = createStudentSchema.safeParse(params);
    if (!valid.success) {
      return { error: valid.error.issues.map(i => i.message).join(', ') };
    }

    const adminCtx = await requireAdminContextFromIdToken(params.idToken);
    if (!adminCtx.ok) {
      return { error: adminCtx.error };
    }
    const callerDoc = await adminDb.doc(`users/${adminCtx.userId}`).get();
    const callerRole = callerDoc.data()?.role as string | undefined;
    if (!callerRole) return { error: 'Unauthorized.' };

    // Check if email is already registered
    try {
      const existing = await adminAuth.getUserByEmail(params.email);
      if (existing) {
        return { error: 'A user with this email address already exists.' };
      }
    } catch (e: any) {
      // getUserByEmail throws auth/user-not-found when email is free — that is expected
      if (e?.code !== 'auth/user-not-found') {
        throw e;
      }
    }

    const createParams: Record<string, unknown> = {
      email: params.email,
      displayName: params.name,
      emailVerified: false,
      disabled: false,
    };
    if (params.phone) createParams.phoneNumber = params.phone;
    if (params.password) createParams.password = params.password;

    const newUser = await adminAuth.createUser(createParams);

    const profile = {
      id: newUser.uid,
      name: params.name,
      email: params.email,
      phone_number: params.phone || '',
      role: 'student' as const,
      status: 'active' as const,
      emailVerified: false,
      avatar: '',
      isPremium: false,
      enrollments: [],
      aiUsage: { tokensRemaining: 50, lastResetDate: new Date().toISOString() },
      studyStreak: 0,
      bio: '',
      createdAt: new Date().toISOString(),
    };

    await adminDb.doc(`users/${newUser.uid}`).set(profile);

    // Set custom role claim
    const { setUserRoleClaim, setEmailVerifiedClaim } = await import('@/lib/auth-claims');
    await setUserRoleClaim(newUser.uid, 'student');
    await setEmailVerifiedClaim(newUser.uid, false);

    // Audit log
    const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    await adminDb.doc(`auditLogs/${logId}`).set({
      actorId: adminCtx.userId,
      actorName: callerDoc.data()?.name || 'Admin',
      action: 'ADMIN_CREATE_STUDENT',
      targetId: newUser.uid,
      targetType: 'user',
      severity: 'info',
      details: `Admin manually created student account for ${params.email}`,
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    // Send email to the new student
    if (!params.password) {
      // No password set: generate a reset link and email it with a custom invite message
      try {
        const resetLink = await adminAuth.generatePasswordResetLink(params.email);
        const { Resend } = await import('resend');
        const resendApiKey = process.env.RESEND_API_KEY;
        if (resendApiKey) {
          const resend = new Resend(resendApiKey);
          const emailDomain = (process.env.APP_EMAIL_DOMAIN || 'mytestingdomain.icu')
            .trim().toLowerCase().replace(/^.*@/, '');
          const fromAddress = process.env.APP_EMAIL_FROM
            ? process.env.APP_EMAIL_FROM.trim()
            : `no-reply@${emailDomain}`;
          await resend.emails.send({
            from: fromAddress,
            to: params.email,
            subject: 'You have been invited to join Profs Training Solutions',
            html: `<p>Hi ${params.name},</p>
<p>Your student account has been created on Profs Training Solutions. To set your password and get started, click the link below:</p>
<p><a href="${resetLink}" style="font-weight:bold;">Set my password</a></p>
<p>This link expires in 1 hour. If you did not expect this email, you can safely ignore it.</p>`,
          });
        }
      } catch (emailErr: any) {
        logger.warn('[User Action] Failed to send invite email for new student', {
          uid: newUser.uid,
          error: emailErr?.message,
        });
      }
    } else {
      // Password was set: send a plain welcome email via the existing transactional helper
      try {
        const { sendTransactionalEmail } = await import('./email');
        await sendTransactionalEmail({
          type: 'welcome',
          to: params.email,
          recipientName: params.name,
          internalSecret: process.env.INTERNAL_EMAIL_SECRET,
        });
      } catch (emailErr: any) {
        logger.warn('[User Action] Failed to send welcome email for new student', {
          uid: newUser.uid,
          error: emailErr?.message,
        });
      }
    }

    logger.info('[User Action] Admin created student account', {
      newUid: newUser.uid,
      callerUid: adminCtx.userId,
    });

    return { success: true, uid: newUser.uid };
  } catch (error: any) {
    logger.error('[User Action] createStudentAccount failed', { errorMessage: error.message });
    if (error?.code === 'auth/email-already-exists') {
      return { error: 'A user with this email address already exists.' };
    }
    return { error: error.message || 'Failed to create student account.' };
  }
}

/**
 * Syncs a user's custom claim with their Firestore role.
 * Can be called by the user themselves or an admin.
 */
export async function syncUserRole(uid: string) {
  try {
    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) return { error: 'User not found.' };
    
    const role = userDoc.data()?.role || 'student';
    const { setUserRoleClaim } = await import('@/lib/auth-claims');
    await setUserRoleClaim(uid, role);
    
    return { success: true, role };
  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * Public-safe password reset communication hook.
 * Always returns success to avoid user enumeration.
 */
export async function notifyPasswordResetRequested(email: string): Promise<{ success: true }> {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return { success: true };

  try {
    const authUser = await adminAuth.getUserByEmail(normalized).catch(() => null);
    if (!authUser) return { success: true };

    const userSnap = await adminDb.doc(`users/${authUser.uid}`).get();
    if (!userSnap.exists) return { success: true };
    const user = userSnap.data() as { name?: string; phone_number?: string; email?: string } | undefined;

    await dispatchCommunication({
      eventKey: 'password_reset',
      userId: authUser.uid,
      title: 'Password reset requested',
      message: 'A password reset was requested for your account.',
      phoneNumber: user?.phone_number,
      email: user?.email || normalized,
      metadata: {
        user_name: user?.name || 'Member',
        message: 'A password reset was requested for your account.',
      },
    });
  } catch (error: any) {
    logger.warn('[User Action] notifyPasswordResetRequested failed', {
      error: error?.message,
    });
  }

  return { success: true };
}

export async function checkRegistrationNumberExistsAction(registrationNumber: string): Promise<boolean> {
  const prisma = (await import('@/lib/prisma')).default;
  try {
    const user = await prisma.user.findFirst({
      where: { student_registration_number: registrationNumber.trim() }
    });
    return !!user;
  } catch (error) {
    console.error('checkRegistrationNumberExistsAction failed:', error);
    return false;
  }
}

export async function registerUser(params: {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'tutor';
  phone_number: string;
  student_registration_number?: string;
  affiliate_link?: string;
  referredBy?: string;
}) {
  const prisma = (await import('@/lib/prisma')).default;

  try {
    const email = params.email.trim().toLowerCase();
    const name = params.name.trim();
    const now = new Date();

    const newUser = await prisma.user.create({
      data: {
        id: params.id,
        email,
        name,
        role: params.role,
        status: 'active',
        phone_number: params.phone_number,
        student_registration_number: params.student_registration_number ? params.student_registration_number.trim() : null,
        affiliate_link: params.affiliate_link || null,
        referredBy: params.referredBy || null,
        isPremium: false,
        tutorApproved: false,
        studyStreak: 0,
        emailVerified: false,
        createdAt: now,
        updatedAt: now,
        aiUsage: {
          tokensRemaining: params.role === 'tutor' ? 100 : 50,
          lastResetDate: now.toISOString(),
        },
        enrollments: [],
      }
    });

    // Send welcome email
    try {
      const { sendTransactionalEmail } = await import('./email');
      await sendTransactionalEmail({
        type: 'welcome',
        to: email,
        recipientName: name,
        internalSecret: process.env.INTERNAL_EMAIL_SECRET,
      });
    } catch (err) {
      console.error('[Signup Action] Welcome email failed:', err);
    }

    return { success: true, user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } };
  } catch (error: any) {
    console.error('[Signup Action] Exception during registration:', error);
    return { error: error.message || 'An unexpected error occurred during signup.' };
  }
}

export async function getUserProfileAction() {
  const { createClient } = await import('@/lib/supabase-server');
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  let userId = authUser?.id;
  if (!userId) {
    const sessionCookie = cookieStore.get('__session')?.value;
    if (sessionCookie) {
      try {
        const decoded = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf-8'));
        userId = decoded.uid;
      } catch (e) {
        // Ignored
      }
    }
  }

  if (!userId) return { error: 'Not authenticated' };

  const prisma = (await import('@/lib/prisma')).default;
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) return { error: 'User not found' };

  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar || '',
      bio: user.bio || '',
    }
  };
}

export async function updateUserProfileAction(data: { name?: string; bio?: string; avatar?: string }) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return { error: 'Not authenticated' };
  const userId = authUser.id;

  const prisma = (await import('@/lib/prisma')).default;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: data.name,
      bio: data.bio,
      avatar: data.avatar,
      updatedAt: new Date()
    }
  });

  if (data.name) {
    await supabase.auth.updateUser({
      data: { name: data.name }
    });
  }

  return {
    success: true,
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      avatar: updated.avatar || '',
      bio: updated.bio || '',
    }
  };
}

export async function changeUserPasswordAction(params: { currentPassword?: string; newPassword?: string }) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return { error: 'Not authenticated' };

  if (!params.newPassword) {
    return { error: 'New password is required.' };
  }
  if (params.newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters long.' };
  }

  const { error } = await supabase.auth.updateUser({
    password: params.newPassword
  });

  return { success: true };
}

export async function updateUserAddressAction(address: any) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return { error: 'Not authenticated' };
  const userId = authUser.id;

  const prisma = (await import('@/lib/prisma')).default;
  await prisma.user.update({
    where: { id: userId },
    data: {
      address: JSON.stringify(address),
      updatedAt: new Date()
    }
  });

  return { success: true };
}

export async function updateUserPreferencesAction(preferences: any) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return { error: 'Not authenticated' };
  const userId = authUser.id;

  const prisma = (await import('@/lib/prisma')).default;
  await prisma.user.update({
    where: { id: userId },
    data: {
      preferences: preferences as any,
      updatedAt: new Date()
    }
  });

  return { success: true };
}

export async function toggleWishlistAction(courseId: string, isAdded: boolean) {
  const { createClient } = await import('@/lib/supabase-server');
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return { error: 'Not authenticated' };
  const userId = authUser.id;

  const prisma = (await import('@/lib/prisma')).default;
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { wishlistCourseIds: true }
  });

  if (!user) return { error: 'User not found' };

  let wishlist = user.wishlistCourseIds || [];
  if (isAdded) {
    if (!wishlist.includes(courseId)) {
      wishlist.push(courseId);
    }
  } else {
    wishlist = wishlist.filter(id => id !== courseId);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      wishlistCourseIds: wishlist,
      updatedAt: new Date()
    }
  });

  return { success: true, wishlist };
}


