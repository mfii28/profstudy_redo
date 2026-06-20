'use server';

import { z } from 'zod';
import { adminAuth, adminDb } from '@/firebase/admin';
import { logger } from '@/lib/logging';
import { dispatchCommunication, logDispatchFailure } from '@/lib/communications';

const BroadcastAnnouncementSchema = z.object({
  idToken: z.string().min(1, 'Authentication token is required.'),
  title: z.string().min(1, 'Title is required.').max(120),
  message: z.string().min(1, 'Message is required.').max(2000),
  type: z.enum(['Info', 'Warning', 'Promotion']).default('Info'),
  audience: z.enum(['all', 'students', 'tutors', 'specific']).default('all'),
  targetUserId: z.string().optional(),
});

type BroadcastAnnouncementInput = z.infer<typeof BroadcastAnnouncementSchema>;
const AUDIENCE_PAGE_SIZE = 500;
const MAX_NOTIFICATIONS_PER_BROADCAST = 20000;

function mapAnnouncementTypeToCategory(type: BroadcastAnnouncementInput['type']) {
  switch (type) {
    case 'Warning':
      return 'alert';
    case 'Promotion':
      return 'success';
    default:
      return 'info';
  }
}

function shouldReceiveAnnouncements(userData: any): boolean {
  const prefs = userData?.preferences;
  if (!prefs || typeof prefs !== 'object') return true;
  return prefs.notifCourseAnnouncements !== false;
}

async function verifyAdminCaller(idToken: string) {
  const decoded = await adminAuth.verifyIdToken(idToken);
  const callerDoc = await adminDb.doc(`users/${decoded.uid}`).get();
  const role = callerDoc.exists ? callerDoc.data()?.role : null;
  const isAllowed = ['admin', 'superadmin', 'subadmin'].includes(role);
  if (!isAllowed) {
    throw new Error('Unauthorized.');
  }
  return decoded.uid;
}

export async function broadcastAnnouncementNotification(input: BroadcastAnnouncementInput) {
  const parsed = BroadcastAnnouncementSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues.map((issue) => issue.message).join(', ') };
  }

  const { idToken, title, message, type, audience, targetUserId } = parsed.data;

  try {
    const actorUid = await verifyAdminCaller(idToken);

    const usersCollection = adminDb.collection('users');
    if (audience === 'specific') {
      if (!targetUserId) {
        return { error: 'Please select a target user.' };
      }
      const userDoc = await usersCollection.doc(targetUserId).get();
      if (!userDoc.exists) {
        return { error: 'Target user not found.' };
      }
      const userData = userDoc.data();
      if (!shouldReceiveAnnouncements(userData)) {
        return { success: true, notifiedCount: 0 };
      }

      const notifRef = adminDb.collection('notifications').doc();
      await notifRef.set({
        userId: userDoc.id,
        title,
        description: message.length > 280 ? `${message.substring(0, 280)}...` : message,
        time: new Date().toISOString(),
        read: false,
        category: mapAnnouncementTypeToCategory(type),
      });

      dispatchCommunication({
        eventKey: 'broadcast',
        userId: userDoc.id,
        message,
        title,
        phoneNumber: userData?.phone_number,
        email: userData?.email,
        metadata: {
          message,
          user_name: userData?.name || 'Member',
          audience: 'specific',
          announcementType: type,
        },
      }).catch((error) =>
        logDispatchFailure('broadcast-single', error, { userId: userDoc.id, eventKey: 'broadcast' })
      );

      return { success: true, notifiedCount: 1 };
    }

    const now = new Date().toISOString();
    const category = mapAnnouncementTypeToCategory(type);

    let notifiedCount = 0;
    let batch = adminDb.batch();
    let batchOps = 0;

    const rolesToProcess: Array<'student' | 'tutor'> =
      audience === 'all' ? ['student', 'tutor'] : [audience === 'students' ? 'student' : 'tutor'];

    for (const role of rolesToProcess) {
      let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

      while (notifiedCount < MAX_NOTIFICATIONS_PER_BROADCAST) {
        let q = usersCollection.where('role', '==', role).orderBy('__name__').limit(AUDIENCE_PAGE_SIZE);
        if (cursor) {
          q = q.startAfter(cursor) as typeof q;
        }

        const page = await q.get();
        if (page.empty) break;

        for (const userDoc of page.docs) {
          const userData = userDoc.data();
          if (!shouldReceiveAnnouncements(userData)) continue;

          const notifRef = adminDb.collection('notifications').doc();
          batch.set(notifRef, {
            userId: userDoc.id,
            title,
            description: message.length > 280 ? `${message.substring(0, 280)}...` : message,
            time: now,
            read: false,
            category,
          });

          dispatchCommunication({
            eventKey: 'broadcast',
            userId: userDoc.id,
            message,
            title,
            phoneNumber: userData?.phone_number,
            email: userData?.email,
            metadata: {
              message,
              user_name: userData?.name || 'Member',
              audience,
              announcementType: type,
            },
          }).catch((error) =>
            logDispatchFailure('broadcast-batch', error, { userId: userDoc.id, eventKey: 'broadcast' })
          );

          notifiedCount++;
          batchOps++;

          if (batchOps >= 450) {
            await batch.commit();
            batch = adminDb.batch();
            batchOps = 0;
          }

          if (notifiedCount >= MAX_NOTIFICATIONS_PER_BROADCAST) break;
        }

        cursor = page.docs[page.docs.length - 1] || null;
        if (page.docs.length < AUDIENCE_PAGE_SIZE) break;
      }

      if (notifiedCount >= MAX_NOTIFICATIONS_PER_BROADCAST) break;
    }

    if (batchOps > 0) {
      await batch.commit();
    }

    logger.info('[Announcement Notification] Broadcast sent', {
      actorUid,
      audience,
      notifiedCount,
      type,
    });

    return { success: true, notifiedCount };
  } catch (error: any) {
    logger.error('[Announcement Notification] Broadcast failed', {
      audience,
      errorMessage: error?.message,
    });
    return { error: error?.message || 'Failed to broadcast notifications.' };
  }
}
