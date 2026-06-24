/**
 * @fileOverview Data Service for Course Marketplace.
 * Routes through the Python backend REST API.
 */

import type { Course, CourseBundle, CourseCategory } from './db';
import { logger } from '@/lib/logging';
import { apiFetch } from '@/lib/api-client';

function getCourseSubmissionErrors(course: Course): string[] {
  const errors: string[] = [];
  const totalLessons = course.sections?.flatMap(section => section.lessons).length || 0;

  if (!course.title || course.title === 'Untitled Course') {
    errors.push('Add a descriptive course title.');
  }

  if (!course.subtitle || course.subtitle.trim().length === 0) {
    errors.push('Add a course subtitle.');
  }

  if ((course.description?.length || 0) <= 100) {
    errors.push('Course description must be at least 100 characters.');
  }

  if (!course.imageUrl || course.imageUrl.trim().length === 0) {
    errors.push('Add a course thumbnail image.');
  }

  if (!course.instructor?.name || course.instructor.name.trim().length === 0) {
    errors.push('Set an instructor name for the course.');
  }

  if ((course.whatYoullLearn?.length || 0) < 3) {
    errors.push('Provide at least 3 learning objectives.');
  }

  if (totalLessons < 3) {
    errors.push('Add at least 3 lessons in the curriculum.');
  }

  if (course.isFree === false && (course.price || 0) <= 0) {
    errors.push('Set a valid price or mark the course as free.');
  }

  if (!course.program) {
    errors.push('Select a program for this course.');
  }

  if (!course.cat_id) {
    errors.push('Select a category for this course.');
  }

  return errors;
}

export const getCourses = async (): Promise<Course[]> => {
    try {
        const res = await apiFetch('/courses/');
        if (!res.ok) return [];
        const data = await res.json();
        return data.courses || [];
    } catch (error) {
        logger.error('[Course Data] Failed to fetch courses', { error });
        return [];
    }
};

export const getPublishedCourses = async (): Promise<Course[]> => {
    return getCourses();
};

export const getFeaturedCourses = async (limitCount: number = 4): Promise<Course[]> => {
    const courses = await getCourses();
    return courses.slice(0, limitCount);
};

export const getCoursesByIds = async (courseIds: string[]): Promise<Course[]> => {
    if (courseIds.length === 0) return [];

    const uniqueCourseIds = Array.from(new Set(courseIds.filter(Boolean)));
    const courses: Course[] = [];

    for (const id of uniqueCourseIds) {
        try {
            const res = await apiFetch(`/courses/${encodeURIComponent(id)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.course) courses.push(data.course);
            }
        } catch {
            // Skip failed fetches
        }
    }

    return courses;
};

export const getCoursesByTutorId = async (tutorId: string): Promise<Course[]> => {
    const courses = await getCourses();
    return courses.filter(c => c.tutorId === tutorId);
};

export const getCourseById = async (id: string): Promise<Course | undefined> => {
    if (!id) return undefined;

    try {
        const res = await apiFetch(`/courses/${encodeURIComponent(id)}`);
        if (!res.ok) return undefined;
        const data = await res.json();
        return data.course;
    } catch (error) {
        logger.error('[Course Data] Failed to fetch course', { courseId: id, error });
        return undefined;
    }
};

export const saveCourse = async (courseToSave: Course, _tutorId?: string): Promise<void> => {
    if (courseToSave.status === 'Under Review') {
        const submissionErrors = getCourseSubmissionErrors(courseToSave);
        if (submissionErrors.length > 0) {
            throw new Error(`Course is not ready for review: ${submissionErrors.join(' ')}`);
        }
    }

    try {
        await apiFetch(`/courses/${encodeURIComponent(courseToSave.id)}`, {
            method: 'PUT',
            body: JSON.stringify(courseToSave),
        });
    } catch (error) {
        logger.error('[Course Data] Failed to save course', { courseId: courseToSave.id, error });
        throw error;
    }
};

export const assignCourseToTutor = async (courseToAssign: Course, tutor: { id: string; name: string; avatar: string }): Promise<void> => {
    const updatedCourse: Course = {
        ...courseToAssign,
        tutorId: tutor.id,
        instructor: {
            name: tutor.name || courseToAssign.instructor?.name || 'Academic Expert',
            title: courseToAssign.instructor?.title || 'Instructor',
            avatar: tutor.avatar || courseToAssign.instructor?.avatar || '',
            bio: courseToAssign.instructor?.bio || '',
        },
        updatedAt: new Date().toISOString(),
    };
    await saveCourse(updatedCourse, tutor.id);
};

export const deleteCourse = async (id: string, _tutorId?: string): Promise<void> => {
    try {
        await apiFetch(`/courses/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (error) {
        logger.error('[Course Data] Failed to delete course', { courseId: id, error });
    }
};

export const getCategories = async (): Promise<CourseCategory[]> => {
    return [];
};

export const saveCategories = async (_categories: CourseCategory[]): Promise<void> => {};

export const getBundles = async (): Promise<CourseBundle[]> => {
    return [];
};

export const saveBundle = async (_bundle: CourseBundle): Promise<void> => {};

export const deleteBundle = async (_bundleId: string): Promise<void> => {};
