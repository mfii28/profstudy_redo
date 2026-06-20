'use server';

import { z } from 'zod';
import { logger } from '@/lib/logging';
import { adminAuth, adminDb } from '@/firebase/admin';
import type { Enrollment, LiveClass, User } from '@/lib/db';
import { sendTransactionalEmail } from '@/app/actions/email';
import { dispatchCommunication } from '@/lib/communications';

/**
 * @fileOverview Secure Live Session Service.
 *
 * Flow:
 *  1. Tutor creates an external Zoom meeting on zoom.us and copies the join URL.
 *  2. Tutor pastes the URL here → `createLiveSession` stores metadata in `liveClasses`
 *     and stores the private Zoom URL in `liveClassUrls` (admin-SDK-only accessible).
 *  3. Enrolled student clicks "Join" → `getZoomJoinUrl` verifies enrollment via admin SDK
 *     and returns the URL. The client opens it in a new tab.
 *  4. The raw Zoom URL is NEVER stored in a client-readable Firestore document.
 */

// ─── Validation ────────────────────────────────────────────────────────────────

const idTokenSchema = z.string().min(1, 'ID token required');
const sessionIdSchema = z.string().min(1, 'Session ID required').max(200);
const createLiveSessionInputSchema = z.object({
  title: z.string().min(1, 'Session title is required').max(200, 'Session title too long'),
  courseId: z.string().optional(),
  zoomUrl: z.string().optional(),
  startTime: z.string().min(1, 'Start time is required'),
  durationMinutes: z.number().int().min(15).max(300).optional(),
});
const zoomUrlSchema = z
  .string()
  .url('Must be a valid URL')
  .max(2000, 'URL too long')
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        // Accept zoom.us, zoom.com and custom vanity domains that Zoom allows
        return (
          parsed.hostname.endsWith('.zoom.us') ||
          parsed.hostname === 'zoom.us' ||
          parsed.hostname.endsWith('.zoom.com') ||
          parsed.hostname === 'zoom.com'
        );
      } catch {
        return false;
      }
    },
    { message: 'Must be a valid Zoom meeting URL (zoom.us or zoom.com)' }
  );

// ─── createLiveSession ─────────────────────────────────────────────────────────

export interface CreateLiveSessionInput {
  title: string;
  courseId?: string;
  zoomUrl?: string;
  startTime: string; // ISO string
  durationMinutes?: number;
}

/**
 * Creates a live session entry. The Zoom URL is stored in a private collection
 * (`liveClassUrls`) that is inaccessible to Firestore clients.
 * SECURITY: Only tutors (own session) or admins can create.
 */
