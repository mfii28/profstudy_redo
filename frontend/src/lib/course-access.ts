export type AdminRole = 'admin' | 'superadmin' | 'subadmin';

export type CourseAccessContext = {
  role?: string;
  courseTutorId?: string;
  userId?: string;
  courseStatus?: string;
};

export function isPublishedCourseStatus(status?: string): boolean {
  return (status || '').toLowerCase() === 'published';
}

export function isAdminRole(role?: string): role is AdminRole {
  return role === 'admin' || role === 'superadmin' || role === 'subadmin';
}

export function canAccessCoursePreview(context: CourseAccessContext): boolean {
  const { role, courseTutorId, userId, courseStatus } = context;

  if (isAdminRole(role)) {
    return true;
  }

  if (courseTutorId && userId && courseTutorId === userId) {
    return true;
  }

  return isPublishedCourseStatus(courseStatus);
}

export function canReadCoursePublicly(courseStatus?: string): boolean {
  return isPublishedCourseStatus(courseStatus);
}
