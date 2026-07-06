import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => {
  const apiFetchServerMock = vi.fn();
  const notFound = vi.fn(() => {
    const error = new Error('NEXT_HTTP_ERROR_FALLBACK;404');
    (error as Error & { digest: string }).digest = 'NEXT_HTTP_ERROR_FALLBACK;404';
    throw error;
  });

  return {
    apiFetchServerMock,
    notFound,
  };
});

vi.mock('next/navigation', () => ({
  notFound: routeMocks.notFound,
}));

vi.mock('@/lib/api-client.server', () => ({
  apiFetchServer: routeMocks.apiFetchServerMock,
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
    routeMocks.apiFetchServerMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(
      CourseDetailPage({ params: Promise.resolve({ id: 'missing-course' }) })
    ).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });

  it('returns notFound when course is not publicly readable', async () => {
    routeMocks.apiFetchServerMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ course: { status: 'Draft' } }),
    });

    await expect(
      CourseDetailPage({ params: Promise.resolve({ id: 'draft-course' }) })
    ).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  });

  it('renders course detail client when status is Published', async () => {
    routeMocks.apiFetchServerMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ course: { status: 'Published' } }),
    });

    const result = await CourseDetailPage({ params: Promise.resolve({ id: 'pub-course' }) });

    expect((result as any).props).toMatchObject({ courseId: 'pub-course', isPreview: false });
  });

  it('renders course detail client when status is lowercase published', async () => {
    routeMocks.apiFetchServerMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ course: { status: 'published' } }),
    });

    const result = await CourseDetailPage({ params: Promise.resolve({ id: 'pub-course-lower' }) });

    expect((result as any).props).toMatchObject({ courseId: 'pub-course-lower', isPreview: false });
  });
});
