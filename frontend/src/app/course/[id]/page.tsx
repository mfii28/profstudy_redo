import { notFound } from 'next/navigation';
import { adminDb } from '@/firebase/admin';
import { canReadCoursePublicly } from '../../../lib/course-access';
import { type Course } from '@/lib/db';
import CourseDetailClient from './course-detail-client';
import { createElement } from 'react';

interface CoursePageProps {
  params: Promise<{ id: string }>;
}

/** `notFound()` from next/navigation throws with this digest shape — must rethrow, not swallow. */
function isNextNavigationNotFound(error: unknown): boolean {
  const digest =
    typeof error === 'object' && error !== null && 'digest' in error
      ? String((error as { digest?: string }).digest)
      : '';
  return digest.includes('NEXT_HTTP_ERROR_FALLBACK') && digest.includes('404');
}

export default async function CourseDetailPage({ params }: CoursePageProps) {
  const { id } = await params;

  try {
    const snap = await adminDb.collection('courses').doc(id).get();
    if (!snap.exists) {
      notFound();
    }

    const course = snap.data() as Course;
    if (!canReadCoursePublicly(course.status)) {
      notFound();
    }
  } catch (error: unknown) {
    if (isNextNavigationNotFound(error)) {
      throw error;
    }
    // Admin unavailable, Firestore errors, timeouts, etc. — still render; client loads via rules.
    console.warn('[CourseDetailPage] Server-side course gate failed; falling back to client.', error);
  }

  return createElement(CourseDetailClient, { courseId: id, isPreview: false });
}