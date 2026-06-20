import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitReview } from './reviews';

// Mock admin dependencies
vi.mock('@/firebase/admin', () => ({
  adminDb: {
    doc: vi.fn(() => ({
      get: vi.fn(() => Promise.resolve({
        exists: true,
        data: () => ({ enrollments: [{ courseId: 'course-1' }] })
      }))
    })),
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        set: vi.fn(() => Promise.resolve())
      }))
    }))
  },
  adminAuth: {
    verifyIdToken: vi.fn(() => Promise.resolve({ uid: 'user-1' }))
  }
}));

describe('submitReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate input correctly', async () => {
    const result = await submitReview({
      courseId: '',
      rating: 5,
      text: 'Great course!'
    }, 'token');

    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Course ID is required');
  });

  it('should validate rating range', async () => {
    const result = await submitReview({
      courseId: 'course-1',
      rating: 6,
      text: 'Great course!'
    }, 'token');

    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Rating cannot exceed 5');
  });

  it('should validate minimum text length', async () => {
    const result = await submitReview({
      courseId: 'course-1',
      rating: 5,
      text: 'Hi'
    }, 'token');

    expect(result).toHaveProperty('error');
    expect(result.error).toContain('Review must be at least 10 characters');
  });
});