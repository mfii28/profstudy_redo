import type { Course, Enrollment } from '@/lib/db';

export type CourseWithProgress = Course & { progress: number };

export const getCourseLessonCount = (course?: Course): number => {
  if (!course?.sections?.length) return 0;
  return course.sections.reduce((acc, section) => acc + (section.lessons?.length || 0), 0);
};

export const getEnrollmentProgress = (enrollment: Enrollment, course?: Course): number => {
  const totalLessons = getCourseLessonCount(course);
  if (totalLessons === 0) return 0;
  return Math.round(((enrollment.completedLessons?.length || 0) / totalLessons) * 100);
};

export const mapEnrolledCoursesWithProgress = (
  enrollments: Enrollment[] | undefined,
  courses: Course[]
): CourseWithProgress[] => {
  const enrolled = enrollments || [];
  const courseMap = new Map(courses.map((course) => [course.id, course]));

  return enrolled
    .map((enrollment) => {
      const course = courseMap.get(enrollment.courseId);
      if (!course) return null;

      return {
        ...course,
        progress: getEnrollmentProgress(enrollment, course),
      };
    })
    .filter(Boolean) as CourseWithProgress[];
};

export const getEnrollmentCompletionStats = (
  enrollments: Enrollment[] | undefined,
  courses: Course[]
) => {
  const enrolled = enrollments || [];
  const courseMap = new Map(courses.map((course) => [course.id, course]));

  const coursesCompleted = enrolled.reduce((count, enrollment) => {
    const course = courseMap.get(enrollment.courseId);
    const totalLessons = getCourseLessonCount(course);
    if (totalLessons === 0) return count;
    return (enrollment.completedLessons?.length || 0) >= totalLessons ? count + 1 : count;
  }, 0);

  const totalCourses = enrolled.length;
  return {
    coursesCompleted,
    totalCourses,
    completionRate: totalCourses > 0 ? Math.round((coursesCompleted / totalCourses) * 100) : 0,
  };
};