/**
 * @fileOverview Server-only classroom sync helpers.
 *
 * This module intentionally lives in src/lib/ (not src/app/actions/) so that
 * it can be imported by both:
 *   - Server Action files (src/app/actions/classroom.ts, admin-enrollment.ts, payments.ts)
 *   - Plain server-side lib files (src/lib/payment-fulfillment.ts)
 * without creating an import from a 'use server' boundary into a lib, which
 * can confuse the Next.js bundler.
 */

import 'server-only';

import { adminDb } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  addUserToCourseEnrollmentIndex,
  listAllCourseEnrollmentUserIds,
} from '@/lib/enrollment-index';
import type { Classroom, ClassroomMember, ClassroomMemberRole } from '@/lib/db';

function mapGlobalRoleToClassroomRole(role: string): ClassroomMemberRole {
  if (['admin', 'superadmin', 'subadmin'].includes(role)) return 'classroom-admin';
  if (['tutor', 'author', 'instructor', 'teacher'].includes(role)) return 'classroom-author';
  return 'classroom-student';
}

async function buildMembersFromUserIds(
  userIds: string[],
  addedBy: string,
): Promise<ClassroomMember[]> {
  const members: ClassroomMember[] = [];
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

  for (let i = 0; i < uniqueIds.length; i += 200) {
    const chunk = uniqueIds.slice(i, i + 200);
    const refs = chunk.map((uid) => adminDb.doc(`users/${uid}`));
    const snaps = await adminDb.getAll(...refs);
    snaps.forEach((snap) => {
      if (!snap.exists) return;
      const data = snap.data() as any;
      members.push({
        userId: snap.id,
        classroomRole: mapGlobalRoleToClassroomRole(data.role || 'student'),
        addedAt: new Date().toISOString(),
        addedBy,
      });
    });
  }

  return members;
}

/**
 * Ensures a classroom document exists for the given courseId and that the
 * student uid is in enrolledStudentIds.  Called by every enrollment path
 * (paid, free, admin) so access is granted immediately with no manual
 * admin intervention required.
 *
 * - If the classroom already exists → `arrayUnion` the student (idempotent).
 * - If the classroom does NOT exist → creates it on-demand, including all
 *   currently-indexed enrolled students plus the triggering student.
 *
 * Non-throwing: errors are logged but never re-thrown so enrollment flows
 * are never blocked by a classroom sync failure.
 */
export async function ensureClassroomAndAddStudent(
  courseId: string,
  studentUid: string,
): Promise<void> {
  try {
    const classroomRef = adminDb.doc(`classrooms/${courseId}`);
    const snap = await classroomRef.get();

    if (snap.exists) {
      await classroomRef.update({
        enrolledStudentIds: FieldValue.arrayUnion(studentUid),
      });
      await addUserToCourseEnrollmentIndex(courseId, studentUid, 'sync');
      return;
    }

    // Classroom doesn't exist yet — create it on-demand
    const courseDoc = await adminDb.doc(`courses/${courseId}`).get();
    if (!courseDoc.exists) {
      console.warn('[ensureClassroomAndAddStudent] Course not found, skipping', { courseId });
      return;
    }
    const course = courseDoc.data() as any;

    let enrolledStudentIds = await listAllCourseEnrollmentUserIds(courseId, {
      batchSize: 500,
      maxUsers: 50000,
    });

    // Always include the triggering student
    if (!enrolledStudentIds.includes(studentUid)) {
      enrolledStudentIds = [...enrolledStudentIds, studentUid];
    }

    const members = await buildMembersFromUserIds(enrolledStudentIds, 'system');
    const now = new Date().toISOString();
    const classroom: Omit<Classroom, 'id'> = {
      courseId,
      courseTitle: course.title || 'Untitled Course',
      category: course.category || 'General',
      description: `This is the classroom for ${course.title || 'this course'} lectures and discussions.`,
      tutorId: course.tutorId || '',
      createdById: 'system',
      createdByName: 'System',
      memberCount: enrolledStudentIds.length,
      members,
      createdAt: now,
      enrolledStudentIds,
    };

    // Use merge so concurrent enrollments don't race-overwrite each other
    await classroomRef.set({ ...classroom, id: courseId }, { merge: true });
    console.info('[ensureClassroomAndAddStudent] Classroom auto-created', {
      courseId,
      studentCount: enrolledStudentIds.length,
    });
  } catch (err: any) {
    console.error('[ensureClassroomAndAddStudent] Failed', {
      courseId,
      studentUid,
      error: err?.message,
    });
  }
}
