'use server';

import { Resend } from 'resend';
import { getUsersForBulkEmail } from '@/lib/user-data';
import { getGlobalSettings } from '@/lib/platform-settings-data';
import { logger } from '@/lib/logging';
import {
  buildWelcomeEmailHtml,
  buildEnrollmentConfirmationHtml,
  buildCourseApprovalEmailHtml,
  buildCourseRejectionEmailHtml,
  buildAnnouncementEmailHtml,
  buildLiveSessionEmailHtml,
  buildAdminEnrollmentEmailHtml,
  buildFreeEnrollmentEmailHtml,
  buildEmailVerifiedSuccessHtml,
} from '@/lib/email-templates';

/**
 * @fileOverview Hardened Server Action for sending platform emails via Resend.
 * SECURITY: API Key must be set in environment variables for production.
 * SECURITY: Requires idToken for user-initiated calls. System calls (webhooks) use internalSecret.
 */

const BATCH_SIZE = 49;
const MAX_BULK_RECIPIENTS = 5000;
const SEND_CONCURRENCY = 5;
const DEFAULT_EMAIL_DOMAIN = 'mytestingdomain.icu';

interface SendEmailParams {
  to: string | 'all' | 'students' | 'tutors';
  subject: string;
  message: string;
  type: 'Info' | 'Warning' | 'Promotion';
  idToken?: string;
  internalSecret?: string;
}

async function getResendApiKey() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.error('[Email Service] RESEND_API_KEY is not configured in environment variables.');
    throw new Error('RESEND_API_KEY is not configured. Please set it in your deployment secrets.');
  }
  return apiKey;
}

function normalizeEmail(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Handle "Display Name <email@domain.com>" format — extract just the email address.
  const angleBracket = trimmed.match(/<([^>]+)>/);
  const raw = angleBracket ? angleBracket[1] : trimmed;
  const lower = raw.trim().toLowerCase();
  return lower.includes('@') ? lower : null;
}

