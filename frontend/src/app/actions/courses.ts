'use server';

import { adminDb, adminAuth } from '@/firebase/admin';
import type { Course, Enrollment } from '@/lib/db';

export async function getEnrolledCoursesAction(idToken: string): Promise<{ courses: Course[]; error?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) {
      return { courses: [] };
    }

    const userData = userDoc.data() as { enrollments?: Enrollment[] };
    const enrollments: Enrollment[] = userData.enrollments || [];

    if (enrollments.length === 0) {
      return { courses: [] };
    }

    const courseIds = [...new Set(enrollments.map((e) => e.courseId).filter(Boolean))];
    const chunks: string[][] = [];
    for (let i = 0; i < courseIds.length; i += 10) {
      chunks.push(courseIds.slice(i, i + 10));
    }

    const courseMap = new Map<string, Course>();
    await Promise.all(
      chunks.map(async (ids) => {
        const refs = ids.map((id) => adminDb.doc(`courses/${id}`));
        const snaps = await adminDb.getAll(...refs);
        snaps.forEach((snap) => {
          if (snap.exists) {
            courseMap.set(snap.id, { ...(snap.data() as Omit<Course, 'id'>), id: snap.id });
          }
        });
      })
    );

    const courses = courseIds.map((id) => courseMap.get(id)).filter(Boolean) as Course[];
    return { courses };
  } catch (err: any) {
    console.error('[getEnrolledCoursesAction]', err?.message);
    return { courses: [], error: err?.message };
  }
}
