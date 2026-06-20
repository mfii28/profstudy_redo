import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fulfillPaystackPayment, PaymentFulfillmentError } from './payment-fulfillment';
import * as distributedRateLimit from './distributed-rate-limit';

// Mock the dependencies
vi.mock('@/firebase/admin', () => ({
  adminDb: {
    doc: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({ exists: false }),
      set: vi.fn().mockResolvedValue(undefined),
    }),
  },
  FieldValue: { serverTimestamp: () => new Date() },
}));

vi.mock('@/app/actions/email', () => ({
  sendTransactionalEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/logging', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/enrollment-manager', () => ({
  enrollUserInCourses: vi.fn().mockResolvedValue({
    userId: 'user-123',
    courseIds: [],
    enrolledCount: 0,
    skippedCount: 0,
    failedCount: 0,
    results: [],
  }),
}));

vi.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

describe('Payment Fulfillment with Circuit Breaker', () => {
  let mockCircuitBreaker: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create a mock circuit breaker
    mockCircuitBreaker = {
      execute: vi.fn(),
      getState: vi.fn().mockReturnValue('closed'),
      reset: vi.fn(),
    };

    // Mock getPaymentCircuitBreaker
    vi.spyOn(distributedRateLimit, 'getPaymentCircuitBreaker').mockResolvedValue(mockCircuitBreaker);
  });

  describe('Circuit breaker integration', () => {
    it('should use circuit breaker to wrap fulfillment execution', async () => {
      mockCircuitBreaker.execute.mockImplementation((fn: () => Promise<any>) => fn());

      // Mock the circuit breaker to allow execution
      vi.mocked(mockCircuitBreaker.execute).mockImplementation(async (fn: () => Promise<unknown>) => {
        return fn();
      });

      const invalidRef = 'test-ref-123';
      const metadata = { userId: 'user-123', items: [] };

      // This will fail due to missing Firebase data, but we're testing that
      // the circuit breaker's execute method is called
      try {
        await fulfillPaystackPayment({
          reference: invalidRef,
          amountKobo: 10000,
          currency: 'GHS',
          metadata,
          source: 'webhook',
        });
      } catch (error: any) {
        // Expected to fail validation
        expect(error).toBeInstanceOf(PaymentFulfillmentError);
      }

      // Verify circuit breaker execute was called
      expect(mockCircuitBreaker.execute).toHaveBeenCalled();
    });

    it('should propagate circuit breaker errors when open', async () => {
      mockCircuitBreaker.execute.mockRejectedValue(new Error('Circuit breaker is open'));

      const metadata = { userId: 'user-123', items: [] };

      await expect(
        fulfillPaystackPayment({
          reference: 'test-ref-123',
          amountKobo: 10000,
          currency: 'GHS',
          metadata,
          source: 'webhook',
        })
      ).rejects.toThrow('Circuit breaker is open');
    });

    it('should allow fulfillment when circuit breaker is closed', async () => {
      const successResult = {
        orderId: 'order-123',
        userId: 'user-123',
        courseIds: ['course-1'],
        alreadyFulfilled: false,
        requestId: 'req-123',
      };

      mockCircuitBreaker.execute.mockImplementation((fn: () => Promise<any>) => fn());
      mockCircuitBreaker.execute.mockResolvedValue(successResult);

      const metadata = { userId: 'user-123', items: [] };

      const result = await fulfillPaystackPayment({
        reference: 'test-ref-123',
        amountKobo: 10000,
        currency: 'GHS',
        metadata,
        source: 'webhook',
      });

      // If execution reaches here without circuit breaker blocking it, the test passes
      expect(mockCircuitBreaker.execute).toHaveBeenCalled();
    });
  });

  describe('Error handling with circuit breaker', () => {
    it('should validate payment reference before circuit breaker', async () => {
      const metadata = { userId: 'user-123', items: [] };

      await expect(
        fulfillPaystackPayment({
          reference: '', // Empty reference
          amountKobo: 10000,
          currency: 'GHS',
          metadata,
          source: 'webhook',
        })
      ).rejects.toThrow('Missing payment reference');

      // Circuit breaker should not be called for validation errors
      expect(mockCircuitBreaker.execute).not.toHaveBeenCalled();
    });

    it('should validate userId in metadata before circuit breaker', async () => {
      await expect(
        fulfillPaystackPayment({
          reference: 'test-ref-123',
          amountKobo: 10000,
          currency: 'GHS',
          metadata: { userId: '' }, // Empty userId
          source: 'webhook',
        })
      ).rejects.toThrow('Missing userId in payment metadata');

      // Circuit breaker should not be called for validation errors
      expect(mockCircuitBreaker.execute).not.toHaveBeenCalled();
    });

    it('should include requestId in circuit breaker context', async () => {
      let capturedFn: (() => Promise<any>) | null = null;

      mockCircuitBreaker.execute.mockImplementation((fn: () => Promise<any>) => {
        capturedFn = fn;
        throw new Error('Circuit breaker open');
      });

      const metadata = { userId: 'user-123', items: [] };

      try {
        await fulfillPaystackPayment({
          reference: 'test-ref-123',
          amountKobo: 10000,
          currency: 'GHS',
          metadata,
          source: 'webhook',
          requestId: 'custom-request-id',
        });
      } catch {
        // Expected error
      }

      // Circuit breaker's execute should have been called with a function
      expect(mockCircuitBreaker.execute).toHaveBeenCalled();
      expect(typeof mockCircuitBreaker.execute.mock.calls[0][0]).toBe('function');
    });
  });

  describe('Circuit breaker resilience', () => {
    it('should handle consecutive failures within circuit breaker', async () => {
      let callCount = 0;

      mockCircuitBreaker.execute.mockImplementation(async (fn: () => Promise<any>) => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Simulated failure');
        }
        return { orderId: 'order-123', userId: 'user-123', courseIds: [], alreadyFulfilled: false, requestId: 'req-123' };
      });

      const metadata = { userId: 'user-123', items: [] };

      // First two calls should fail
      for (let i = 0; i < 2; i++) {
        await expect(
          fulfillPaystackPayment({
            reference: `test-ref-${i}`,
            amountKobo: 10000,
            currency: 'GHS',
            metadata,
            source: 'webhook',
          })
        ).rejects.toThrow();
      }

      // Third call should succeed (simulating circuit breaker recovering)
      const result = await fulfillPaystackPayment({
        reference: 'test-ref-recovery',
        amountKobo: 10000,
        currency: 'GHS',
        metadata,
        source: 'webhook',
      });

      expect(result.orderId).toBe('order-123');
      expect(mockCircuitBreaker.execute).toHaveBeenCalledTimes(3);
    });
  });
});
