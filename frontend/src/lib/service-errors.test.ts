import { describe, it, expect } from 'vitest';
import {
  isQuotaError,
  normalizeServiceError,
  toUserFacingMessage,
} from './service-errors';

describe('normalizeServiceError', () => {
  it('maps Firestore resource-exhausted to quota', () => {
    const result = normalizeServiceError({ code: 'resource-exhausted', message: 'Quota exceeded.' });
    expect(result.kind).toBe('quota');
    expect(result.retryable).toBe(true);
    expect(result.title).toBe('Service busy');
  });

  it('maps auth/too-many-requests to quota', () => {
    const result = normalizeServiceError({
      code: 'auth/too-many-requests',
      message: 'We have blocked all requests from this device',
    });
    expect(result.kind).toBe('quota');
    expect(result.description).toContain('Too many attempts');
  });

  it('maps HTTP 429 to quota', () => {
    const result = normalizeServiceError({ status: 429, message: 'Rate limit exceeded' });
    expect(result.kind).toBe('quota');
  });

  it('maps Gemini overload messages to quota', () => {
    const result = normalizeServiceError(new Error('The model is overloaded. Please try again later.'));
    expect(result.kind).toBe('quota');
  });

  it('passes through unknown errors with original message', () => {
    const result = normalizeServiceError(new Error('Course not found'), { feature: 'Courses' });
    expect(result.kind).toBe('unknown');
    expect(result.description).toContain('Course not found');
    expect(result.description).toContain('Courses');
  });
});

describe('isQuotaError', () => {
  it('returns true for quota-shaped errors', () => {
    expect(isQuotaError({ code: 'resource-exhausted', message: 'Quota exceeded' })).toBe(true);
  });

  it('returns false for permission errors', () => {
    expect(isQuotaError({ code: 'permission-denied', message: 'Missing permissions' })).toBe(false);
  });
});

describe('toUserFacingMessage', () => {
  it('returns normalized description', () => {
    expect(toUserFacingMessage({ code: 'resource-exhausted', message: 'x' })).toContain(
      'temporarily busy'
    );
  });
});
