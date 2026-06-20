'use server';

import { z } from 'zod';
import { adminAuth, adminDb } from '@/firebase/admin';
import { listAllCourseEnrollmentUserIds } from '@/lib/enrollment-index';
import { dispatchCommunication, logDispatchFailure } from '@/lib/communications';

const idTokenSchema = z.string().min(1, 'ID token is required');

/**
 * Revokes all Firebase refresh tokens for the authenticated user.
 * SECURITY: This invalidates ALL active sessions, including the calling one.
 * Callers must sign out locally after this succeeds.
 */
export async function revokeAllSessions(
  idToken: string
): Promise<{ success: boolean } | { error: string }> {
  const validToken = idTokenSchema.safeParse(idToken);
  if (!validToken.success) return { error: 'Invalid token.' };

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    await adminAuth.revokeRefreshTokens(decoded.uid);
    return { success: true };
  } catch {
    return { error: 'Failed to revoke sessions. Please re-authenticate and try again.' };
  }
}

/**
 * Creates in-app notifications for all students enrolled in a course,
 * respecting each student's notifCourseAnnouncements preference.
 * SECURITY: Requires a valid idToken from a tutor/admin caller.
 */
export async function notifyEnrolledStudents(
  courseId: string,
  title: string,
  message: string,
  idToken: string
): Promise<{ notified: number } | { error: string }> {
  const validToken = idTokenSchema.safeParse(idToken);
  if (!validToken.success) return { error: 'Invalid token.' };

  if (!courseId || !title || !message) return { error: 'Missing required fields.' };

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);

    const callerDoc = await adminDb.doc(`users/${decoded.uid}`).get();
    const callerRole = callerDoc.exists ? callerDoc.data()?.role : null;
    if (!callerRole || !['tutor', 'admin', 'superadmin'].includes(callerRole)) {
      return { error: 'Unauthorized.' };
    }

    let notifiedCount = 0;
    const now = new Date().toISOString();

    const enrolledUserIds = await listAllCourseEnrollmentUserIds(courseId, {
      batchSize: 500,
      maxUsers: 50000,
    });

    for (let i = 0; i < enrolledUserIds.length; i += 200) {
      const chunkIds = enrolledUserIds.slice(i, i + 200);
      const refs = chunkIds.map((id) => adminDb.doc(`users/${id}`));
      const snaps = await adminDb.getAll(...refs);

      let batch = adminDb.batch();
      let batchSize = 0;

      for (const studentDoc of snaps) {
        if (!studentDoc.exists) continue;
        const student = studentDoc.data() as any;
        if ((student?.role || '') !== 'student') continue;

        const prefs = (student.preferences as Record<string, unknown>) ?? {};
        if (prefs.notifCourseAnnouncements === false) continue;

        const notifRef = adminDb.collection('notifications').doc();
        batch.set(notifRef, {
          userId: studentDoc.id,
          title: title.substring(0, 120),
          description: message.length > 220 ? `${message.substring(0, 220)}…` : message,
          time: now,
          read: false,
          category: 'info',
        });

        dispatchCommunication({
          eventKey: 'broadcast',
          userId: studentDoc.id,
          title: title.substring(0, 120),
          message,
          phoneNumber: student.phone_number,
          email: student.email,
          metadata: {
            message,
            user_name: student.name || 'Student',
            course_id: courseId,
          },
        }).catch((error) =>
          logDispatchFailure('session-announcement', error, { userId: studentDoc.id, courseId })
        );

        notifiedCount++;
        batchSize++;

        if (batchSize >= 450) {
          await batch.commit();
          batch = adminDb.batch();
          batchSize = 0;
        }
      }

      if (batchSize > 0) {
        await batch.commit();
      }
    }

    return { notified: notifiedCount };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send notifications.';
    return { error: message };
  }
}
