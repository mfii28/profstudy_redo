'use server';

import { adminDb, adminAuth } from '@/firebase/admin';
import { Resend } from 'resend';
import { logger } from '@/lib/logging';
import { buildOtpEmailHtml } from '@/lib/email-templates';
import { getGlobalSettings } from '@/lib/platform-settings-data';
import { dispatchCommunication, previewChannelMessage, resolveAvailableOtpChannels } from '@/lib/communications';

/**
 * @fileOverview Server actions for email OTP verification.
 * Uses SHA-256 to hash 6-digit codes stored in a short-lived Firestore document.
 * No bcrypt needed — codes are short-lived (10 min) and numeric-only.
 */

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const OTP_COLLECTION = 'emailOtps';

function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

function buildFromField(displayName: string, emailAddress: string): string {
  const SPECIAL_CHARS = /[",;:<>()[\]\\@]/;
  const safeName = SPECIAL_CHARS.test(displayName)
    ? `"${displayName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    : displayName;
  return `${safeName} <${emailAddress}>`;
}

async function setEmailVerifiedClaimWithRetry(uid: string, value: boolean): Promise<{ error?: string }> {
  const { setEmailVerifiedClaim } = await import('@/lib/auth-claims');
  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await setEmailVerifiedClaim(uid, value);
    if (!result.error) return {};
    lastError = result.error;
    await new Promise((resolve) => setTimeout(resolve, attempt * 300));
  }
  return { error: lastError || 'Claim update failed' };
}

async function sha256(text: string): Promise<string> {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(text).digest('hex');
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function getSenderAddress(): Promise<{ from: string; fallbackFrom: string; siteName: string }> {
  const settings = await getGlobalSettings().catch(() => null);
  const siteName = settings?.siteName || 'Profs Training Solutions';
  const rawDomain = (process.env.APP_EMAIL_DOMAIN || 'mytestingdomain.icu').trim().toLowerCase();
  const domain = rawDomain.includes('@') ? rawDomain.split('@').pop()! : rawDomain;
  const envFrom = process.env.APP_EMAIL_FROM?.trim().toLowerCase();
  const fallbackFrom = `no-reply@${domain}`;
  const from = envFrom && envFrom.includes('@') ? envFrom : fallbackFrom;
  return { from, fallbackFrom, siteName };
}

/**
 * Generates and sends a 6-digit OTP to the user's email address.
 * Stores a hashed copy in Firestore with a 10-minute expiry.
 * Rate-limited: won't resend if a valid code was sent within 60 seconds.
 *
 * Requires a valid Firebase ID token for the requesting user. The decoded UID
 * must match `params.uid` to prevent IDOR/cross-account OTP requests.
 *
 * Email is loaded from Firestore by UID — callers cannot redirect the code
 * to an arbitrary address.
 *
 * Also sets the `emailVerified: false` custom claim so the middleware gate
 * is deterministic from the first page load after signup.
 */
export async function sendOtpEmail(params: {
  uid: string;
  /** Firebase ID token of the requesting user. Verified server-side. */
  callerIdToken: string;
}): Promise<{ success?: boolean; error?: string; claimFailed?: boolean; alreadyVerified?: boolean }> {
  try {
    const { uid, callerIdToken } = params;

    if (!uid || !callerIdToken) {
      return { error: 'Missing uid or caller token.' };
    }

    // Verify the caller's identity server-side and enforce uid === caller.uid
    let decodedCaller;
    try {
      decodedCaller = await adminAuth.verifyIdToken(callerIdToken);
    } catch {
      return { error: 'Unauthorized: invalid caller token.' };
    }
    if (decodedCaller.uid !== uid) {
      return { error: 'Unauthorized: token UID does not match target UID.' };
    }

    // Always load from Firestore — never trust caller-supplied email/name
    const userSnap = await adminDb.doc(`users/${uid}`).get();
    if (!userSnap.exists) {
      return { error: 'User not found.' };
    }
    const userData = userSnap.data()!;
    const email: string = normalizeEmailAddress(userData.email || '');
    const name: string = userData.name || 'Member';
    const alreadyVerified = userData.emailVerified === true;

    if (!email) {
      return { error: 'No email address on file for this account.' };
    }

    if (alreadyVerified) {
      const claimResult = await setEmailVerifiedClaimWithRetry(uid, true);
      if (claimResult.error) {
        logger.error('[OTP] Account already verified, but claim sync failed', { uid, error: claimResult.error });
        return { error: 'Your account is verified, but session sync failed. Please sign out and sign in again.' };
      }

      await adminDb.doc(`${OTP_COLLECTION}/${uid}`).delete().catch(() => {});
      logger.info('[OTP] OTP resend skipped for already verified account', { uid });
      return { success: true, alreadyVerified: true };
    }

    const otpRef = adminDb.doc(`${OTP_COLLECTION}/${uid}`);
    const existing = await otpRef.get();

    if (existing.exists) {
      const data = existing.data()!;
      const sentAt = data.sentAt as string | undefined;
      if (sentAt) {
        const secondsSince = (Date.now() - new Date(sentAt).getTime()) / 1000;
        if (secondsSince < RESEND_COOLDOWN_SECONDS) {
          const wait = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSince);
          return { error: `Please wait ${wait} seconds before requesting a new code.` };
        }
      }
    }

    // Set emailVerified: false claim so the middleware gate is active immediately
    // after signup. Treat claim failure as a hard error — without it the middleware
    // gate is unreliable and an unverified user could access protected routes.
    const claimResult = await setEmailVerifiedClaimWithRetry(uid, false);
    if (claimResult.error) {
      logger.error('[OTP] Failed to set emailVerified=false claim — aborting OTP send', { uid, error: claimResult.error });
      return { error: 'Could not initialize email verification. Please try again.', claimFailed: true };
    }

    const code = generateOtp();
    const hash = await sha256(code);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
    const sentAt = new Date().toISOString();

    await otpRef.set({ uid, email, hash, expiresAt, sentAt, attempts: 0 });

    const { from, fallbackFrom, siteName } = await getSenderAddress();
    const phone = typeof userData.phone_number === 'string' ? userData.phone_number : undefined;
    const availability = await resolveAvailableOtpChannels({ email, phoneNumber: phone });

    if (!availability.email && availability.dispatchChannels.length === 0) {
      logger.error('[OTP] No OTP delivery channel available', { uid, availability });
      return {
        error:
          'Verification could not be sent. Configure email (Resend) or enable SMS/WhatsApp with a valid phone number on your profile.',
      };
    }

    const otpMetadata = {
      otp_code: code,
      expires_minutes: String(OTP_EXPIRY_MINUTES),
      user_name: name,
    };
    const otpMessage = `${code} is your ${siteName} verification code. It expires in ${OTP_EXPIRY_MINUTES} minutes.`;
    const emailPreview = await previewChannelMessage('otp', 'email', otpMetadata, otpMessage).catch(() => null);

    let emailDelivered = false;
    if (availability.email) {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        logger.error('[OTP] RESEND_API_KEY not set — cannot send OTP email.');
      } else {
        const resend = new Resend(apiKey);
        let sendError: unknown = null;
        const plainText =
          emailPreview?.message ||
          `Hi ${name},\n\nYour ${siteName} verification code is: ${code}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share it with anyone.`;

        for (const sender of [from, fallbackFrom]) {
          const response = await resend.emails.send({
            from: buildFromField(siteName, sender),
            to: [email],
            subject: `${code} is your ${siteName} verification code`,
            html: buildOtpEmailHtml(siteName, name, code, OTP_EXPIRY_MINUTES),
            text: plainText,
          });

          if (!response.error) {
            sendError = null;
            emailDelivered = true;
            break;
          }
          sendError = response.error;
          logger.warn('[OTP] OTP send attempt failed', { uid, sender, error: response.error?.message || response.error });
        }

        if (sendError && availability.dispatchChannels.length === 0) {
          logger.error('[OTP] Failed to send OTP email after retries', { uid, error: sendError });
          await otpRef
            .update({
              lastDeliveryError: (sendError as { message?: string })?.message || String(sendError),
              lastDeliveryAttemptAt: new Date().toISOString(),
            })
            .catch(() => undefined);
          return { error: 'Failed to send verification email. Please confirm your email address and try again.' };
        }
      }
    }

    let smsDelivered = false;
    let whatsappDelivered = false;
    if (availability.dispatchChannels.length > 0 && phone) {
      const dispatch = await dispatchCommunication({
        eventKey: 'otp',
        userId: uid,
        channels: availability.dispatchChannels,
        phoneNumber: phone,
        email,
        message: otpMessage,
        title: 'Verification code',
        metadata: otpMetadata,
      }).catch(() => null);

      smsDelivered = !!dispatch?.results.some((r) => r.channel === 'sms' && r.status === 'sent');
      whatsappDelivered = !!dispatch?.results.some((r) => r.channel === 'whatsapp' && r.status === 'sent');
    }

    const phoneDelivered = smsDelivered || whatsappDelivered;
    if (!emailDelivered && !phoneDelivered) {
      logger.error('[OTP] OTP not delivered on any channel', { uid, availability });
      return {
        error:
          'Failed to send your verification code. Check your email address and phone number, or try again shortly.',
      };
    }

    logger.info('[OTP] Verification code sent', {
      uid,
      channels: { email: emailDelivered, sms: smsDelivered, whatsapp: whatsappDelivered },
    });
    return { success: true };
  } catch (error: any) {
    logger.error('[OTP] sendOtpEmail exception', { error: error.message });
    return { error: 'An unexpected error occurred. Please try again.' };
  }
}

/**
 * Verifies a user-submitted OTP code against the stored hash.
 * On success: marks the user as verified in Firestore + Firebase Auth custom claims.
 * On failure: increments the attempt counter; locks out after MAX_ATTEMPTS.
 *
 * Requires a valid Firebase ID token for the requesting user. The decoded UID
 * must match `params.uid` to prevent cross-account verification abuse.
 */
export async function verifyOtp(params: {
  uid: string;
  code: string;
  /** Firebase ID token of the requesting user. Verified server-side. */
  callerIdToken: string;
}): Promise<{ success?: boolean; error?: string; locked?: boolean; alreadyVerified?: boolean }> {
  try {
    const { uid, code, callerIdToken } = params;

    if (!callerIdToken) {
      return { error: 'Unauthorized: caller token is required.' };
    }

    // Verify caller identity and enforce uid === caller.uid
    let decodedCaller;
    try {
      decodedCaller = await adminAuth.verifyIdToken(callerIdToken);
    } catch {
      return { error: 'Unauthorized: invalid caller token.' };
    }
    if (decodedCaller.uid !== uid) {
      return { error: 'Unauthorized: token UID does not match target UID.' };
    }

    if (!uid || !code || !/^\d{6}$/.test(code)) {
      return { error: 'Invalid code format.' };
    }

    const userRef = adminDb.doc(`users/${uid}`);
    const existingUser = await userRef.get();
    if (existingUser.exists && existingUser.data()?.emailVerified === true) {
      const claimResult = await setEmailVerifiedClaimWithRetry(uid, true);
      if (claimResult.error) {
        logger.error('[OTP] Already-verified account claim sync failed during verify', { uid, error: claimResult.error });
        return { error: 'Account is already verified, but session sync failed. Please sign out and sign in again.' };
      }
      await adminDb.doc(`${OTP_COLLECTION}/${uid}`).delete().catch(() => {});
      return { success: true, alreadyVerified: true };
    }

    const otpRef = adminDb.doc(`${OTP_COLLECTION}/${uid}`);
    const snap = await otpRef.get();

    if (!snap.exists) {
      return { error: 'No verification code found. Please request a new one.' };
    }

    const data = snap.data()!;
    const { hash, expiresAt, attempts } = data as {
      hash: string;
      expiresAt: string;
      attempts: number;
    };

    if (attempts >= MAX_ATTEMPTS) {
      return { error: 'Too many incorrect attempts. Please request a new code.', locked: true };
    }

    if (new Date(expiresAt) < new Date()) {
      return { error: 'This code has expired. Please request a new one.' };
    }

    const submittedHash = await sha256(code);
    if (submittedHash !== hash) {
      await otpRef.update({ attempts: attempts + 1 });
      const remaining = MAX_ATTEMPTS - attempts - 1;
      if (remaining <= 0) {
        return { error: 'Too many incorrect attempts. Please request a new code.', locked: true };
      }
      return { error: `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` };
    }

    await userRef.update({ emailVerified: true });

    // Both Firestore doc and custom claim must succeed — claim failure means the
    // middleware gate stays active even after the user submits the correct code.
    const claimResult = await setEmailVerifiedClaimWithRetry(uid, true);
    if (claimResult.error) {
      // Roll back the Firestore update so doc and claim stay in sync
      await adminDb.doc(`users/${uid}`).update({ emailVerified: false }).catch(() => {});
      logger.error('[OTP] Claim update failed after correct code — rolling back', { uid, error: claimResult.error });
      return { error: 'Verification could not complete. Please try again.' };
    }

    await otpRef.delete();

    const userSnap = await adminDb.doc(`users/${uid}`).get();
    if (userSnap.exists) {
      const userData = userSnap.data() as { name?: string; email?: string } | undefined;
      const email = userData?.email ? normalizeEmailAddress(userData.email) : '';
      if (email) {
        const { sendTransactionalEmail } = await import('@/app/actions/email');
        await sendTransactionalEmail({
          type: 'emailVerified',
          to: email,
          recipientName: userData?.name || 'Member',
          internalSecret: process.env.INTERNAL_EMAIL_SECRET,
        }).catch(() => undefined);
      }
    }

    logger.info('[OTP] Email verified successfully', { uid });
    return { success: true };
  } catch (error: any) {
    logger.error('[OTP] verifyOtp exception', { error: error.message });
    return { error: 'Verification failed. Please try again.' };
  }
}

/**
 * Admin-only: manually mark a user's email as verified.
 * Used to unblock users with email delivery issues.
 */
export async function adminMarkEmailVerified(params: {
  targetUid: string;
  callerIdToken: string;
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const { targetUid, callerIdToken } = params;

    const decoded = await adminAuth.verifyIdToken(callerIdToken);
    const callerDoc = await adminDb.doc(`users/${decoded.uid}`).get();
    const callerRole = callerDoc.data()?.role as string | undefined;

    if (!callerRole || !['admin', 'superadmin', 'subadmin'].includes(callerRole)) {
      return { error: 'Unauthorized. Only admins can manually verify emails.' };
    }

    await adminDb.doc(`users/${targetUid}`).update({ emailVerified: true });

    // Claim update must succeed — if it fails, roll back Firestore and surface the error
    // so the admin UI does not show "verified" while the middleware gate still blocks the user.
    const claimResult = await setEmailVerifiedClaimWithRetry(targetUid, true);
    if (claimResult.error) {
      await adminDb.doc(`users/${targetUid}`).update({ emailVerified: false }).catch(() => {});
      logger.error('[OTP] Admin verification: claim update failed — rolled back', { targetUid, error: claimResult.error });
      return { error: 'Email verification partially failed (claim could not be updated). Please retry.' };
    }

    await adminDb.doc(`${OTP_COLLECTION}/${targetUid}`).delete().catch(() => {});

    const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    await adminDb.doc(`auditLogs/${logId}`).set({
      actorId: decoded.uid,
      actorName: callerDoc.data()?.name || 'Admin',
      action: 'ADMIN_MARK_EMAIL_VERIFIED',
      targetId: targetUid,
      targetType: 'user',
      severity: 'info',
      details: `Admin manually marked email as verified for uid=${targetUid}`,
      timestamp: new Date().toISOString(),
    }).catch(() => {});

    logger.info('[OTP] Admin manually verified email', { targetUid, callerUid: decoded.uid });
    return { success: true };
  } catch (error: any) {
    logger.error('[OTP] adminMarkEmailVerified exception', { error: error.message });
    return { error: 'Failed to verify email.' };
  }
}
