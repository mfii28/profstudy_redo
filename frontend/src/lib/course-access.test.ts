import { describe, expect, it } from 'vitest';
import {
  canAccessCoursePreview,
  canReadCoursePublicly,
  isAdminRole,
  isPublishedCourseStatus,
} from './course-access';

describe('course access policy', () => {
  it('treats published status as publicly visible (case-insensitive)', () => {
    expect(isPublishedCourseStatus('Published')).toBe(true);
    expect(isPublishedCourseStatus('published')).toBe(true);
    expect(isPublishedCourseStatus('PUBLISHED')).toBe(true);
    expect(isPublishedCourseStatus('Draft')).toBe(false);
  });

  it('recognizes all admin roles', () => {
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('superadmin')).toBe(true);
    expect(isAdminRole('subadmin')).toBe(true);
    expect(isAdminRole('student')).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });

  it('allows preview for admin roles regardless of publication status', () => {
    expect(
      canAccessCoursePreview({
        role: 'admin',
        courseTutorId: 'tutor-1',
        userId: 'user-1',
        courseStatus: 'Draft',
      })
    ).toBe(true);

    expect(
      canAccessCoursePreview({
        role: 'subadmin',
        courseTutorId: 'tutor-1',
        userId: 'user-2',
        courseStatus: 'Rejected',
      })
    ).toBe(true);
  });

  it('allows preview for owner tutor on unpublished courses', () => {
    expect(
      canAccessCoursePreview({
        role: 'tutor',
        courseTutorId: 'tutor-1',
        userId: 'tutor-1',
        courseStatus: 'Under Review',
      })
    ).toBe(true);
  });

  it('allows preview for published courses even for non-owner non-admin users', () => {
    expect(
      canAccessCoursePreview({
        role: 'student',
        courseTutorId: 'tutor-1',
        userId: 'student-1',
        courseStatus: 'Published',
      })
    ).toBe(true);
  });

  it('denies preview for non-admin non-owner when course is unpublished', () => {
    expect(
      canAccessCoursePreview({
        role: 'student',
        courseTutorId: 'tutor-1',
        userId: 'student-1',
        courseStatus: 'Draft',
      })
    ).toBe(false);
  });

  it('only allows public read for published courses', () => {
    expect(canReadCoursePublicly('Published')).toBe(true);
    expect(canReadCoursePublicly('published')).toBe(true);
    expect(canReadCoursePublicly('Under Review')).toBe(false);
    expect(canReadCoursePublicly(undefined)).toBe(false);
  });
});
