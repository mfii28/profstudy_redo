'use server';

import { createClient } from '@/lib/supabase-server';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logging';

export async function sendOtpEmail(params: {
  uid: string;
  callerIdToken: string;
}): Promise<{ success?: boolean; error?: string; alreadyVerified?: boolean }> {
  try {
    const { uid } = params;

    const user = await prisma.user.findUnique({
      where: { id: uid }
    });

    if (!user) {
      return { error: 'User not found.' };
    }

    if (user.emailVerified) {
      return { success: true, alreadyVerified: true };
    }

    // Call Supabase resend verification email
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
    });

    if (error) {
      logger.error('[OTP] Supabase resend failed', { uid, error: error.message });
      return { error: error.message };
    }

    logger.info('[OTP] Verification code resent successfully via Supabase', { uid });
    return { success: true };
  } catch (error: any) {
    logger.error('[OTP] sendOtpEmail exception', { error: error.message });
    return { error: error.message || 'Verification email could not be resent.' };
  }
}

export async function verifyOtp(params: {
  uid: string;
  code: string;
  callerIdToken: string;
}): Promise<{ success?: boolean; error?: string; alreadyVerified?: boolean; locked?: boolean }> {
  try {
    const { uid, code } = params;

    const user = await prisma.user.findUnique({
      where: { id: uid }
    });

    if (!user) {
      return { error: 'User not found.' };
    }

    if (user.emailVerified) {
      return { success: true, alreadyVerified: true };
    }

    // Verify code on Supabase
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: user.email,
      token: code,
      type: 'signup',
    });

    if (error) {
      logger.error('[OTP] Supabase verifyOtp failed', { uid, error: error.message });
      return { error: error.message };
    }

    // Mark verified in DB
    await prisma.user.update({
      where: { id: uid },
      data: { emailVerified: true }
    });

    // Send verified notification welcome email
    try {
      const { sendTransactionalEmail } = await import('@/app/actions/email');
      await sendTransactionalEmail({
        type: 'emailVerified',
        to: user.email,
        recipientName: user.name || 'Member',
        internalSecret: process.env.INTERNAL_EMAIL_SECRET,
      }).catch(() => undefined);
    } catch {}

    logger.info('[OTP] User email verified successfully via Supabase', { uid });
    return { success: true };
  } catch (error: any) {
    logger.error('[OTP] verifyOtp exception', { error: error.message });
    return { error: error.message || 'Verification failed.' };
  }
}

export async function adminMarkEmailVerified(params: {
  targetUid: string;
  callerIdToken: string;
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const { targetUid, callerIdToken } = params;
    
    // Verify caller is admin
    const { requireAdminContextFromIdToken } = await import('@/lib/trusted-server-context');
    const adminCtx = await requireAdminContextFromIdToken(callerIdToken);
    if (!adminCtx.ok) {
      return { error: adminCtx.error || 'Unauthorized' };
    }

    // Update in database
    await prisma.user.update({
      where: { id: targetUid },
      data: { emailVerified: true }
    });

    logger.info('[OTP] Admin marked user email verified', { targetUid, adminId: adminCtx.userId });
    return { success: true };
  } catch (error: any) {
    logger.error('[OTP] adminMarkEmailVerified exception', { error: error.message });
    return { error: error.message || 'Failed to mark email verified.' };
  }
}
