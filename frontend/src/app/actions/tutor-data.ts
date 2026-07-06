'use server';

import { apiFetchServer } from '@/lib/api-client.server';
import type { User } from '@/lib/db';

type TutorStudentsResult = {
  students: User[];
  hasMore: boolean;
  nextCursor: string | null;
  error?: string;
};

export async function getTutorStudents(
  idToken: string,
  courseIds: string[],
  pageSize = 200,
  cursor?: string | null
): Promise<TutorStudentsResult> {
  try {
    if (!idToken) {
      return { students: [], hasMore: false, nextCursor: null, error: 'Authentication required.' };
    }

    if (!courseIds.length) {
      return { students: [], hasMore: false, nextCursor: null };
    }

    const query = new URLSearchParams({
      course_ids: courseIds.join(','),
      page_size: pageSize.toString(),
    });
    
    if (cursor) query.append('cursor', cursor);

    const data = await apiFetchServer(`/api/v1/tutor/students?${query.toString()}`);
    
    return {
      students: data.students || [],
      hasMore: data.hasMore || false,
      nextCursor: data.nextCursor || null,
    };
  } catch (error: any) {
    return { students: [], hasMore: false, nextCursor: null, error: error.message || 'Failed to get tutor students.' };
  }
}
