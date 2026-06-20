import { describe, expect, it } from 'vitest';
import {
  getNewCourseEnrollments,
  getOrderDocumentId,
  parsePaystackMetadata,
  shouldProcessPaystackEvent,
} from './paystack-webhook';

describe('paystack webhook helpers', () => {
  it('processes only charge.success events', () => {
    expect(shouldProcessPaystackEvent('charge.success')).toBe(true);
    expect(shouldProcessPaystackEvent('transfer.success')).toBe(false);
    expect(shouldProcessPaystackEvent(undefined)).toBe(false);
  });

  it('builds deterministic order document ids', () => {
    expect(getOrderDocumentId('abc123')).toBe('ord-abc123');
    expect(getOrderDocumentId(undefined)).toBe('ord-unknown');
  });

  it('parses metadata from object and JSON string', () => {
    expect(parsePaystackMetadata({ userId: 'u1' })).toEqual({ userId: 'u1' });
    expect(parsePaystackMetadata('{"userId":"u2"}')).toEqual({ userId: 'u2' });
  });

  it('returns empty metadata object for invalid input', () => {
    expect(parsePaystackMetadata('not-json')).toEqual({});
    expect(parsePaystackMetadata(null)).toEqual({});
    expect(parsePaystackMetadata(undefined)).toEqual({});
  });

  it('builds new course enrollments excluding existing and duplicate course items', () => {
    const now = '2026-03-21T10:00:00.000Z';

    const result = getNewCourseEnrollments(
      [
        { id: 'course-1', type: 'course' },
        { id: 'course-1', type: 'course' },
        { id: 'course-2', type: 'course' },
        { id: 'prod-1', type: 'product' },
      ],
      [{ courseId: 'course-2', enrolledDate: now, completedLessons: [] }],
      now
    );

    expect(result).toEqual([
      {
        courseId: 'course-1',
        enrolledDate: now,
        completedLessons: [],
      },
    ]);
  });
});
