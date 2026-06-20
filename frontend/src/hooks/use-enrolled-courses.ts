'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getEnrolledCoursesAction } from '@/app/actions/courses';
import { mapEnrolledCoursesWithProgress, type CourseWithProgress } from '@/lib/learning-progress';
import type { Course } from '@/lib/db';
import { useStudentProfile } from '@/hooks/use-student-profile';

export function useEnrolledCourses() {
  const { user, profile, isLoading: isProfileLoading } = useStudentProfile();
  const [enrolledCoursesWithProgress, setEnrolledCoursesWithProgress] = useState<CourseWithProgress[]>([]);
  const [isCoursesLoading, setIsCoursesLoading] = useState(true);

  const refreshEnrolledCourses = useCallback(async () => {
    if (isProfileLoading) return;

    if (!user || !profile) {
      setEnrolledCoursesWithProgress([]);
      setIsCoursesLoading(false);
      return;
    }

    if (profile.enrollments.length === 0) {
      setEnrolledCoursesWithProgress([]);
      setIsCoursesLoading(false);
      return;
    }

    setIsCoursesLoading(true);
    try {
      const idToken = await user.getIdToken();
      const { courses } = await getEnrolledCoursesAction(idToken);
      setEnrolledCoursesWithProgress(mapEnrolledCoursesWithProgress(profile.enrollments, courses));
    } catch (error) {
      console.error('[EnrolledCourses] Failed to load courses:', error);
      setEnrolledCoursesWithProgress([]);
    } finally {
      setIsCoursesLoading(false);
    }
  }, [user, profile, isProfileLoading]);

  useEffect(() => {
    void refreshEnrolledCourses();
  }, [refreshEnrolledCourses]);

  const enrolledCourses = useMemo(
    () => enrolledCoursesWithProgress.map(({ progress, ...course }) => course as Course),
    [enrolledCoursesWithProgress]
  );

  return {
    user,
    profile,
    enrolledCourses,
    enrolledCoursesWithProgress,
    isLoading: isProfileLoading || isCoursesLoading,
    refreshEnrolledCourses,
  };
}
