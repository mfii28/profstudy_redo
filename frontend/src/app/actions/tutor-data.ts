'use server';

import { adminDb } from '@/firebase/admin';
import { listAllCourseEnrollmentUserIds } from '@/lib/enrollment-index';
import { withServiceErrors } from '@/lib/service-errors';
import { getTrustedServerContextFromIdToken, isAdminRole } from '@/lib/trusted-server-context';
import type { User } from '@/lib/db';

type TutorStudentsResult = {
  students: User[];
  hasMore: boolean;
  nextCursor: string | null;
  error?: string;
};

async function assertTutorOrAdmin(idToken: string): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const ctx = await getTrustedServerContextFromIdToken(idToken);
  if (!ctx.success || !ctx.userId) {
    return { ok: false, error: ctx.error || 'Authentication required.' };
  }
  if (ctx.role !== 'tutor' && !isAdminRole(ctx.role)) {
    return { ok: false, error: 'Tutor access required.' };
  }
  return { ok: true, userId: ctx.userId };
}

async function collectEnrolledUserIds(courseIds: string[]): Promise<string[]> {
  const unique = new Set<string>();
  const normalized = Array.from(new Set(courseIds.map((id) => id.trim()).filter(Boolean)));

  await Promise.all(
    normalized.map(async (courseId) => {
      const userIds = await listAllCourseEnrollmentUserIds(courseId, {
        batchSize: 500,
        maxUsers: 10_000,
      });
      userIds.forEach((uid) => unique.add(uid));
    })
  );

  return Array.from(unique).sort();
}

async function fetchUsersByIds(userIds: string[]): Promise<User[]> {
  if (userIds.length === 0) return [];

  const users: User[] = [];
  const CHUNK = 100;

  for (let i = 0; i < userIds.length; i += CHUNK) {
    const chunk = userIds.slice(i, i + CHUNK);
    const refs = chunk.map((uid) => adminDb.collection('users').doc(uid));
    const snaps = await adminDb.getAll(...refs);
    snaps.forEach((snap) => {
      if (snap.exists) {
        users.push({ id: snap.id, ...snap.data() } as User);
      }
    });
  }

  return users;
}

export async function getTutorStudents(
  idToken: string,
  courseIds: string[],
  pageSize = 200,
  cursor?: string | null
): Promise<TutorStudentsResult> {
  const payload = await withServiceErrors(
    async () => {
      if (!idToken) {
        return { students: [], hasMore: false, nextCursor: null, error: 'Authentication required.' };
      }

      const auth = await assertTutorOrAdmin(idToken);
      if (!auth.ok) {
        return { students: [], hasMore: false, nextCursor: null, error: auth.error };
      }

      if (!courseIds.length) {
        return { students: [], hasMore: false, nextCursor: null };
      }

      const allUserIds = await collectEnrolledUserIds(courseIds);
      const safePageSize = Math.min(Math.max(pageSize, 1), 500);
      const startIndex = cursor ? Math.max(allUserIds.indexOf(cursor) + 1, 0) : 0;
      const pageIds = allUserIds.slice(startIndex, startIndex + safePageSize);
      const students = await fetchUsersByIds(pageIds);

      students.sort((a, b) => {
        const aDate = a.enrollments?.[0]?.enrolledDate || '';
        const bDate = b.enrollments?.[0]?.enrolledDate || '';
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });

      const lastId = pageIds[pageIds.length - 1] || null;
      const hasMore = startIndex + safePageSize < allUserIds.length;

      return {
        students,
        hasMore,
        nextCursor: hasMore ? lastId : null,
      };
    },
    { feature: 'Tutor students' }
  );

  if ('error' in payload && !('students' in payload)) {
    return { students: [], hasMore: false, nextCursor: null, error: payload.error };
  }

  return payload as TutorStudentsResult;
}
