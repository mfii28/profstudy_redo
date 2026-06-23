'use server';

import { adminDb, adminAuth, FieldValue } from '@/firebase/admin';
import { isAdminRole, requireAdminContextFromIdToken } from '@/lib/trusted-server-context';
import type { Course } from '@/lib/db';

function buildPlaceholderDoc(
  courseId: string,
  courseTitle: string,
  tutorId: string,
  instructorName: string
): Record<string, unknown> {
  const sessionId = `placeholder-${courseId}`;
  const now = new Date();
  const startTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  startTime.setUTCHours(12, 0, 0, 0);

  return {
    id: sessionId,
    title: `Live Session \u2014 ${courseTitle}`,
    courseId,
    meetingLink: 'https://zoom.us',
    instructor: instructorName,
    instructorId: tutorId,
    startTime: startTime.toISOString(),
    durationMinutes: 60,
    status: 'upcoming',
    isPlaceholder: true,
    createdAt: now.toISOString(),
  };
}

async function getInstructorName(tutorId: string): Promise<string> {
  try {
    const snap = await adminDb.doc(`users/${tutorId}`).get();
    if (snap.exists) {
      const data = snap.data() as { name?: string };
      return data?.name || 'Instructor';
    }
  } catch (err: unknown) {
    console.warn('[getInstructorName] Could not fetch tutor name', tutorId, err instanceof Error ? err.message : String(err));
  }
  return 'Instructor';
}

/**
 * Checks whether a live class already exists for the given course.
 * If not, creates a placeholder one via Admin SDK (bypasses user-facing API checks).
 *
 * Authorization: caller must be the course tutor OR an admin/superadmin/subadmin.
 * Idempotent: checks liveClasses collection before writing; safe to call repeatedly.
 */
export async function ensureLiveClassForCourse(
  courseId: string,
  courseTitle: string,
  tutorId: string,
  idToken: string
): Promise<{ created: boolean; error?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const callerId = decoded.uid;

    const isOwner = callerId === tutorId;
    let callerIsAdmin = false;
    if (!isOwner) {
      const callerDoc = await adminDb.doc(`users/${callerId}`).get();
      const callerData = callerDoc.data() as { role?: string } | undefined;
      callerIsAdmin = isAdminRole(callerData?.role as Parameters<typeof isAdminRole>[0]);
      if (!callerIsAdmin) {
        return { created: false, error: 'Access denied: must be course tutor or admin.' };
      }
    }

    if (isOwner && !callerIsAdmin) {
      const courseDoc = await adminDb.doc(`courses/${courseId}`).get();
      if (courseDoc.exists) {
        const courseOwnerData = courseDoc.data() as { tutorId?: string };
        if (courseOwnerData.tutorId && courseOwnerData.tutorId !== callerId) {
          return { created: false, error: 'Access denied: course belongs to a different tutor.' };
        }
      }
    }

    const existing = await adminDb
      .collection('liveClasses')
      .where('courseId', '==', courseId)
      .limit(1)
      .get();

    if (!existing.empty) return { created: false };

    const instructorName = await getInstructorName(tutorId);
    const docData = buildPlaceholderDoc(courseId, courseTitle, tutorId, instructorName);
    await adminDb.doc(`liveClasses/${docData.id}`).set(docData);

    return { created: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[ensureLiveClassForCourse]', message);
    return { created: false, error: message };
  }
}

/**
 * Admin-only: scans all courses and creates a placeholder live class for any
 * course that has none linked. Returns a summary of what was created vs skipped.
 */
export async function backfillLiveClasses(
  idToken: string
): Promise<{ created: number; skipped: number; error?: string }> {
  try {
    const adminCtx = await requireAdminContextFromIdToken(idToken, 'courses:approve');
    if (!adminCtx.ok) return { created: 0, skipped: 0, error: adminCtx.error };
    const uid = adminCtx.userId;

    const [coursesSnap, liveClassSnap] = await Promise.all([
      adminDb.collection('courses').get(),
      adminDb.collection('liveClasses').get(),
    ]);

    const coveredCourseIds = new Set<string>();
    liveClassSnap.docs.forEach((d: any) => {
      const data = d.data() as { courseId?: string };
      if (data.courseId) coveredCourseIds.add(data.courseId);
    });

    let created = 0;
    let skipped = 0;

    for (const courseDoc of coursesSnap.docs) {
      const courseId = courseDoc.id;
      if (coveredCourseIds.has(courseId)) {
        skipped++;
        continue;
      }

      const courseData = courseDoc.data() as { title?: string; tutorId?: string };
      const tutorId = courseData.tutorId || uid;
      const instructorName = courseData.tutorId
        ? await getInstructorName(courseData.tutorId)
        : 'Instructor';

      const docData = buildPlaceholderDoc(
        courseId,
        courseData.title || 'Untitled Course',
        tutorId,
        instructorName
      );
      await adminDb.doc(`liveClasses/${docData.id}`).set(docData);
      created++;
    }

    return { created, skipped };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[backfillLiveClasses]', message);
    return { created: 0, skipped: 0, error: message };
  }
}

/**
 * Server-side course creation with automatic live class initialization.
 *
 * This action:
 *   1. Verifies the caller's identity and authorization (must be tutorId or admin).
 *   2. Checks whether the course doc previously existed BEFORE writing.
 *   3. Writes the course (and tutorDetails.coursesTaught) via Admin SDK.
 *   4. If the course was brand-new, creates a placeholder live class atomically.
 *
 * Used only for initial course creation. Subsequent saves (updates) use the
 * client-side saveCourse path which is sufficient for non-creation edits.
 */
export async function saveNewCourseWithLiveClass(
  course: Course,
  tutorId: string,
  idToken: string
): Promise<{ liveClassCreated: boolean; error?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const callerId = decoded.uid;

    const isOwner = callerId === tutorId;
    if (!isOwner) {
      const callerDoc = await adminDb.doc(`users/${callerId}`).get();
      const callerData = callerDoc.data() as { role?: string } | undefined;
      const callerIsAdmin = isAdminRole(callerData?.role as Parameters<typeof isAdminRole>[0]);
      if (!callerIsAdmin) {
        return { liveClassCreated: false, error: 'Access denied: must be course tutor or admin.' };
      }
    }

    const courseRef = adminDb.doc(`courses/${course.id}`);
    const existingSnap = await courseRef.get();
    const isNewCourse = !existingSnap.exists;

    const now = new Date().toISOString();
    const coursePayload: Record<string, unknown> = {
      ...course,
      tutorId,
      updatedAt: now,
    };
    const cleaned = Object.fromEntries(
      Object.entries(coursePayload).filter(([, v]) => v !== undefined)
    );

    const batch = adminDb.batch();
    batch.set(courseRef, cleaned, { merge: true });
    batch.set(
      adminDb.doc(`users/${tutorId}`),
      { tutorDetails: { coursesTaught: FieldValue.arrayUnion(course.id) } },
      { merge: true }
    );

    if (isNewCourse) {
      const instructorName = await getInstructorName(tutorId);
      const liveDoc = buildPlaceholderDoc(course.id, course.title, tutorId, instructorName);
      batch.set(adminDb.doc(`liveClasses/${liveDoc.id}`), liveDoc);
    }

    await batch.commit();

    return { liveClassCreated: isNewCourse };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[saveNewCourseWithLiveClass]', message);
    return { liveClassCreated: false, error: message };
  }
}
