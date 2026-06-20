'use server';

import { adminDb, FieldValue } from '@/firebase/admin';
import { logger } from '@/lib/logging';

const PAYMENT_INTENT_TTL_HOURS = 24;
const MAX_INTENTS_TO_CLEANUP = 100;

interface CleanupResult {
  deleted: number;
  failed: number;
  errors: string[];
}

export async function cleanupStalePaymentIntents(): Promise<CleanupResult> {
  const result: CleanupResult = {
    deleted: 0,
    failed: 0,
    errors: [],
  };

  try {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - PAYMENT_INTENT_TTL_HOURS);
    const cutoffIso = cutoffTime.toISOString();

    logger.info('[Cleanup] Starting stale payment intent cleanup', {
      cutoffTime: cutoffIso,
      maxToDelete: MAX_INTENTS_TO_CLEANUP,
    });

    const intentsRef = adminDb.collection('paymentIntents');
    const staleIntentsQuery = intentsRef
      .where('status', 'in', ['initialized', 'failed'])
      .where('createdAt', '<', cutoffIso)
      .limit(MAX_INTENTS_TO_CLEANUP);

    const snapshot = await staleIntentsQuery.get();

    if (snapshot.empty) {
      logger.info('[Cleanup] No stale payment intents found');
      return result;
    }

    const batch = adminDb.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      if (data.status === 'fulfilled' || data.status === 'completed') {
        continue;
      }

      batch.delete(doc.ref);
      batchCount++;

      if (batchCount >= 499) {
        await batch.commit();
        result.deleted += batchCount;
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      result.deleted += batchCount;
    }

    logger.info('[Cleanup] Stale payment intent cleanup completed', {
      deleted: result.deleted,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[Cleanup] Failed to clean up stale payment intents', {
      error: errorMsg,
    });
    result.errors.push(errorMsg);
    result.failed = 1;
  }

  return result;
}

export async function getPaymentIntentStats(): Promise<{
  total: number;
  initialized: number;
  fulfilled: number;
  failed: number;
}> {
  const stats = {
    total: 0,
    initialized: 0,
    fulfilled: 0,
    failed: 0,
  };

  try {
    const snapshot = await adminDb.collection('paymentIntents').get();
    stats.total = snapshot.size;

    for (const doc of snapshot.docs) {
      const status = doc.data().status;
      if (status === 'initialized') stats.initialized++;
      else if (status === 'fulfilled') stats.fulfilled++;
      else if (status === 'failed') stats.failed++;
    }
  } catch (error) {
    logger.error('[Cleanup] Failed to get payment intent stats', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return stats;
}

export class ScheduledCleanup {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private readonly enabled: boolean;

  constructor(intervalHours = 6) {
    this.intervalMs = intervalHours * 60 * 60 * 1000;
    this.enabled = process.env.ENABLE_SCHEDULED_CLEANUP === 'true';
  }

  async start(): Promise<void> {
    if (!this.enabled) {
      logger.info('[ScheduledCleanup] Cleanup disabled via ENABLE_SCHEDULED_CLEANUP');
      return;
    }

    logger.info('[ScheduledCleanup] Starting scheduled cleanup', {
      intervalHours: this.intervalMs / (60 * 60 * 1000),
    });

    await cleanupStalePaymentIntents();

    this.intervalId = setInterval(async () => {
      try {
        await cleanupStalePaymentIntents();
      } catch (error) {
        logger.error('[ScheduledCleanup] Cleanup failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('[ScheduledCleanup] Stopped');
    }
  }
}

export const cleanup = new ScheduledCleanup(6);