import { describe, it, expect, vi, beforeEach } from 'vitest';

const listAllCourseEnrollmentUserIds = vi.fn();
const getAll = vi.fn();
const getTrustedServerContextFromIdToken = vi.fn();

vi.mock('@/lib/enrollment-index', () => ({
  listAllCourseEnrollmentUserIds,
}));

vi.mock('@/firebase/admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn((id: string) => ({ id, path: `users/${id}` })),
    })),
    getAll: (...args: unknown[]) => getAll(...args),
  },
}));

vi.mock('@/lib/trusted-server-context', () => ({
  getTrustedServerContextFromIdToken,
  isAdminRole: (role: string) => role === 'admin' || role === 'superadmin' || role === 'subadmin',
}));

describe('getTutorStudents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTrustedServerContextFromIdToken.mockResolvedValue({
      success: true,
      userId: 'tutor-1',
      role: 'tutor',
    });
  });

  it('dedupes students across more than ten courses', async () => {
    const courseIds = Array.from({ length: 12 }, (_, index) => `course-${index + 1}`);
    const sharedStudents = Array.from({ length: 120 }, (_, index) => `student-${index + 1}`);

    listAllCourseEnrollmentUserIds.mockImplementation(async (courseId: string) => {
      if (courseId === 'course-1') return sharedStudents;
      return [`extra-${courseId}`];
    });

    getAll.mockImplementation(async (...refs: Array<{ id: string }>) =>
      refs.map((ref) => ({
        exists: true,
        id: ref.id,
        data: () => ({
          id: ref.id,
          name: ref.id,
          email: `${ref.id}@example.com`,
          role: 'student',
          enrollments: [{ courseId: 'course-1', enrolledDate: '2026-01-01' }],
        }),
      }))
    );

    const { getTutorStudents } = await import('@/app/actions/tutor-data');
    const firstPage = await getTutorStudents('token', courseIds, 50);

    expect(firstPage.error).toBeUndefined();
    expect(firstPage.students).toHaveLength(50);
    expect(firstPage.hasMore).toBe(true);
    expect(listAllCourseEnrollmentUserIds).toHaveBeenCalledTimes(12);

    const secondPage = await getTutorStudents(
      'token',
      courseIds,
      50,
      firstPage.nextCursor
    );

    expect(secondPage.students.length).toBeGreaterThan(0);
    expect(secondPage.students[0]?.id).not.toBe(firstPage.students[0]?.id);
  });
});
