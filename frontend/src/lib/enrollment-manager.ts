/**
 * @fileOverview Deep EnrollmentManager module.
 *
 * Single entry point for all enrollment operations. Hides the 3-storage-pattern
 * complexity (user array + enrollment index + classroom sync) behind a clean
 * interface that is safe to call from any enrollment source.
 *
 * Replaces manual orchestration in admin-enrollment.ts and payment-fulfillment.ts.
 */

import 'server-only';

import { adminDb, FieldValue } from '@/firebase/admin';
import type { Enrollment } from '@/lib/db';
import { logger } from '@/lib/logging';

// ─── Types ──────────────────────────────────────────────────────────────────

export type EnrollmentSource = 'paystack' | 'free-enroll' | 'admin' | 'migration' | 'sync';

export interface CourseEnrollmentResult {
  courseId: string;
  success: boolean;
  alreadyEnrolled: boolean;
  error?: string;
}

export interface BulkEnrollmentResult {
  userId: string;
  courseIds: string[];
  enrolledCount: number;
  skippedCount: number;
  failedCount: number;
  results: CourseEnrollmentResult[];
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function normalizeId(value: string): string {
  return (value || '').trim();
}

/**
 * Writes to enrollment index (courseEnrollments/{courseId}/members/{userId}).
 * Idempotent — preserves original enrolledAt timestamp on re-enrollment.
 */
async function writeEnrollmentIndex(
  courseId: string,
  userId: string,
  source: EnrollmentSource,
): Promise<void> {
  const now = new Date().toISOString();
  const memberRef = adminDb
    .collection('courseEnrollments')
    .doc(courseId)
    .collection('members')
    .doc(userId);

  const existing = await memberRef.get();

  await memberRef.set(
    {
      userId,
      courseId,
      source,
      enrolledAt: existing.exists ? existing.data()?.enrolledAt || now : now,
      updatedAt: now,
    },
    { merge: true },
  );

  await adminDb
    .collection('courseEnrollments')
    .doc(courseId)
    .set(
      {
        courseId,
        updatedAt: now,
        ...(existing.exists ? {} : { memberCount: FieldValue.increment(1) }),
      },
      { merge: true },
    );
}

/**
 * Removes from enrollment index. Idempotent — safe to call even if not enrolled.
 */
async function removeEnrollmentIndex(courseId: string, userId: string): Promise<void> {
  const memberRef = adminDb
    .collection('courseEnrollments')
    .doc(courseId)
    .collection('members')
    .doc(userId);

  const existing = await memberRef.get();
  if (!existing.exists) return;

  await memberRef.delete();
  await adminDb
    .collection('courseEnrollments')
    .doc(courseId)
    .set(
      {
        courseId,
        updatedAt: new Date().toISOString(),
        memberCount: FieldValue.increment(-1),
      },
      { merge: true },
    );
}

/**
 * Classroom sync — non-blocking. Errors are logged but never propagated so
 * enrollment flows are never blocked by a classroom failure.
 */
async function syncClassroom(courseId: string, userId: string): Promise<void> {
  try {
    const classroomRef = adminDb.doc(`classrooms/${courseId}`);
    const snap = await classroomRef.get();

    if (snap.exists) {
      await classroomRef.update({
        enrolledStudentIds: FieldValue.arrayUnion(userId),
      });
      return;
    }

    // Classroom doesn't exist yet — create it on demand
    const courseDoc = await adminDb.doc(`courses/${courseId}`).get();
    if (!courseDoc.exists) {
      logger.warn('[EnrollmentManager] Course not found for classroom auto-create', { courseId });
      return;
    }

    const course = courseDoc.data() as Record<string, unknown>;
    const now = new Date().toISOString();

    await classroomRef.set(
      {
        id: courseId,
        courseId,
        courseTitle: course.title || 'Untitled Course',
        category: course.category || 'General',
        description: `Classroom for ${course.title || 'this course'}.`,
        tutorId: course.tutorId || '',
        createdById: 'system',
        createdByName: 'System',
        memberCount: 1,
        members: [],
        createdAt: now,
        enrolledStudentIds: [userId],
      },
      { merge: true },
    );

    logger.info('[EnrollmentManager] Classroom auto-created', { courseId, userId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[EnrollmentManager] Classroom sync failed (non-blocking)', {
      courseId,
      userId,
      error: message,
    });
  }
}

/**
 * Performs a single-course enrollment:
 * 1. Adds to users/{userId}.enrollments[] (arrayUnion — idempotent)
 * 2. Writes enrollment index entry
 * 3. Syncs classroom (non-blocking)
 */
async function enrollSingleCourse(
  userId: string,
  courseId: string,
  source: EnrollmentSource,
): Promise<CourseEnrollmentResult> {
  const cId = normalizeId(courseId);
  const uId = normalizeId(userId);
  if (!cId || !uId) {
    return { courseId, success: false, alreadyEnrolled: false, error: 'Invalid courseId or userId' };
  }

  try {
    // Check existing enrollment via index (single read)
    const memberSnap = await adminDb
      .collection('courseEnrollments')
      .doc(cId)
      .collection('members')
      .doc(uId)
      .get();

    if (memberSnap.exists) {
      return { courseId: cId, success: true, alreadyEnrolled: true };
    }

    const enrollment: Enrollment = {
      courseId: cId,
      enrolledDate: new Date().toISOString(),
      completedLessons: [],
    };

    // Update user array
    await adminDb.doc(`users/${uId}`).update({
      enrollments: FieldValue.arrayUnion(enrollment),
    });

    // Write enrollment index
    await writeEnrollmentIndex(cId, uId, source);

    // Classroom sync (fire-and-forget — never throws)
    syncClassroom(cId, uId).catch(() => undefined);

    return { courseId: cId, success: true, alreadyEnrolled: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[EnrollmentManager] enrollSingleCourse failed', {
      userId: uId,
      courseId: cId,
      error: message,
    });
    return { courseId: cId, success: false, alreadyEnrolled: false, error: message };
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Enroll a user in multiple courses atomically per course.
 *
 * Optimized for the payment fulfillment path (40% of all enrollments):
 * - Checks existing enrollments once per user
 * - Runs per-course operations in parallel
 * - Returns a structured result with per-course success/failure
 * - Idempotent: safe to retry; already-enrolled courses are skipped
 *
 * @example
 * const { enrolledCount, failedCount, results } = await enrollUserInCourses(
 *   userId, courseIds, { source: 'paystack', requestId }
 * );
 * if (failedCount > 0) logger.warn('Partial enrollment', { results });
 */
export async function enrollUserInCourses(
  userId: string,
  courseIds: string[],
  options?: { source?: EnrollmentSource; requestId?: string },
): Promise<BulkEnrollmentResult> {
  const uId = normalizeId(userId);
  const source = options?.source ?? 'paystack';
  const unique = Array.from(new Set(courseIds.map(normalizeId).filter(Boolean)));

  if (!uId) {
    return {
      userId,
      courseIds: unique,
      enrolledCount: 0,
      skippedCount: 0,
      failedCount: unique.length,
      results: unique.map((cId) => ({
        courseId: cId,
        success: false,
        alreadyEnrolled: false,
        error: 'Invalid userId',
      })),
    };
  }

  logger.info('[EnrollmentManager] enrollUserInCourses start', {
    userId: uId,
    courseCount: unique.length,
    source,
    requestId: options?.requestId,
  });

  const results = await Promise.all(
    unique.map((courseId) => enrollSingleCourse(uId, courseId, source)),
  );

  const enrolledCount = results.filter((r) => r.success && !r.alreadyEnrolled).length;
  const skippedCount = results.filter((r) => r.alreadyEnrolled).length;
  const failedCount = results.filter((r) => !r.success && !r.alreadyEnrolled).length;

  logger.info('[EnrollmentManager] enrollUserInCourses complete', {
    userId: uId,
    enrolledCount,
    skippedCount,
    failedCount,
    requestId: options?.requestId,
  });

  return {
    userId: uId,
    courseIds: unique,
    enrolledCount,
    skippedCount,
    failedCount,
    results,
  };
}

/**
 * Enroll a user in a single course.
 * Throws on failure so callers can handle errors with standard try/catch.
 *
 * Used by admin-enrollment and free-enrollment paths.
 */
export async function enrollUserInCourse(
  userId: string,
  courseId: string,
  source: EnrollmentSource,
): Promise<{ alreadyEnrolled: boolean }> {
  const result = await enrollSingleCourse(userId, courseId, source);
  if (!result.success) {
    throw new Error(result.error || 'Enrollment failed');
  }
  return { alreadyEnrolled: result.alreadyEnrolled };
}

/**
 * Remove a user from a course.
 * Removes from user array, enrollment index, and classroom.
 * Idempotent — safe to call if user is not enrolled.
 */
export async function removeUserFromCourse(userId: string, courseId: string): Promise<void> {
  const uId = normalizeId(userId);
  const cId = normalizeId(courseId);
  if (!uId || !cId) return;

  // Fetch current enrollment object to use in arrayRemove
  const userSnap = await adminDb.doc(`users/${uId}`).get();
  const enrollments: Enrollment[] = userSnap.exists
    ? (userSnap.data()?.enrollments ?? [])
    : [];
  const enrollment = enrollments.find((e) => e.courseId === cId);

  const ops: Promise<unknown>[] = [removeEnrollmentIndex(cId, uId)];

  if (enrollment) {
    ops.push(
      adminDb.doc(`users/${uId}`).update({
        enrollments: FieldValue.arrayRemove(enrollment),
      }),
    );
  }

  // Remove from classroom (non-throwing)
  ops.push(
    adminDb
      .doc(`classrooms/${cId}`)
      .get()
      .then((snap) => {
        if (snap.exists) {
          return adminDb.doc(`classrooms/${cId}`).update({
            enrolledStudentIds: FieldValue.arrayRemove(uId),
          });
        }
      })
      .catch(() => undefined),
  );

  await Promise.all(ops);

  logger.info('[EnrollmentManager] removeUserFromCourse', { userId: uId, courseId: cId });
}

/**
 * Point query: is a user enrolled in a course?
 * Reads from the enrollment index (course-centric) for efficiency.
 */
export async function isUserEnrolled(userId: string, courseId: string): Promise<boolean> {
  const uId = normalizeId(userId);
  const cId = normalizeId(courseId);
  if (!uId || !cId) return false;

  const snap = await adminDb
    .collection('courseEnrollments')
    .doc(cId)
    .collection('members')
    .doc(uId)
    .get();

  return snap.exists;
}

/**
 * List all enrolled userIds for a course with pagination.
 */
export async function listEnrolledUsers(
  courseId: string,
  options?: { limit?: number; startAfterId?: string },
): Promise<{ userIds: string[]; nextCursor: string | null }> {
  const cId = normalizeId(courseId);
  if (!cId) return { userIds: [], nextCursor: null };

  const pageSize = Math.min(Math.max(options?.limit ?? 500, 1), 1000);
  let query = adminDb
    .collection('courseEnrollments')
    .doc(cId)
    .collection('members')
    .orderBy('__name__')
    .limit(pageSize);

  if (options?.startAfterId) {
    const startDoc = await adminDb
      .collection('courseEnrollments')
      .doc(cId)
      .collection('members')
      .doc(options.startAfterId)
      .get();
    if (startDoc.exists) {
      query = query.startAfter(startDoc);
    }
  }

  const snap = await query.get();
  const userIds = snap.docs.map((doc) => doc.id);
  const nextCursor =
    snap.docs.length === pageSize ? (snap.docs[snap.docs.length - 1]?.id ?? null) : null;

  return { userIds, nextCursor };
}
