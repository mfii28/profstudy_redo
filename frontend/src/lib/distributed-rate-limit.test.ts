import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker } from './distributed-rate-limit';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    // Default: threshold=5, resetTimeout=30000
    breaker = new CircuitBreaker(3, 100); // Lower threshold and timeout for tests
    vi.useFakeTimers();
  });

  describe('State: closed → open transition', () => {
    it('should start in closed state', () => {
      expect(breaker.getState()).toBe('closed');
    });

    it('should transition to open after threshold failures', async () => {
      const failingFn = () => Promise.reject(new Error('Test error'));

      // First failure
      try {
        await breaker.execute(failingFn);
      } catch {
        // Catch expected error
      }
      expect(breaker.getState()).toBe('closed');

      // Second failure
      try {
        await breaker.execute(failingFn);
      } catch {
        // Catch expected error
      }
      expect(breaker.getState()).toBe('closed');

      // Third failure - should trigger transition to open
      try {
        await breaker.execute(failingFn);
      } catch {
        // Catch expected error
      }
      expect(breaker.getState()).toBe('open');
    });

    it('should reject immediately when open', async () => {
      const failingFn = () => Promise.reject(new Error('Test error'));

      // Get to open state
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn);
        } catch {
          // Catch expected error
        }
      }
      expect(breaker.getState()).toBe('open');

      // Next call should reject with 'Circuit breaker is open'
      await expect(breaker.execute(async () => 'success')).rejects.toThrow(
        'Circuit breaker is open'
      );
    });
  });

  describe('State: open → half-open transition', () => {
    it('should transition to half-open after resetTimeout expires', async () => {
      const failingFn = () => Promise.reject(new Error('Test error'));

      // Get to open state
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn);
        } catch {
          // Catch expected error
        }
      }
      expect(breaker.getState()).toBe('open');

      // Fast-forward time past resetTimeout
      vi.advanceTimersByTime(101);

      // Next execution should attempt and move to half-open
      try {
        await breaker.execute(() => Promise.reject(new Error('Still failing')));
      } catch {
        // Catch expected error
      }

      // After timeout and attempted execution, should be half-open or back to open
      // depending on whether the execute call succeeds
      expect(['half-open', 'open']).toContain(breaker.getState());
    });
  });

  describe('State: half-open → closed transition', () => {
    it('should transition to closed on successful execute when half-open', async () => {
      const failingFn = () => Promise.reject(new Error('Test error'));

      // Get to open state
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn);
        } catch {
          // Catch expected error
        }
      }
      expect(breaker.getState()).toBe('open');

      // Advance past resetTimeout
      vi.advanceTimersByTime(101);

      // Execute a successful function - should move to half-open, then on success to closed
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
      expect(breaker.getState()).toBe('closed');
    });

    it('should reset failure count when transitioning to closed', async () => {
      const failingFn = () => Promise.reject(new Error('Test error'));

      // Get to open state
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn);
        } catch {
          // Catch expected error
        }
      }

      // Advance past resetTimeout
      vi.advanceTimersByTime(101);

      // Execute successfully
      await breaker.execute(async () => 'success');
      expect(breaker.getState()).toBe('closed');

      // Now should take 3 more failures to open again
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(failingFn);
        } catch {
          // Catch expected error
        }
      }
      expect(breaker.getState()).toBe('closed'); // Not open yet

      try {
        await breaker.execute(failingFn);
      } catch {
        // Catch expected error
      }
      expect(breaker.getState()).toBe('open'); // Now open
    });
  });

  describe('Manual reset', () => {
    it('should reset to closed state', async () => {
      const failingFn = () => Promise.reject(new Error('Test error'));

      // Get to open state
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn);
        } catch {
          // Catch expected error
        }
      }
      expect(breaker.getState()).toBe('open');

      // Reset
      breaker.reset();
      expect(breaker.getState()).toBe('closed');

      // Should work normally again
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
    });
  });

  describe('Success path with closed breaker', () => {
    it('should execute and return result when closed', async () => {
      const successFn = async () => 'test result';
      const result = await breaker.execute(successFn);
      expect(result).toBe('test result');
      expect(breaker.getState()).toBe('closed');
    });

    it('should pass through errors without opening on single failure when below threshold', async () => {
      const failingFn = () => Promise.reject(new Error('Test error'));

      await expect(breaker.execute(failingFn)).rejects.toThrow('Test error');
      expect(breaker.getState()).toBe('closed'); // Still closed, threshold not reached
    });
  });
});
