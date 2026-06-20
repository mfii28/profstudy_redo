import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(() => ({
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(),
  })),
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
}));

const loggerMocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('firebase/firestore', () => firestoreMocks);

vi.mock('@/firebase/firestore', () => ({
  db: {},
}));

vi.mock('@/lib/logging', () => ({
  logger: loggerMocks,
}));

vi.mock('@/firebase/error-emitter', () => ({
  errorEmitter: {
    emit: vi.fn(),
  },
}));

vi.mock('@/firebase/errors', () => ({
  FirestorePermissionError: class FirestorePermissionError extends Error {},
}));

import { getCourses } from './course-data';

describe('course-data getCourses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreMocks.collection.mockReturnValue({ kind: 'collection' });
    firestoreMocks.where.mockReturnValue({ kind: 'where' });
    firestoreMocks.query.mockReturnValue({ kind: 'query' });
  });

  it('returns courses when direct collection read succeeds', async () => {
    firestoreMocks.getDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'course-1',
          data: () => ({ title: 'Direct Read', status: 'Published' }),
        },
      ],
    });

    const result = await getCourses();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('course-1');
    expect(result[0].title).toBe('Direct Read');
  });

  it('falls back to published-only query when direct read is denied', async () => {
    firestoreMocks.getDocs
      .mockRejectedValueOnce({ code: 'permission-denied', message: 'denied' })
      .mockResolvedValueOnce({
        docs: [
          {
            id: 'course-2',
            data: () => ({ title: 'Published Fallback', status: 'published' }),
          },
        ],
      });

    const result = await getCourses();

    expect(firestoreMocks.where).toHaveBeenCalledWith('status', 'in', ['Published', 'published']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('course-2');
  });

  it('returns empty array when both direct and fallback reads fail', async () => {
    firestoreMocks.getDocs
      .mockRejectedValueOnce({ code: 'permission-denied', message: 'denied' })
      .mockRejectedValueOnce({ code: 'unavailable', message: 'fallback failed' });

    const result = await getCourses();

    expect(result).toEqual([]);
    expect(loggerMocks.error).toHaveBeenCalled();
  });
});
