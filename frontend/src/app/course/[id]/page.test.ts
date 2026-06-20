import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => {
  const getMock = vi.fn();
  const docMock = vi.fn(() => ({ get: getMock }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));
  const notFound = vi.fn(() => {
    const error = new Error('NEXT_NOT_FOUND');
    (error as Error & { digest: string }).digest = 'NEXT_HTTP_ERROR_FALLBACK;404';
    throw error;
  });

  return {
    getMock,
    docMock,
    collectionMock,
    notFound,
  };
});

vi.mock('next/navigation', () => ({
  notFound: routeMocks.notFound,
}));

vi.mock('@/firebase/admin', () => ({
  adminDb: {
    collection: routeMocks.collectionMock,
  },
}));

vi.mock('./course-detail-client', () => ({
  default: ({ courseId, isPreview }: { courseId: string; isPreview: boolean }) => ({
    courseId,
    isPreview,
  }),
}));

import CourseDetailPage from './page';

describe('course/[id] public route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns notFound when course document does not exist', async () => {
    routeMocks.getMock.mockResolvedValueOnce({
      exists: false,
      data: () => undefined,
    });

    await expect(
      CourseDetailPage({ params: Promise.resolve({ id: 'missing-course' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('returns notFound when course is not publicly readable', async () => {
    routeMocks.getMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'Draft' }),
    });

    await expect(
      CourseDetailPage({ params: Promise.resolve({ id: 'draft-course' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('renders course detail client when status is Published', async () => {
    routeMocks.getMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'Published' }),
    });

    const result = await CourseDetailPage({ params: Promise.resolve({ id: 'pub-course' }) });

    expect((result as any).props).toMatchObject({ courseId: 'pub-course', isPreview: false });
  });

  it('renders course detail client when status is lowercase published', async () => {
    routeMocks.getMock.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: 'published' }),
    });

    const result = await CourseDetailPage({ params: Promise.resolve({ id: 'pub-course-lower' }) });

    expect((result as any).props).toMatchObject({ courseId: 'pub-course-lower', isPreview: false });
  });
});
