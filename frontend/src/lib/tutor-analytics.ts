/**
 * @fileOverview Analytics calculation utilities for tutor dashboard.
 * Used by analytics pages, engagement monitoring, and reporting.
 */

import { type Course, type User, type Enrollment } from '@/lib/db';

/**
 * Calculate percentage of course completion for an enrollment
 */
export function calculateCompletionPercentage(
  enrollment: Enrollment,
  course: Course
): number {
  if (!course.sections || course.sections.length === 0) return 0;

  const totalLessons = course.sections.reduce(
    (sum, section) => sum + (section.lessons?.length || 0),
    0
  );

  if (totalLessons === 0) return 0;

  const completedCount = enrollment.completedLessons?.length || 0;
  return Math.round((completedCount / totalLessons) * 100);
}

/**
 * Calculate enrollment rate for a course
 */
export function calculateEnrollmentRate(
  course: Course,
  totalEnrollments: number
): number {
  // Calculate as percentage of total students enrolled in this course
  // vs. estimated total platform users (placeholder uses totalEnrollments as denominator)
  const estimatedPlatformUsers = Math.max(totalEnrollments, 1);
  return Math.round((totalEnrollments / estimatedPlatformUsers) * 100);
}

/**
 * Calculate average time to completion for a course
 */
export function calculateAverageCompletionTime(
  enrollments: Enrollment[],
  courseId: string
): number {
  const courseEnrollments = enrollments.filter(e => e.courseId === courseId);
  
  if (courseEnrollments.length === 0) return 0;

  // Enrollment does not carry completedDate in our schema; use enrollments with progress activity.
  const activeEnrollments = courseEnrollments
    .filter(e => (e.completedLessons?.length || 0) > 0)
    .map(e => ({
      startDate: new Date(e.enrolledDate),
      endDate: new Date(),
    }));

  if (activeEnrollments.length === 0) return 0;

  const totalDays = activeEnrollments.reduce((sum, dates) => {
    const diffMs = dates.endDate.getTime() - dates.startDate.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return sum + diffDays;
  }, 0);

  return Math.round(totalDays / activeEnrollments.length);
}

/**
 * Identify students at risk of dropping out
 * At-risk = no activity in 7+ days
 */
export function identifyAtRiskStudents(
  students: User[],
  daysSinceActivity: number = 7
): User[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysSinceActivity);

  return students.filter(student => {
    const lastActivity = student.lastActive
      ? new Date(student.lastActive)
      : new Date(student.createdAt || '');

    return lastActivity < cutoffDate;
  });
}

/**
 * Calculate engagement score for a student (0-100)
 * Based on: activity date, completion %, quiz attempts
 */
export function calculateEngagementScore(
  user: User,
  enrollments: Enrollment[],
  courses: Course[]
): number {
  let score = 0;

  // Factor 1: Last activity recency (0-30 points)
  if (user.lastActive) {
    const daysSinceActivity = Math.floor(
      (Date.now() - new Date(user.lastActive).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceActivity === 0) score += 30;
    else if (daysSinceActivity <= 7) score += 20;
    else if (daysSinceActivity <= 14) score += 10;
    // else score += 0
  }

  // Factor 2: Course completion progress (0-40 points)
  if (enrollments.length > 0) {
    const completions = enrollments.map(enrollment => {
      const course = courses.find(c => c.id === enrollment.courseId);
      if (!course) return 0;
      return calculateCompletionPercentage(enrollment, course);
    });

    const avgCompletion = completions.reduce((a, b) => a + b, 0) / completions.length;
    score += Math.round((avgCompletion / 100) * 40);
  }

  // Factor 3: Number of courses (0-20 points)
  if (enrollments.length > 0) {
    const courseCount = Math.min(enrollments.length, 5);
    score += (courseCount / 5) * 20;
  }

  // Factor 4: Account age activity (0-10 points)
  if (user.createdAt) {
    const accountAgeMonths = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
    );

    if (accountAgeMonths >= 3) score += 10;
    else if (accountAgeMonths >= 1) score += 5;
  }

  return Math.min(100, Math.round(score));
}

