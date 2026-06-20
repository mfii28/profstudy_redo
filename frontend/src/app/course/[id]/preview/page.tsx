'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CoursePreviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const courseId = params?.id;

  useEffect(() => {
    if (!courseId) return;
    router.replace(`/student-dashboard/learn/${courseId}?preview=1`);
  }, [courseId, router]);

  return null;
}