// Build a valid RFC 5321 from field. Quotes the display name if it contains
// characters that require quoting so Resend never rejects the format.
function buildFromField(displayName: string, emailAddress: string): string {
  const SPECIAL_CHARS = /[",;:<>()[\]\\@]/;
  const safeName = SPECIAL_CHARS.test(displayName)
    ? `"${displayName.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    : displayName;
  return `${safeName} <${emailAddress}>`;
}

function getDomainFromEmail(value?: string | null): string | null {
  const normalized = normalizeEmail(value);
  if (!normalized) return null;
  const [, domain] = normalized.split('@');
  return domain || null;
}

function isAllowedSenderDomain(email: string, allowedDomain: string): boolean {
  const domain = getDomainFromEmail(email);
  if (!domain) return false;
  return domain === allowedDomain || domain.endsWith(`.${allowedDomain}`);
}

function resolveSenderAddress(settingsContactEmail?: string) {
  // APP_EMAIL_DOMAIN may have been set to a full email address (e.g. no-reply@example.com)
  // instead of just the domain. Extract only the domain part in that case.
  const rawDomain = (process.env.APP_EMAIL_DOMAIN || DEFAULT_EMAIL_DOMAIN).trim().toLowerCase();
  const allowedDomain = rawDomain.includes('@') ? rawDomain.split('@').pop()! : rawDomain;
  const envFrom = normalizeEmail(process.env.APP_EMAIL_FROM);
  const settingsFrom = normalizeEmail(settingsContactEmail);
  const fallbackFrom = `no-reply@${allowedDomain}`;

  if (envFrom && isAllowedSenderDomain(envFrom, allowedDomain)) {
    return { from: envFrom, domain: allowedDomain };
  }
  if (settingsFrom && isAllowedSenderDomain(settingsFrom, allowedDomain)) {
    return { from: settingsFrom, domain: allowedDomain };
  }
  return { from: fallbackFrom, domain: allowedDomain };
}

async function logServerAuditAction(log: {
  actorId: string;
  actorName: string;
  action: string;
  targetId: string;
  targetType: string;
  severity: string;
  details: string;
}) {
  try {
    const { adminDb } = await import('@/firebase/admin');
    const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    await adminDb.doc(`auditLogs/${logId}`).set({
      ...log,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.warn('[Email Service] Audit logging failed on server', {
      action: log.action,
      targetId: log.targetId,
      errorMessage: error?.message,
    });
  }
}

// ─── Announcement bulk/single sender ─────────────────────────────────────────

export async function sendPlatformEmail({ to, subject, message, type, idToken, internalSecret }: SendEmailParams) {
  let actorId = 'system';
  const INTERNAL_SECRET = process.env.INTERNAL_EMAIL_SECRET;

  if (idToken) {
    try {
      const { adminAuth, adminDb: aDb } = await import('@/firebase/admin');
      const decoded = await adminAuth.verifyIdToken(idToken);
      actorId = decoded.uid;
      const userDoc = await aDb.doc(`users/${decoded.uid}`).get();
      const role = userDoc.exists ? userDoc.data()!.role : null;
      const isPrivileged = ['admin', 'superadmin', 'subadmin', 'tutor'].includes(role);
      const isSelfEmail = typeof to === 'string' && to !== 'all' && to !== 'students' && to !== 'tutors' && decoded.email === to;
      if (!isPrivileged && !isSelfEmail) {
        logger.warn('[Email Service] Unauthorized email send attempt', { uid: decoded.uid, role });
        return { error: 'You are not authorized to send emails.' };
      }
    } catch (authError: any) {
      logger.warn('[Email Service] Auth verification failed', { error: authError.message });
      return { error: 'Authentication failed. Please sign in again.' };
    }
  } else if (internalSecret && INTERNAL_SECRET && internalSecret === INTERNAL_SECRET) {
    actorId = 'system';
  } else {
    logger.warn('[Email Service] Email send attempt without authentication');
    return { error: 'Authentication required to send emails.' };
  }

  let apiKey: string;
  try {
    apiKey = await getResendApiKey();
  } catch (error: any) {
    logger.error('[Email Service] API Key configuration error', { error: error.message });
    return { error: error.message };
  }

  const resendClient = new Resend(apiKey);
  const settings = await getGlobalSettings();
  const { from: fromAddress, domain: senderDomain } = resolveSenderAddress(settings.contactEmail);
  const siteName = settings.siteName || 'Profs Training Solutions';
  const supportEmailCandidate = normalizeEmail(settings.supportEmail);
  const replyToAddress = supportEmailCandidate && isAllowedSenderDomain(supportEmailCandidate, senderDomain)
    ? supportEmailCandidate
    : undefined;

  let totalSent = 0;
  let totalFailed = 0;

  try {
    if (to === 'all' || to === 'students' || to === 'tutors') {
      let lastVisible: any = null;
      let hasMore = true;
      let processedRecipients = 0;

      const sendChunk = async (recipients: Array<{ email: string; name: string }>) => {
        const tasks = recipients.map(async (recipient) => {
          const personalizedMessage = message.replace(/\{\{name\}\}/g, recipient.name);
          const html = buildAnnouncementEmailHtml(siteName, recipient.name, recipient.email, subject, personalizedMessage, type);
          const { error } = await resendClient.emails.send({
            from: buildFromField(siteName, fromAddress),
            to: [recipient.email],
            subject,
            html,
            text: personalizedMessage,
            ...(replyToAddress ? { replyTo: replyToAddress } : {}),
          });

          if (error) {
            logger.error('[Email Service] Provider error for bulk send', { error, recipientEmail: recipient.email });
            totalFailed++;
          } else {
            totalSent++;
          }
        });
        await Promise.allSettled(tasks);
      };

      while (hasMore) {
        const { users, nextCursor } = await getUsersForBulkEmail(lastVisible, BATCH_SIZE);
        if (users.length === 0) break;

        const recipients = users
          .filter(u => to === 'all' || u.role === to.slice(0, -1))
          .map(u => ({ email: u.email, name: u.name || 'Member' }));

        if (processedRecipients >= MAX_BULK_RECIPIENTS) {
          hasMore = false;
          break;
        }

        const capped = recipients.slice(0, Math.max(MAX_BULK_RECIPIENTS - processedRecipients, 0));
        for (let i = 0; i < capped.length; i += SEND_CONCURRENCY) {
          const chunk = capped.slice(i, i + SEND_CONCURRENCY);
          await sendChunk(chunk);
        }
        processedRecipients += capped.length;

        lastVisible = nextCursor;
        hasMore = !!nextCursor;
      }
    } else {
      const html = buildAnnouncementEmailHtml(siteName, 'Member', to, subject, message, type);
      const { error } = await resendClient.emails.send({
        from: buildFromField(siteName, fromAddress),
        to: [to],
        subject,
        html,
        text: message,
        ...(replyToAddress ? { replyTo: replyToAddress } : {}),
      });
      if (error) {
        logger.error('[Email Service] Provider error for single send', { error, recipientEmail: to });
        return { error: error.message || 'Email delivery failed.', sentCount: 0, failedCount: 1 };
      }
      totalSent = 1;
    }

    // Audit log for any bulk send, including partial failures
    if (totalSent > 0 || totalFailed > 0) {
      await logServerAuditAction({
        actorId: actorId || 'system',
        actorName: actorId || 'System Action',
        action: 'send-bulk-email',
        targetId: subject,
        targetType: 'setting',
        severity: totalFailed > 0 ? 'warn' : 'info',
        details: JSON.stringify({ recipientFilter: to, sentCount: totalSent, failedCount: totalFailed, subject }),
      });
    }

    return { success: true, count: totalSent, sentCount: totalSent, failedCount: totalFailed };
  } catch (error: any) {
    logger.error('[Email Service] Execution Error', { error: error.message });
    return { error: error.message || 'Unknown email system error' };
  }
}

// ─── Transactional emails (welcome, enrollment, approval/rejection) ───────────

export async function sendTransactionalEmail(params: {
  type: 'welcome' | 'enrollment' | 'courseApproval' | 'courseRejection' | 'liveSession' | 'adminEnrollment' | 'freeEnrollment' | 'emailVerified';
  to: string;
  recipientName: string;
  items?: string;
  orderId?: string;
  amount?: number;
  courseTitle?: string;
  courseId?: string;
  // liveSession extras
  sessionTitle?: string;
  instructor?: string;
  startTime?: string;    // ISO string
  durationMinutes?: number;
  /** Trusted server-to-server calls (webhooks, server actions) pass the internal secret directly */
  internalSecret?: string;
  /** User-initiated calls (admin UI) pass the caller's Firebase idToken instead */
  callerIdToken?: string;
}): Promise<{ success?: boolean; error?: string }> {
  // SECURITY: Verify caller identity — either a trusted internal secret or a privileged user token
  const INTERNAL_SECRET = process.env.INTERNAL_EMAIL_SECRET;
  const isSystemCall = !!(params.internalSecret && INTERNAL_SECRET && params.internalSecret === INTERNAL_SECRET);

  if (!isSystemCall) {
    if (params.callerIdToken) {
      try {
        const { adminAuth: auth, adminDb: aDb } = await import('@/firebase/admin');
        const decoded = await auth.verifyIdToken(params.callerIdToken);
        const userDoc = await aDb.doc(`users/${decoded.uid}`).get();
        const role = userDoc.exists ? userDoc.data()!.role : null;
        const callerEmail = normalizeEmail(decoded.email || '');
        const targetEmail = normalizeEmail(params.to);
        const isSelfWelcome = params.type === 'welcome' && callerEmail && targetEmail && callerEmail === targetEmail;
        if (!['admin', 'superadmin', 'subadmin'].includes(role) && !isSelfWelcome) {
          logger.warn('[Email Service] sendTransactionalEmail: caller lacks privileges', { uid: decoded.uid, role });
          return { error: 'You are not authorized to send transactional emails.' };
        }
      } catch (authErr: any) {
        logger.warn('[Email Service] sendTransactionalEmail: token verification failed', { error: authErr?.message });
        return { error: 'Authentication failed. Please sign in again.' };
      }
    } else {
      logger.warn('[Email Service] sendTransactionalEmail called without valid auth');
      return { error: 'Authentication required to send transactional emails.' };
    }
  }

  let apiKey: string;
  try {
    apiKey = await getResendApiKey();
  } catch (error: any) {
    return { error: error.message };
  }

  const resendClient = new Resend(apiKey);
  const settings = await getGlobalSettings();
  const { from: fromAddress } = resolveSenderAddress(settings.contactEmail);
  const siteName = settings.siteName || 'Profs Training Solutions';

  let subject = '';
  let html = '';
  let text = '';

  switch (params.type) {
    case 'welcome':
      subject = `Welcome to ${siteName}, ${params.recipientName}!`;
      html = buildWelcomeEmailHtml(siteName, params.recipientName, params.to);
      text = `Welcome to ${siteName}, ${params.recipientName}! Your account is ready. Log in to get started.`;
      break;

    case 'enrollment':
      subject = `Order Confirmed: #${params.orderId}`;
      html = buildEnrollmentConfirmationHtml(
        siteName,
        params.recipientName,
        params.to,
        params.items || 'Learning Materials',
        params.orderId || 'N/A',
        params.amount || 0
      );
      text = `Hi ${params.recipientName}, your payment of GH₵${(params.amount || 0).toFixed(2)} was successful. Items: ${params.items}. Order ID: #${params.orderId}.`;
      break;

    case 'courseApproval':
      subject = `Your course "${params.courseTitle}" is now live!`;
      html = buildCourseApprovalEmailHtml(siteName, params.recipientName, params.to, params.courseTitle || 'Your Course', params.courseId || '');
      text = `Hi ${params.recipientName}, your course "${params.courseTitle}" has been approved and published.`;
      break;

    case 'courseRejection':
      subject = `Action needed: Your course "${params.courseTitle}" needs revision`;
      html = buildCourseRejectionEmailHtml(siteName, params.recipientName, params.to, params.courseTitle || 'Your Course', params.courseId || '');
      text = `Hi ${params.recipientName}, your course "${params.courseTitle}" requires changes before it can be published.`;
      break;

    case 'liveSession':
      subject = `New Live Class Scheduled: ${params.sessionTitle || params.courseTitle || 'Upcoming Session'}`;
      html = buildLiveSessionEmailHtml(
        siteName,
        params.recipientName,
        params.to,
        params.courseTitle || 'Your Course',
        params.sessionTitle || 'Live Session',
        params.instructor || 'Your Instructor',
        params.startTime || new Date().toISOString(),
        params.durationMinutes || 60,
      );
      text = `Hi ${params.recipientName}, a new live session "${params.sessionTitle}" has been scheduled for ${params.courseTitle}. Instructor: ${params.instructor}. Start time: ${params.startTime}.`;
      break;

    case 'adminEnrollment':
      subject = `You've been enrolled in "${params.courseTitle}" on ${siteName}`;
      html = buildAdminEnrollmentEmailHtml(
        siteName,
        params.recipientName,
        params.to,
        params.courseTitle || 'Your Course',
        params.courseId || '',
      );
      text = `Hi ${params.recipientName}, an administrator has enrolled you in "${params.courseTitle}". Head to your dashboard to start learning.`;
      break;

    case 'freeEnrollment':
      subject = `Enrollment Confirmed: "${params.courseTitle}" is ready to start`;
      html = buildFreeEnrollmentEmailHtml(
        siteName,
        params.recipientName,
        params.to,
        params.courseTitle || 'Your Course',
        params.courseId || '',
      );
      text = `Hi ${params.recipientName}, you've been enrolled in the free course "${params.courseTitle}". Start learning now from your dashboard.`;
      break;

    case 'emailVerified':
      subject = `Your ${siteName} account is verified`;
      html = buildEmailVerifiedSuccessHtml(siteName, params.recipientName, params.to);
      text = `Hi ${params.recipientName}, your email has been verified successfully. Your account is now fully active.`;
      break;
  }

  try {
    const { error } = await resendClient.emails.send({
      from: buildFromField(siteName, fromAddress),
      to: [params.to],
      subject,
      html,
      text,
    });

    if (error) {
      logger.error('[Email Service] Transactional email failed', { type: params.type, to: params.to, error });
      // Write audit log so admin can see delivery failures
      await logServerAuditAction({
        actorId: 'system',
        actorName: 'System',
        action: 'transactional-email-failed',
        targetId: params.to,
        targetType: 'user',
        severity: 'warn',
        details: JSON.stringify({ type: params.type, error: error.message }),
      }).catch(() => {});
      return { error: error.message || 'Email delivery failed.' };
    }

    logger.info('[Email Service] Transactional email sent', { type: params.type, to: params.to });
    return { success: true };
  } catch (error: any) {
    logger.error('[Email Service] Transactional email exception', { error: error.message });
    await logServerAuditAction({
      actorId: 'system',
      actorName: 'System',
      action: 'transactional-email-exception',
      targetId: params.to,
      targetType: 'user',
      severity: 'warn',
      details: JSON.stringify({ type: params.type, error: error.message }),
    }).catch(() => {});
    return { error: error.message || 'Unknown email error' };
  }
}