export async function createLiveSession(
  idToken: string,
  data: CreateLiveSessionInput
): Promise<{ id: string } | { error: string }> {
  const tokenCheck = idTokenSchema.safeParse(idToken);
  if (!tokenCheck.success) return { error: 'Authentication required.' };

  const inputCheck = createLiveSessionInputSchema.safeParse(data);
  if (!inputCheck.success) {
    return { error: inputCheck.error.issues[0]?.message ?? 'Invalid session data.' };
  }

  const normalizedStartTime = new Date(inputCheck.data.startTime);
  if (Number.isNaN(normalizedStartTime.getTime())) {
    return { error: 'Invalid start time.' };
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch {
    return { error: 'Session expired. Please sign in again.' };
  }

  try {
    const callerSnap = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!callerSnap.exists) return { error: 'User profile not found.' };

    const caller = callerSnap.data() as User;
    const isAdmin = caller.role === 'admin' || caller.role === 'superadmin' || caller.role === 'subadmin';
    const isTutor = caller.role === 'tutor';

    if (!isAdmin && !isTutor) {
      return { error: 'Only tutors and admins can create live sessions.' };
    }

    const sessionId = `live-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();
    const durationMinutes = inputCheck.data.durationMinutes || 60;
    const manualZoomUrl = (inputCheck.data.zoomUrl || '').trim();
    if (!manualZoomUrl) {
      return { error: 'Manual Zoom meeting URL is required.' };
    }
    const urlCheck = zoomUrlSchema.safeParse(manualZoomUrl);
    if (!urlCheck.success) {
      return { error: urlCheck.error.issues[0]?.message ?? 'Invalid Zoom URL.' };
    }
    const resolvedZoomUrl = urlCheck.data;

    const normalizedCourseId = (inputCheck.data.courseId || '').trim();
    const sessionMeta: Omit<LiveClass, 'id'> = {
      title: inputCheck.data.title.trim().substring(0, 200),
      instructor: caller.name || decodedToken.name || 'Instructor',
      instructorId: decodedToken.uid,
      startTime: normalizedStartTime.toISOString(),
      durationMinutes,
      status: 'upcoming',
      ...(normalizedCourseId ? { courseId: normalizedCourseId } : {}),
    };

    const batch = adminDb.batch();

    // Public metadata — no zoom URL
    batch.set(adminDb.collection('liveClasses').doc(sessionId), {
      ...sessionMeta,
      id: sessionId,
      createdAt: now,
    });

    // Private URL — inaccessible to Firestore clients (rule: allow read, write: if false)
    batch.set(adminDb.collection('liveClassUrls').doc(sessionId), {
      zoomUrl: resolvedZoomUrl,
      instructorId: decodedToken.uid,
      createdAt: now,
    });

    await batch.commit();
    logger.info('[LiveSession] Created', { sessionId, instructorId: decodedToken.uid });

    // Fire-and-forget: notify enrolled students of new live session
    if (normalizedCourseId) {
      notifyEnrolledStudentsOfLiveSession({
        courseId: normalizedCourseId,
        courseTitle: normalizedCourseId,   // will be resolved inside helper
        sessionTitle: sessionMeta.title,
        instructor: sessionMeta.instructor,
        startTime: sessionMeta.startTime,
        durationMinutes: sessionMeta.durationMinutes ?? 60,
      }).catch((err) => logger.warn('[LiveSession] Enrollment notification failed', { error: err?.message }));
    }

    return { id: sessionId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[LiveSession] Creation failed', { error: message });
    return { error: 'Failed to create session. Please try again.' };
  }
}

// ─── getZoomJoinUrl ────────────────────────────────────────────────────────────

/**
 * Returns the private Zoom URL for a session only after verifying:
 *  - The caller is authenticated.
 *  - The caller is the session's instructor, an admin, OR an enrolled student.
 * SECURITY: The URL is NEVER sent to the client via Firestore; only through this action.
 */
export async function getZoomJoinUrl(
  idToken: string,
  sessionId: string
): Promise<{ url: string; title: string } | { error: string }> {
  const tokenCheck = idTokenSchema.safeParse(idToken);
  if (!tokenCheck.success) return { error: 'Authentication required.' };

  const sessionIdCheck = sessionIdSchema.safeParse(sessionId);
  if (!sessionIdCheck.success) return { error: 'Invalid session ID.' };

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch {
    return { error: 'Session expired. Please sign in again.' };
  }

  try {
    // Fetch session metadata and private URL in parallel
    const [sessionSnap, urlSnap, userSnap] = await Promise.all([
      adminDb.collection('liveClasses').doc(sessionId).get(),
      adminDb.collection('liveClassUrls').doc(sessionId).get(),
      adminDb.collection('users').doc(decodedToken.uid).get(),
    ]);

    if (!sessionSnap.exists || !urlSnap.exists) {
      return { error: 'Live session not found or has been removed.' };
    }

    if (!userSnap.exists) {
      return { error: 'User profile not found.' };
    }

    const session = sessionSnap.data() as LiveClass & { id: string };
    const urlData = urlSnap.data() as { zoomUrl?: string };
    const user = userSnap.data() as User;

    const validZoomUrl = zoomUrlSchema.safeParse(urlData.zoomUrl);
    if (!validZoomUrl.success) {
      return { error: 'Session link is invalid or missing.' };
    }

    const isAdmin =
      user.role === 'admin' || user.role === 'superadmin' || user.role === 'subadmin';
    const isInstructor = session.instructorId === decodedToken.uid;

    if (isAdmin || isInstructor) {
      return { url: validZoomUrl.data, title: session.title };
    }

    // Student: must be enrolled in the session's course
    if (user.role === 'student') {
      const enrollments: Enrollment[] = user.enrollments || [];

      if (!session.courseId) {
        // Global session (no courseId) — any authenticated student can join
        return { url: validZoomUrl.data, title: session.title };
      }

      const isEnrolled = enrollments.some((e) => e.courseId === session.courseId);
      if (!isEnrolled) {
        return { error: 'You are not enrolled in the course this session belongs to.' };
      }

      return { url: validZoomUrl.data, title: session.title };
    }

    return { error: 'You do not have permission to join this session.' };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[LiveSession] getZoomJoinUrl failed', { sessionId, userId: decodedToken.uid, error: message });
    return { error: 'Unable to verify your session access right now. Please try again.' };
  }
}

// ─── deleteLiveSession ─────────────────────────────────────────────────────────

/**
 * Deletes both the public metadata and the private URL documents atomically.
 * SECURITY: Only the instructor or an admin can delete.
 */
export async function deleteLiveSession(
  idToken: string,
  sessionId: string
): Promise<{ success: boolean } | { error: string }> {
  const tokenCheck = idTokenSchema.safeParse(idToken);
  if (!tokenCheck.success) return { error: 'Authentication required.' };

  const sessionIdCheck = sessionIdSchema.safeParse(sessionId);
  if (!sessionIdCheck.success) return { error: 'Invalid session ID.' };

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch {
    return { error: 'Session expired. Please sign in again.' };
  }

  try {
    const [sessionSnap, userSnap] = await Promise.all([
      adminDb.collection('liveClasses').doc(sessionId).get(),
      adminDb.collection('users').doc(decodedToken.uid).get(),
    ]);

    if (!sessionSnap.exists) return { error: 'Session not found.' };
    if (!userSnap.exists) return { error: 'User not found.' };

    const session = sessionSnap.data() as LiveClass;
    const user = userSnap.data() as User;
    const isAdmin =
      user.role === 'admin' || user.role === 'superadmin' || user.role === 'subadmin';

    if (!isAdmin && session.instructorId !== decodedToken.uid) {
      return { error: 'You do not have permission to delete this session.' };
    }

    const batch = adminDb.batch();
    batch.delete(adminDb.collection('liveClasses').doc(sessionId));
    batch.delete(adminDb.collection('liveClassUrls').doc(sessionId));

    await batch.commit();
    logger.info('[LiveSession] Deleted', { sessionId });
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[LiveSession] Delete failed', { error: message, sessionId, userId: decodedToken.uid });
    return { error: 'Failed to delete session.' };
  }
}

// ─── notifyEnrolledStudentsOfLiveSession ──────────────────────────────────────

interface LiveSessionNotificationInput {
  courseId: string;
  courseTitle: string;   // Pass the courseId here; the helper will resolve the title
  sessionTitle: string;
  instructor: string;
  startTime: string;
  durationMinutes: number;
}

async function queueLiveClassReminder(
  userId: string,
  phoneNumber: string | undefined,
  message: string,
  sendAt: Date,
  metadata: Record<string, unknown>
) {
  const queueId = `commq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await adminDb.doc(`communicationQueue/${queueId}`).set({
    id: queueId,
    type: 'live_class_reminder',
    userId,
    phoneNumber: phoneNumber || null,
    message,
    metadata,
    sendAt: sendAt.toISOString(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
}

async function notifyEnrolledStudentsOfLiveSession(input: LiveSessionNotificationInput): Promise<void> {
  const INTERNAL_SECRET = process.env.INTERNAL_EMAIL_SECRET;
  if (!INTERNAL_SECRET) {
    logger.warn('[LiveSession] INTERNAL_EMAIL_SECRET not set, skipping student notifications');
    return;
  }

  // Resolve course title
  const courseSnap = await adminDb.collection('courses').doc(input.courseId).get();
  const courseTitle: string = courseSnap.exists
    ? (courseSnap.data() as { title?: string }).title || input.courseId
    : input.courseId;

  // Query users enrolled in this course in batches (Firestore array-contains limit)
  const BATCH_SIZE = 100;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let totalSent = 0;
  const MAX_RECIPIENTS = 500; // safety cap per session

  while (totalSent < MAX_RECIPIENTS) {
    let query = adminDb
      .collection('users')
      .where('enrollments', 'array-contains-any', [{ courseId: input.courseId }])
      .limit(BATCH_SIZE);

    // Firestore enrollments is an array of Enrollment objects, so array-contains-any won't work
    // directly. Use the enrollmentIndex sub-collection instead.
    break; // See below — we use enrollmentIndex
  }

  // Use the enrollmentIndex collection: enrollmentIndex/{courseId}/users/{userId}
  let lastIndexDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (totalSent < MAX_RECIPIENTS) {
    let indexQuery = adminDb
      .collection('enrollmentIndex')
      .doc(input.courseId)
      .collection('users')
      .orderBy('__name__')
      .limit(BATCH_SIZE);

    if (lastIndexDoc) {
      indexQuery = indexQuery.startAfter(lastIndexDoc);
    }

    const indexSnap = await indexQuery.get();
    if (indexSnap.empty) break;

    const userIds = indexSnap.docs.map((d) => d.id);
    lastIndexDoc = indexSnap.docs[indexSnap.docs.length - 1];

    // Fetch user docs in batches of 10 (getAll supports up to 500 but batching is safer)
    const userRefs = userIds.map((uid) => adminDb.collection('users').doc(uid));
    const userSnaps = await adminDb.getAll(...userRefs);

    const emailPromises = userSnaps
      .filter((s) => s.exists)
      .map((s) => {
        const u = s.data() as User;
        const targetUserId = s.id;
        const reminderMessage = `Reminder: ${input.sessionTitle} (${courseTitle}) starts at ${new Date(input.startTime).toLocaleString()}.`;

        if (u.phone_number) {
          dispatchCommunication({
            eventKey: 'live_class_scheduled',
            userId: targetUserId,
            phoneNumber: u.phone_number,
            email: u.email,
            title: 'New live class scheduled',
            message: `${input.sessionTitle} was scheduled for ${new Date(input.startTime).toLocaleString()}.`,
            metadata: {
              courseId: input.courseId,
              courseTitle,
              instructor: input.instructor,
              startTime: input.startTime,
              live_class_title: input.sessionTitle,
              class_time: new Date(input.startTime).toLocaleString(),
              user_name: u.name || 'Student',
            },
          }).catch(() => undefined);
        }

        const start = new Date(input.startTime).getTime();
        const reminders = [
          { label: '1_day', offsetMs: 24 * 60 * 60 * 1000 },
          { label: '1_hour', offsetMs: 60 * 60 * 1000 },
          { label: '15_minutes', offsetMs: 15 * 60 * 1000 },
        ];
        reminders.forEach((r) => {
          const fireAt = new Date(start - r.offsetMs);
          if (fireAt.getTime() > Date.now()) {
            queueLiveClassReminder(targetUserId, u.phone_number, reminderMessage, fireAt, {
              interval: r.label,
              courseId: input.courseId,
              courseTitle,
              sessionTitle: input.sessionTitle,
              instructor: input.instructor,
              startTime: input.startTime,
              eventKey: 'live_class_reminder',
              live_class_title: input.sessionTitle,
              class_time: new Date(input.startTime).toLocaleString(),
              reminder_countdown: r.label.replace('_', ' '),
              user_name: u.name || 'Student',
            }).catch(() => undefined);
          }
        });

        if (!u.email) return Promise.resolve();
        return sendTransactionalEmail({
          type: 'liveSession',
          to: u.email,
          recipientName: u.name || 'Student',
          courseTitle,
          sessionTitle: input.sessionTitle,
          instructor: input.instructor,
          startTime: input.startTime,
          durationMinutes: input.durationMinutes,
          internalSecret: INTERNAL_SECRET,
        }).catch((err) => {
          logger.warn('[LiveSession] Failed to send notification to student', { email: u.email, error: err?.message });
        });
      });

    await Promise.all(emailPromises);
    totalSent += userIds.length;

    if (indexSnap.size < BATCH_SIZE) break;
  }

  logger.info('[LiveSession] Student notifications sent', { courseId: input.courseId, totalSent });
}

/**
 * @deprecated Use createLiveSession / getZoomJoinUrl / deleteLiveSession instead.
 * This stub is kept to avoid breaking any existing import references during migration.
 */
export async function generateZoomSignature(
  _idToken: string,
  _meetingId: string,
  _role: number
): Promise<{ signature: string } | { error: string }> {
  return { error: 'Zoom Video SDK is no longer used. The platform now uses external Zoom meeting links.' };
}
