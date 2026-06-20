'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@/firebase';
import { getTutorStudents } from '@/app/actions/tutor-data';
import { useTutorCourses } from './use-tutor-courses';
import { isQuotaError } from '@/lib/service-errors';
import { reportQuotaError } from '@/lib/feedback/quota-state';
import type { User } from '@/lib/db';

interface PaginationState {
  currentPage: number;
  pageSize: number;
  total: number;
}

interface UseTutorStudentsOptions {
  tutorId?: string;
  pageSize?: number;
  autoFetch?: boolean;
}

interface UseTutorStudentsReturn {
  students: User[];
  allStudents: User[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  pagination: PaginationState;
  goToPage: (pageNumber: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  searchStudents: (query: string) => User[];
}

export function useTutorStudents(
  options?: UseTutorStudentsOptions
): UseTutorStudentsReturn {
  const { user: currentUser } = useUser();
  const { courses } = useTutorCourses({ tutorId: options?.tutorId });

  const pageSize = options?.pageSize || 50;
  const autoFetch = options?.autoFetch !== false;

  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const tutorId = options?.tutorId || currentUser?.uid;

  const fetchStudents = useCallback(async () => {
    if (!tutorId || !currentUser || courses.length === 0) {
      if (courses.length === 0) {
        setAllStudents([]);
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const idToken = await currentUser.getIdToken(true);
      const courseIds = courses.map((course) => course.id);
      const aggregated: User[] = [];
      let cursor: string | null = null;
      let hasMore = true;
      let guard = 0;

      while (hasMore && guard < 50) {
        guard += 1;
        const result = await getTutorStudents(idToken, courseIds, 500, cursor);
        if (result.error) {
          throw new Error(result.error);
        }

        aggregated.push(...result.students);
        hasMore = result.hasMore;
        cursor = result.nextCursor;
        if (!cursor) break;
      }

      aggregated.sort((a, b) => {
        const aDate = a.enrollments?.[0]?.enrolledDate || '';
        const bDate = b.enrollments?.[0]?.enrolledDate || '';
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });

      setAllStudents(aggregated);
      setCurrentPage(1);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch students');
      setError(fetchError);
      if (isQuotaError(fetchError)) {
        reportQuotaError(fetchError);
      }
      console.error('[useTutorStudents] Fetch error:', fetchError);
    } finally {
      setIsLoading(false);
    }
  }, [tutorId, currentUser, courses]);

  useEffect(() => {
    if (autoFetch) {
      void fetchStudents();
    }
  }, [fetchStudents, autoFetch]);

  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const students = allStudents.slice(startIdx, endIdx);

  const goToPage = useCallback(
    (pageNumber: number) => {
      const maxPages = Math.ceil(allStudents.length / pageSize);
      if (pageNumber >= 1 && pageNumber <= maxPages) {
        setCurrentPage(pageNumber);
      }
    },
    [allStudents.length, pageSize]
  );

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  const searchStudents = useCallback(
    (query: string): User[] => {
      const lowerQuery = query.toLowerCase();
      return allStudents.filter(
        (student) =>
          student.name.toLowerCase().includes(lowerQuery) ||
          (student.email || '').toLowerCase().includes(lowerQuery)
      );
    },
    [allStudents]
  );

  const pagination: PaginationState = {
    currentPage,
    pageSize,
    total: allStudents.length,
  };

  return {
    students,
    allStudents,
    isLoading,
    error,
    refetch: fetchStudents,
    pagination,
    goToPage,
    nextPage,
    prevPage,
    searchStudents,
  };
}
