'use server';

import { adminDb } from '@/firebase/admin';
import { sendTransactionalEmail } from '@/app/actions/email';
import { FieldValue } from 'firebase-admin/firestore';
import { enrollUserInCourse } from '@/lib/enrollment-manager';
import { requireAdminContextFromIdToken } from '@/lib/trusted-server-context';

async function assertAdmin(idToken: string) {
  const ctx = await requireAdminContextFromIdToken(idToken, 'courses:approve');
  if (!ctx.ok) {
    throw new Error(ctx.error);
  }
  return ctx.userId;
}

export async function findUserForManualEnrollment(idToken: string, email: string) {
  try {
    await assertAdmin(idToken);
    const rawEmail = String(email || '').trim();
    const normalizedEmail = rawEmail.toLowerCase();
    if (!normalizedEmail) return { error: 'Email is required.' };

    let querySnap = await adminDb
      .collection('users')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();
    if (querySnap.empty && rawEmail !== normalizedEmail) {
      querySnap = await adminDb
        .collection('users')
        .where('email', '==', rawEmail)
        .limit(1)
        .get();
    }

    const userDoc = querySnap.docs[0];
    if (!userDoc) return { error: 'User not found.' };

    const data = userDoc.data() as any;
    return {
      user: {
        id: userDoc.id,
        name: data?.name || 'User',
        email: data?.email || normalizedEmail,
      },
    };
  } catch (error: any) {
    return { error: error?.message || 'Failed to verify user.' };
  }
}

export async function searchUsersForManualEnrollment(idToken: string, queryText: string, max = 20) {
  try {
    await assertAdmin(idToken);
    const q = String(queryText || '').trim().toLowerCase();
    const limitSize = Math.min(Math.max(Number(max) || 20, 1), 500);
    const usersRef = adminDb.collection('users');

    if (!q) {
      const snapshot = await usersRef.where('role', '==', 'student').limit(limitSize).get();
      const users = snapshot.docs
        .map((snap) => {
          const data = snap.data() as any;
          return {
            id: snap.id,
            name: String(data?.name || 'User').trim() || 'User',
            email: String(data?.email || '').trim(),
            role: String(data?.role || '').trim().toLowerCase(),
          };
        })
        .filter((user) => user.email)
        .map(({ id, name, email }) => ({ id, name, email }));

      return { users };
    }

    const [emailPrefixSnap, namePrefixSnap] = await Promise.all([
      usersRef.where('email', '>=', q).where('email', '<=', `${q}\uf8ff`).limit(limitSize).get(),
      usersRef.where('name', '>=', q).where('name', '<=', `${q}\uf8ff`).limit(limitSize).get(),
    ]);

    const merged = new Map<string, { id: string; name: string; email: string }>();
    for (const snap of [...emailPrefixSnap.docs, ...namePrefixSnap.docs]) {
      const data = snap.data() as any;
      const email = String(data?.email || '').trim();
      const name = String(data?.name || 'User').trim() || 'User';
      const role = String(data?.role || '').trim().toLowerCase();
      if (!email && !name) continue;
      if (role !== 'student') continue;
      if (email.toLowerCase().includes(q) || name.toLowerCase().includes(q)) {
        merged.set(snap.id, { id: snap.id, name, email });
      }
    }

    return { users: Array.from(merged.values()).slice(0, limitSize) };
  } catch (error: any) {
    return { error: error?.message || 'Failed to search users.' };
  }
}

export async function enrollUserInCourseByAdmin(idToken: string, userId: string, courseId: string) {
  try {
    await assertAdmin(idToken);
    if (!userId || !courseId) return { error: 'User and course are required.' };

    const [userSnap, courseSnap] = await Promise.all([
      adminDb.doc(`users/${userId}`).get(),
      adminDb.doc(`courses/${courseId}`).get(),
    ]);

    if (!userSnap.exists) return { error: 'User not found.' };
    if (!courseSnap.exists) return { error: 'Course not found.' };

    const course = courseSnap.data() as any;
    if (String(course?.status || '').toLowerCase() !== 'published') {
      return { error: 'Course is not published for enrollment.' };
    }

    const user = userSnap.data() as any;

    const { alreadyEnrolled } = await enrollUserInCourse(userId, courseId, 'admin');
    if (alreadyEnrolled) {
      return { error: 'User is already enrolled.' };
    }

    // Fire-and-forget: send enrollment confirmation email to the student
    const INTERNAL_SECRET = process.env.INTERNAL_EMAIL_SECRET;
    if (INTERNAL_SECRET && user?.email) {
      sendTransactionalEmail({
        type: 'adminEnrollment',
        to: user.email,
        recipientName: user.name || 'Student',
        courseTitle: course.title || courseId,
        courseId,
        internalSecret: INTERNAL_SECRET,
      }).catch(() => undefined);
    }

    return { success: true };
  } catch (error: any) {
    return { error: error?.message || 'Enrollment failed.' };
  }
}

export async function bulkEnrollUsersInCourseByAdmin(idToken: string, userIds: string[], courseId: string) {
  try {
    await assertAdmin(idToken);
    if (!Array.isArray(userIds) || userIds.length === 0 || !courseId) {
      return { error: 'Users and course are required.' };
    }

    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    const results: Array<{ userId: string; success: boolean; error?: string }> = [];

    for (const userId of uniqueUserIds) {
      const result = await enrollUserInCourseByAdmin(idToken, userId, courseId);
      if ('error' in result) {
        results.push({ userId, success: false, error: result.error });
      } else {
        results.push({ userId, success: true });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    return {
      success: true,
      successCount,
      failedCount: results.length - successCount,
      results,
    };
  } catch (error: any) {
    return { error: error?.message || 'Bulk enrollment failed.' };
  }
}

export async function recordManualPayment(
  idToken: string,
  userIds: string[],
  courseId: string,
  amount: number,
  method: string,
  note: string
) {
  try {
    const callerUid = await assertAdmin(idToken);
    if (!Array.isArray(userIds) || userIds.length === 0 || !courseId || !amount || amount <= 0) {
      return { error: 'Invalid payment details.' };
    }

    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    const totalAmount = amount * uniqueUserIds.length;
    const paymentTimestamp = new Date().toISOString();
    const paymentId = `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create payment record in payment history collection
    for (const userId of uniqueUserIds) {
      const paymentRecord = {
        id: paymentId,
        userId,
        courseId,
        amount,
        totalAmount,
        method,
        note,
        status: 'completed',
        source: 'manual',
        timestamp: paymentTimestamp,
        processedAt: paymentTimestamp,
      };

      await adminDb
        .collection('paymentHistory')
        .doc(`${userId}_${paymentId}`)
        .set(paymentRecord);

      // Update user's payment records
      await adminDb
        .doc(`users/${userId}`)
        .update({
          'paymentRecords': FieldValue.arrayUnion({
            paymentId,
            courseId,
            amount,
            method,
            timestamp: paymentTimestamp,
            source: 'manual',
          }),
        })
        .catch(() => undefined); // If field doesn't exist, skip
    }

    // Create financial ledger entry
    await adminDb
      .collection('financialLedger')
      .doc(paymentId)
      .set({
        paymentId,
        type: 'manual_payment',
        method,
        totalAmount,
        studentCount: uniqueUserIds.length,
        studentIds: uniqueUserIds,
        courseId,
        note,
        status: 'completed',
        recordedAt: paymentTimestamp,
        recordedBy: callerUid,
      });

    return { success: true, paymentId, totalAmount };
  } catch (error: any) {
    return { error: error?.message || 'Failed to record payment.' };
  }
}
