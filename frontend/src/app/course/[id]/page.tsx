import { notFound } from 'next/navigation';
import { apiFetchServer } from '@/lib/api-client.server';
import { canReadCoursePublicly } from '../../../lib/course-access';
import type { Course } from '@/lib/db';
import CourseDetailClient from './course-detail-client';
import { createElement } from 'react';

interface CoursePageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseDetailPage({ params }: CoursePageProps) {
  const { id } = await params;

  try {
    const res = await apiFetchServer(`/courses/${id}`);
    if (!res.ok) {
      if (res.status === 404) notFound();
      throw new Error(`Failed to fetch course: ${res.statusText}`);
    }
    const data = await res.json();
    const course = data.course as Course;
    
    if (!canReadCoursePublicly(course.status)) {
      notFound();
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('NEXT_HTTP_ERROR_FALLBACK')) {
      throw error;
    }
    // Backend unavailable, timeouts, etc. — still render; client loads via rules.
    console.warn('[CourseDetailPage] Server-side course gate failed; falling back to client.', error);
  }

  return createElement(CourseDetailClient, { courseId: id, isPreview: false });
}