// ─── Test email for admin health check ───────────────────────────────────────

export async function sendTestEmail(
  idToken: string,
  recipientEmail?: string,
): Promise<{ success?: boolean; error?: string; sentTo?: string }> {
  try {
    const { adminAuth } = await import('@/firebase/admin');
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.email) return { error: 'No email associated with your account.' };

    // Enforce admin-only access server-side
    const { adminDb: aDb } = await import('@/firebase/admin');
    const callerDoc = await aDb.doc(`users/${decoded.uid}`).get();
    const callerRole = callerDoc.exists ? callerDoc.data()!.role : null;
    if (!['admin', 'superadmin', 'subadmin'].includes(callerRole)) {
      return { error: 'You are not authorized to send test emails.' };
    }

    // Use the custom recipient if provided and valid, otherwise fall back to the caller's email.
    const toAddress = normalizeEmail(recipientEmail) || decoded.email;

    let apiKey: string;
    try {
      apiKey = await getResendApiKey();
    } catch (error: any) {
      return { error: error.message };
    }

    const resendClient = new Resend(apiKey);
    const settings = await getGlobalSettings();
    const { from: fromAddress } = resolveSenderAddress(settings.contactEmail);
    const siteName = settings.siteName || 'Profs Training Solutions';

    const html = buildAnnouncementEmailHtml(
      siteName,
      'Admin',
      toAddress,
      `Test Email — ${siteName} Email System`,
      `This is a test email confirming your email configuration is working correctly.\n\nResend API key: ✓ Configured\nSender address: ${fromAddress}\nTimestamp: ${new Date().toISOString()}`,
      'Info'
    );

    const fromField = buildFromField(siteName, fromAddress);

    const { error } = await resendClient.emails.send({
      from: fromField,
      to: [toAddress],
      subject: `[Test] ${siteName} Email System Check`,
      html,
      text: `This is a test email from ${siteName}. If you received this, your email configuration is working correctly.`,
    });

    if (error) {
      return { error: error.message || 'Test email delivery failed.' };
    }

    return { success: true, sentTo: toAddress };
  } catch (error: any) {
    return { error: error.message || 'Failed to send test email.' };
  }
}

