import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mocks (hoisted) ─────────────────────────────────────────────────────────

vi.mock('@/firebase/admin', () => {
  const get = vi.fn();
  const update = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockResolvedValue(undefined);
  const del = vi.fn().mockResolvedValue(undefined);

  const subDocRef = { get, set, update, delete: del };
  const subColRef: Record<string, unknown> = {
    doc: vi.fn().mockReturnValue(subDocRef),
    get,
  };
  subColRef.orderBy = vi.fn().mockReturnValue(subColRef);
  subColRef.limit = vi.fn().mockReturnValue(subColRef);
  subColRef.startAfter = vi.fn().mockReturnValue(subColRef);

  const outerDoc = vi.fn().mockReturnValue({
    collection: vi.fn().mockReturnValue(subColRef),
    get,
    set,
    update,
    delete: del,
  });

  const outerCol = vi.fn().mockReturnValue({
    doc: vi.fn().mockReturnValue({
      collection: vi.fn().mockReturnValue(subColRef),
      get,
      set,
      update,
      delete: del,
    }),
    get,
  });

  return {
    adminDb: { doc: outerDoc, collection: outerCol },
    FieldValue: {
      arrayUnion: (...args: unknown[]) => ({ _union: args }),
      arrayRemove: (...args: unknown[]) => ({ _remove: args }),
      increment: (n: number) => ({ _inc: n }),
    },
    __get: get,
    __update: update,
    __set: set,
    __del: del,
    __subDocGet: subDocRef.get,
    __subColGet: subColRef.get,
  };
});

