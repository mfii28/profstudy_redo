import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock apiFetch before module imports
const mockApiFetch = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiFetch: mockApiFetch,
}));

describe('course-data', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getCourses returns empty array on fetch failure', async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: false });
    const { getCourses } = await import('./course-data');
    const result = await getCourses();
    expect(result).toEqual([]);
  });

  it('getCourses returns courses from API', async () => {
    const fakeCourses = [{ id: '1', title: 'Test Course' }];
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ courses: fakeCourses }),
    });
    const { getCourses } = await import('./course-data');
    const result = await getCourses();
    expect(result).toEqual(fakeCourses);
    expect(mockApiFetch).toHaveBeenCalledWith('/courses/');
  });

  it('getCourseById returns undefined when not found', async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: false });
    const { getCourseById } = await import('./course-data');
    const result = await getCourseById('nonexistent');
    expect(result).toBeUndefined();
  });

  it('getCourseById returns course from API', async () => {
    const fakeCourse = { id: '1', title: 'Test Course' };
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ course: fakeCourse }),
    });
    const { getCourseById } = await import('./course-data');
    const result = await getCourseById('1');
    expect(result).toEqual(fakeCourse);
    expect(mockApiFetch).toHaveBeenCalledWith('/courses/1');
  });
});