// ─── Email provider status ────────────────────────────────────────────────────

export async function getEmailProviderStatus() {
  const resendConfigured = typeof process.env.RESEND_API_KEY === 'string' && process.env.RESEND_API_KEY.trim().length > 0;
  const internalSecretConfigured = typeof process.env.INTERNAL_EMAIL_SECRET === 'string' && process.env.INTERNAL_EMAIL_SECRET.trim().length > 0;
  const rawDomain = (process.env.APP_EMAIL_DOMAIN || DEFAULT_EMAIL_DOMAIN).trim().toLowerCase();
  const allowedDomain = rawDomain.includes('@') ? rawDomain.split('@').pop()! : rawDomain;
  const senderAddress = normalizeEmail(process.env.APP_EMAIL_FROM) || `no-reply@${allowedDomain}`;

  // True only when the operator has explicitly configured a custom sender address/domain,
  // not when we're falling back to the built-in test domain.
  const senderDomainConfigured =
    (typeof process.env.APP_EMAIL_FROM === 'string' && process.env.APP_EMAIL_FROM.trim().length > 0) ||
    (typeof process.env.APP_EMAIL_DOMAIN === 'string' && process.env.APP_EMAIL_DOMAIN.trim().length > 0);

  return {
    provider: 'resend',
    configured: resendConfigured,
    internalSecretConfigured,
    senderDomain: allowedDomain,
    senderAddress,
    senderDomainConfigured,
  };
}
