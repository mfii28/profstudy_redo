'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { getCoursesByTutorId } from '@/lib/course-data';
import type { Course } from '@/lib/db';

interface UseTutorCoursesOptions {
  tutorId?: string;
  includeArchived?: boolean;
}

interface UseTutorCoursesReturn {
  courses: Course[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  getCourseById: (courseId: string) => Course | undefined;
  getCoursesByStatus: (status: string) => Course[];
}

/**
 * Shared hook for fetching tutor's courses with memoization.
 * Prevents duplicate queries across multiple pages.
 * 
 * USAGE:
 * const { courses, isLoading } = useTutorCourses();
 * 
 * or with specific tutor:
 * const { courses, isLoading } = useTutorCourses({ tutorId: 'user-123' });
 * 
 * @returns Tutor's courses with loading/error states and utility methods
 */
export function useTutorCourses(options?: UseTutorCoursesOptions): UseTutorCoursesReturn {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const tutorId = options?.tutorId || currentUser?.uid;

  const fetchCourses = useCallback(async () => {
    if (!tutorId || !firestore) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const data = await getCoursesByTutorId(tutorId);
      
      // Filter archived if needed
      const filtered = options?.includeArchived
        ? data
        : data.filter(c => String(c.status || '') !== 'Archived');
      
      setCourses(filtered);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch courses');
      setError(error);
      console.error('[useTutorCourses] Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [tutorId, firestore, options?.includeArchived]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Utility: Get single course by ID
  const getCourseById = useCallback((courseId: string): Course | undefined => {
    return courses.find(c => c.id === courseId);
  }, [courses]);

  // Utility: Filter courses by status
  const getCoursesByStatus = useCallback((status: string): Course[] => {
    return courses.filter(c => c.status === status);
  }, [courses]);

  return {
    courses,
    isLoading,
    error,
    refetch: fetchCourses,
    getCourseById,
    getCoursesByStatus,
  };
}
