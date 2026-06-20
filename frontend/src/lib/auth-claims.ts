import { adminAuth } from '@/firebase/admin';
import { logger } from '@/lib/logging';

/**
 * Sets custom claims for a user, such as their role.
 * This should be called whenever a user's role is updated or during onboarding.
 * SECURITY: This must only be called from privileged server-side code.
 */
export async function setUserRoleClaim(uid: string, role: string) {
  try {
    const validRoles = ['admin', 'superadmin', 'subadmin', 'tutor', 'student'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role for custom claim: ${role}`);
    }

    const current = await adminAuth.getUser(uid).then(u => u.customClaims || {}).catch(() => ({}));
    await adminAuth.setCustomUserClaims(uid, { ...current, role });
    
    logger.info('[Auth Claims] Custom role claim set successfully', { uid, role });
    return { success: true };
  } catch (error: any) {
    logger.error('[Auth Claims] Failed to set custom role claim', { uid, errorMessage: error.message });
    return { error: error.message };
  }
}

/**
 * Sets the emailVerified custom claim on a Firebase Auth user.
 * Used after OTP verification to grant dashboard access.
 */
export async function setEmailVerifiedClaim(uid: string, verified: boolean) {
  try {
    const current = await adminAuth.getUser(uid).then(u => u.customClaims || {}).catch(() => ({}));
    await adminAuth.setCustomUserClaims(uid, { ...current, emailVerified: verified });
    logger.info('[Auth Claims] emailVerified claim set', { uid, verified });
    return { success: true };
  } catch (error: any) {
    logger.error('[Auth Claims] Failed to set emailVerified claim', { uid, errorMessage: error.message });
    return { error: error.message };
  }
}
