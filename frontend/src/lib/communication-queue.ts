import { adminDb } from '@/firebase/admin';
import { dispatchCommunication } from '@/lib/communications';
import { logger } from '@/lib/logging';

async function claimQueueJob(docId: string): Promise<boolean> {
  const ref = adminDb.doc(`communicationQueue/${docId}`);
  try {
    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      const status = snap.data()?.status;
      if (status !== 'pending') return false;
      tx.update(ref, {
        status: 'processing',
        updatedAt: new Date().toISOString(),
      });
      return true;
    });
  } catch (error: any) {
    logger.warn('[CommunicationQueue] Failed to claim job', { docId, error: error?.message });
    return false;
  }
}

export async function processDueCommunicationQueue(limit = 100): Promise<{ processed: number; skipped: number }> {
  const nowIso = new Date().toISOString();
  const snap = await adminDb
    .collection('communicationQueue')
    .where('status', '==', 'pending')
    .where('sendAt', '<=', nowIso)
    .limit(limit)
    .get();

  let processed = 0;
  let skipped = 0;
  for (const doc of snap.docs) {
    const claimed = await claimQueueJob(doc.id);
    if (!claimed) {
      skipped += 1;
      continue;
    }

    const data = doc.data() as {
      userId?: string;
      channel?: 'sms' | 'whatsapp' | 'email' | 'inapp';
      phoneNumber?: string;
      email?: string;
      message?: string;
      metadata?: Record<string, unknown>;
      retryCount?: number;
    };

    if (!data.userId || !data.message) {
      await doc.ref.update({ status: 'failed', error: 'Missing userId or message', updatedAt: nowIso });
      processed += 1;
      continue;
    }

    try {
      await dispatchCommunication({
        eventKey: (data.metadata?.eventKey as any) || 'live_class_reminder',
        userId: data.userId,
        channels: data.channel ? [data.channel] : undefined,
        phoneNumber: data.phoneNumber,
        email: data.email,
        message: data.message,
        title: 'Live class reminder',
        metadata: data.metadata || {},
        retryCount: Number(data.retryCount || 0),
      });
      await doc.ref.update({ status: 'processed', processedAt: nowIso, updatedAt: nowIso });
      processed += 1;
    } catch (error: any) {
      logger.error('[CommunicationQueue] Failed processing job', { id: doc.id, error: error?.message });
      await doc.ref.update({ status: 'failed', error: error?.message || 'Queue processing error', updatedAt: nowIso });
      processed += 1;
    }
  }

  return { processed, skipped };
}