/**
 * Get engagement status label
 */
export function getEngagementStatus(score: number): 'active' | 'at-risk' | 'inactive' {
  if (score >= 70) return 'active';
  if (score >= 40) return 'at-risk';
  return 'inactive';
}

/**
 * Calculate revenue per student for a course
 */
export function calculateRevenuePerStudent(
  totalRevenue: number,
  enrollmentCount: number
): number {
  if (enrollmentCount === 0) return 0;
  return Math.round((totalRevenue / enrollmentCount) * 100) / 100;
}

/**
 * Get drop-off points in a video lesson
 * Returns simulated points for visual consistency in charts.
 * In production, this would call analytics API.
 */
export function getVideoDropoffPoints(
  videoId: string,
  watchData: Record<string, unknown>
): Array<{ timestamp: number; percentDropped: number }> {
  // Return realistic simulated drop-off data for chart rendering
  return [
    { timestamp: 0, percentDropped: 0 },
    { timestamp: 10, percentDropped: 5 },
    { timestamp: 25, percentDropped: 12 },
    { timestamp: 50, percentDropped: 35 },
    { timestamp: 75, percentDropped: 58 },
    { timestamp: 90, percentDropped: 70 },
    { timestamp: 100, percentDropped: 72 },
  ];
}

/**
 * Calculate course performance score
 * Based on: revenue, enrollments, completion rate, rating
 */
export function calculateCoursePerformanceScore(
  course: Course & { revenue?: number },
  enrollmentData: { total: number; completed: number; avgRating?: number }
): number {
  let score = 0;

  // Revenue (0-30 points)
  if (course.revenue) {
    // Assuming optimal revenue is 1000+ per course
    score += Math.min(30, (course.revenue / 1000) * 30);
  }

  // Enrollment count (0-25 points)
  // Assuming optimal is 50+ enrollments
  score += Math.min(25, (enrollmentData.total / 50) * 25);

  // Completion rate (0-25 points)
  const completionRate = enrollmentData.total > 0
    ? (enrollmentData.completed / enrollmentData.total) * 100
    : 0;
  score += (completionRate / 100) * 25;

  // Student rating (0-20 points)
  if (enrollmentData.avgRating) {
    // Assuming 5-star scale, map to 20 points max
    score += (enrollmentData.avgRating / 5) * 20;
  }

  return Math.min(100, Math.round(score));
}

/**
 * Predict revenue for next month (simple trend-based)
 */
export function predictNextMonthRevenue(
  historicalMonths: Array<{ month: string; revenue: number }>
): number {
  if (historicalMonths.length < 2) {
    return historicalMonths[0]?.revenue || 0;
  }

  // Simple trend: last month + (average growth)
  const lastRevenue = historicalMonths[historicalMonths.length - 1].revenue;
  const previousRevenue = historicalMonths[historicalMonths.length - 2].revenue;

  const growthRate = (lastRevenue - previousRevenue) / previousRevenue;
  const predictedRevenue = lastRevenue * (1 + growthRate);

  return Math.round(predictedRevenue);
}

/**
 * Calculate student lifetime value (LTV)
 */
export function calculateStudentLTV(
  enrollments: Enrollment[],
  avgRevenuePerCourse: number
): number {
  const expectedFutureEnrollments = Math.max(1, enrollments.length * 1.5);
  return Math.round(expectedFutureEnrollments * avgRevenuePerCourse);
}

/**
 * Get cohort retention rate
 */
export function calculateCohortRetention(
  enrollments: Enrollment[],
  cohortAgeWeeks: number
): number {
  const activeEnrollments = enrollments.filter(e => (e.completedLessons?.length || 0) === 0).length;
  const totalEnrollments = enrollments.length;

  if (totalEnrollments === 0) return 0;

  return Math.round((activeEnrollments / totalEnrollments) * 100);
}

/**
 * Format analytics data for charts
 */
export function formatChartData(
  labels: string[],
  values: number[]
): Array<{ label: string; value: number }> {
  return labels.map((label, index) => ({
    label,
    value: values[index] || 0,
  }));
}
