'use server';

import { adminDb, FieldValue } from '@/firebase/admin';
import { logger } from '@/lib/logging';
import { v4 as uuidv4 } from 'uuid';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  type?: string;
}

interface RetryableEmail {
  id: string;
  payload: EmailPayload;
  attempts: number;
  maxAttempts: number;
  lastAttempt?: string;
  error?: string;
  createdAt: string;
}

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [5000, 15000, 45000];
const MAX_QUEUED = 50;

function generateEmailId(): string {
  return `email-${Date.now()}-${uuidv4().slice(0, 8)}`;
}

export async function queueEmailForRetry(
  payload: EmailPayload,
  error: string
): Promise<{ queued: boolean; id?: string }> {
  try {
    const countSnapshot = await adminDb
      .collection('emailQueue')
      .count()
      .get();
    const count = countSnapshot.data().count || 0;

    if (count >= MAX_QUEUED) {
      logger.warn('[EmailRetry] Queue full, rejecting email', {
        to: payload.to,
        queueSize: count,
      });
      return { queued: false };
    }

    const id = generateEmailId();
    await adminDb.doc(`emailQueue/${id}`).set({
      id,
      payload,
      attempts: 0,
      maxAttempts: MAX_RETRY_ATTEMPTS,
      error,
      createdAt: new Date().toISOString(),
      status: 'pending',
    });

    logger.info('[EmailRetry] Email queued for retry', {
      id,
      to: payload.to,
    });

    return { queued: true, id };
  } catch (err) {
    logger.error('[EmailRetry] Failed to queue email', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { queued: false };
  }
}

async function sendEmailInternal(
  payload: EmailPayload,
  from: string,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function processEmailQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
  rescheduled: number;
}> {
  const result = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    rescheduled: 0,
  };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.APP_EMAIL_FROM;

  if (!apiKey || !from) {
    logger.error('[EmailRetry] Missing Resend configuration');
    return result;
  }

  try {
    const snapshot = await adminDb
      .collection('emailQueue')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'asc')
      .limit(10)
      .get();

    if (snapshot.empty) {
      return result;
    }

    for (const doc of snapshot.docs) {
      const email = doc.data() as RetryableEmail;
      const delayIndex = email.attempts;
      
      if (delayIndex > 0) {
        const timeSinceLastAttempt = Date.now() - new Date(email.lastAttempt || 0).getTime();
        const requiredDelay = RETRY_DELAYS[delayIndex - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        
        if (timeSinceLastAttempt < requiredDelay) {
          continue;
        }
      }

      result.processed++;
      const sendResult = await sendEmailInternal(email.payload, from, apiKey);

      if (sendResult.success) {
        await doc.ref.update({
          status: 'completed',
          completedAt: new Date().toISOString(),
        });
        result.succeeded++;
      } else {
        const newAttempts = email.attempts + 1;
        
        if (newAttempts >= email.maxAttempts) {
          await doc.ref.update({
            status: 'failed',
            error: sendResult.error,
            failedAt: new Date().toISOString(),
          });
          result.failed++;
        } else {
          await doc.ref.update({
            attempts: newAttempts,
            lastAttempt: new Date().toISOString(),
            error: sendResult.error,
            status: 'pending',
          });
          result.rescheduled++;
        }
      }
    }

    logger.info('[EmailRetry] Queue processing completed', result);
  } catch (err) {
    logger.error('[EmailRetry] Queue processing failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

class EmailRetryScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly intervalMs = 30000;
  private readonly enabled: boolean;

  constructor() {
    this.enabled = process.env.ENABLE_EMAIL_RETRY === 'true';
  }

  async start(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    logger.info('[EmailRetryScheduler] Starting email retry scheduler');

    await processEmailQueue();

    this.intervalId = setInterval(async () => {
      try {
        await processEmailQueue();
      } catch (error) {
        logger.error('[EmailRetryScheduler] Error', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('[EmailRetryScheduler] Stopped');
    }
  }
}

export const emailRetryScheduler = new EmailRetryScheduler();