vi.mock('@/lib/logging', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import {
  enrollUserInCourses,
  enrollUserInCourse,
  removeUserFromCourse,
  isUserEnrolled,
  listEnrolledUsers,
} from './enrollment-manager';
import * as adminMod from '@/firebase/admin';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function notEnrolled() {
  return { exists: false, data: () => undefined };
}
function enrolled(courseId = 'course-a') {
  return { exists: true, data: () => ({ courseId }) };
}
function userWithEnrollments(ids: string[]) {
  return {
    exists: true,
    data: () => ({
      enrollments: ids.map((c) => ({ courseId: c, enrolledDate: '2026-01-01T00:00:00.000Z', completedLessons: [] })),
    }),
  };
}

function getMocks() {
  const m = adminMod as unknown as Record<string, ReturnType<typeof vi.fn>>;
  return {
    get: m.__get,
    update: m.__update,
    set: m.__set,
    del: m.__del,
    subDocGet: m.__subDocGet,
    subColGet: m.__subColGet,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('EnrollmentManager', () => {
  let m: ReturnType<typeof getMocks>;

  beforeEach(() => {
    vi.clearAllMocks();
    m = getMocks();
    m.get.mockResolvedValue(notEnrolled());
    m.subDocGet.mockResolvedValue(notEnrolled());
    m.update.mockResolvedValue(undefined);
    m.set.mockResolvedValue(undefined);
    m.del.mockResolvedValue(undefined);
  });

  describe('enrollUserInCourses (bulk)', () => {
    it('returns results array with one entry per unique course', async () => {
      const result = await enrollUserInCourses('user-1', ['course-a', 'course-b']);
      expect(result.results).toHaveLength(2);
      expect(result.enrolledCount + result.skippedCount + result.failedCount).toBe(2);
    });

    it('deduplicates courseIds before processing', async () => {
      const result = await enrollUserInCourses('user-1', ['course-a', 'course-a', 'course-b']);
      expect(result.courseIds).toHaveLength(2);
    });

    it('skips already-enrolled courses and increments skippedCount', async () => {
      m.subDocGet
        .mockResolvedValueOnce(enrolled('course-a'))
        .mockResolvedValueOnce(notEnrolled());

      const result = await enrollUserInCourses('user-1', ['course-a', 'course-b']);
      expect(result.skippedCount).toBe(1);
      const skipped = result.results.find((r) => r.courseId === 'course-a');
      expect(skipped?.alreadyEnrolled).toBe(true);
    });

    it('returns empty results for empty courseIds list', async () => {
      const result = await enrollUserInCourses('user-1', []);
      expect(result.results).toHaveLength(0);
      expect(result.enrolledCount).toBe(0);
    });

    it('returns error results and failedCount for invalid userId', async () => {
      const result = await enrollUserInCourses('', ['course-a']);
      expect(result.failedCount).toBe(1);
      expect(result.results[0].error).toBeDefined();
    });

    it('captures per-course error without blocking siblings', async () => {
      m.subDocGet.mockResolvedValue(notEnrolled());
      m.update
        .mockRejectedValueOnce(new Error('Firestore write failed'))
        .mockResolvedValue(undefined);

      const result = await enrollUserInCourses('user-1', ['course-a', 'course-b']);
      expect(result.results).toHaveLength(2);
      const failed = result.results.find((r) => r.courseId === 'course-a');
      expect(failed?.success).toBe(false);
      expect(failed?.error).toBeDefined();
    });
  });

  describe('enrollUserInCourse (single)', () => {
    it('resolves with alreadyEnrolled:false on first enrollment', async () => {
      m.subDocGet.mockResolvedValue(notEnrolled());
      const result = await enrollUserInCourse('user-1', 'course-a', 'admin');
      expect(result.alreadyEnrolled).toBe(false);
    });

    it('resolves with alreadyEnrolled:true when already enrolled', async () => {
      m.subDocGet.mockResolvedValue(enrolled());
      const result = await enrollUserInCourse('user-1', 'course-a', 'admin');
      expect(result.alreadyEnrolled).toBe(true);
    });

    it('throws when Firestore write fails', async () => {
      m.subDocGet.mockResolvedValue(notEnrolled());
      m.update.mockRejectedValue(new Error('Permission denied'));
      await expect(enrollUserInCourse('user-1', 'course-a', 'admin')).rejects.toThrow('Permission denied');
    });
  });

  describe('removeUserFromCourse', () => {
    it('resolves without error for enrolled user', async () => {
      m.get.mockResolvedValue(userWithEnrollments(['course-a']));
      await expect(removeUserFromCourse('user-1', 'course-a')).resolves.not.toThrow();
    });

    it('is idempotent when user is not enrolled', async () => {
      m.get.mockResolvedValue(userWithEnrollments([]));
      await expect(removeUserFromCourse('user-1', 'course-x')).resolves.not.toThrow();
    });

    it('silently skips for empty userId', async () => {
      await expect(removeUserFromCourse('', 'course-a')).resolves.not.toThrow();
    });

    it('silently skips for empty courseId', async () => {
      await expect(removeUserFromCourse('user-1', '')).resolves.not.toThrow();
    });
  });

  describe('isUserEnrolled', () => {
    it('returns true when member doc exists', async () => {
      m.subDocGet.mockResolvedValue(enrolled());
      expect(await isUserEnrolled('user-1', 'course-a')).toBe(true);
    });

    it('returns false when member doc does not exist', async () => {
      m.subDocGet.mockResolvedValue(notEnrolled());
      expect(await isUserEnrolled('user-1', 'course-a')).toBe(false);
    });

    it('returns false for empty userId', async () => {
      expect(await isUserEnrolled('', 'course-a')).toBe(false);
    });

    it('returns false for empty courseId', async () => {
      expect(await isUserEnrolled('user-1', '')).toBe(false);
    });
  });

  describe('listEnrolledUsers', () => {
    it('returns empty result for empty courseId', async () => {
      const result = await listEnrolledUsers('');
      expect(result.userIds).toHaveLength(0);
      expect(result.nextCursor).toBeNull();
    });

    it('returns null nextCursor when page is not full', async () => {
      m.subColGet.mockResolvedValue({ docs: [{ id: 'user-1' }] });
      const result = await listEnrolledUsers('course-a', { limit: 10 });
      expect(result.nextCursor).toBeNull(); // 1 result < 10 limit
    });

    it('returns nextCursor equal to last doc id when page is full', async () => {
      const docs = [{ id: 'user-1' }, { id: 'user-2' }];
      m.subColGet.mockResolvedValue({ docs });
      const result = await listEnrolledUsers('course-a', { limit: 2 });
      expect(result.nextCursor).toBe('user-2');
    });
  });


  describe('Classroom sync (non-blocking)', () => {
    it('does not propagate classroom sync errors to the caller', async () => {
      // Make classroom exist so syncClassroom takes the update path (not set),
      // then fail that update — it should be swallowed as fire-and-forget.
      m.subDocGet.mockResolvedValue(notEnrolled());
      m.get.mockResolvedValue({ exists: true, data: () => ({}) }); // classroom exists
      m.set.mockResolvedValue(undefined); // enrollment index set calls succeed
      m.update
        .mockResolvedValueOnce(undefined)          // user.enrollments arrayUnion
        .mockRejectedValue(new Error('Classroom update failed')); // fire-and-forget

      await expect(enrollUserInCourse('user-1', 'course-a', 'paystack')).resolves.not.toThrow();
    });
  });
});
