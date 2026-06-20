import { logger } from './logging';

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private readonly threshold: number;
  private readonly resetTimeout: number;

  constructor(threshold = 5, resetTimeout = 30000) {
    this.threshold = threshold;
    this.resetTimeout = resetTimeout;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailure >= this.resetTimeout) {
        this.state = 'half-open';
        logger.info('[CircuitBreaker] Moving to half-open state');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
        logger.info('[CircuitBreaker] Circuit closed');
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailure = Date.now();
      if (this.failures >= this.threshold) {
        this.state = 'open';
        logger.error('[CircuitBreaker] Circuit opened', { failures: this.failures });
      }
      throw error;
    }
  }

  getState() {
    return this.state;
  }

  reset() {
    this.state = 'closed';
    this.failures = 0;
  }
}

export async function checkDistributedRateLimit(
  ip: string,
  bucket: string,
  maxRequests: number,
  windowMs: number = 60000
): Promise<RateLimitResult | null> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  const key = `ratelimit:${bucket}:${ip}`;
  const windowSec = Math.ceil(windowMs / 1000);

  try {
    const response = await fetch(`${UPSTASH_REDIS_REST_URL}/incr/${key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
      body: JSON.stringify({ exat: '+' + windowSec }),
    });

    if (!response.ok) {
      logger.warn('[RateLimit] Redis incr failed', { status: response.status });
      return null;
    }

    const data = await response.json() as { result?: number };
    const count = data.result || 1;

    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetAt: Date.now() + windowMs,
    };
  } catch (error) {
    logger.warn('[RateLimit] Redis error', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return null;
  }
}

export async function getRateLimitStatus(
  ip: string,
  bucket: string,
  windowMs: number = 60000
): Promise<{ count: number; resetAt: number } | null> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  const key = `ratelimit:${bucket}:${ip}`;

  try {
    const response = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { result?: string };
    if (!data.result) {
      return { count: 0, resetAt: 0 };
    }

    const ttlResponse = await fetch(`${UPSTASH_REDIS_REST_URL}/ttl/${key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
    });

    const ttlData = await ttlResponse.json() as { result?: number };
    const ttl = ttlData.result || 0;

    return {
      count: parseInt(data.result, 10) || 0,
      resetAt: ttl > 0 ? Date.now() + ttl * 1000 : 0,
    };
  } catch {
    return null;
  }
}

let paymentCircuitBreaker: CircuitBreaker | null = null;
let zoomCircuitBreaker: CircuitBreaker | null = null;

export async function getPaymentCircuitBreaker(): Promise<CircuitBreaker> {
  if (!paymentCircuitBreaker) {
    paymentCircuitBreaker = new CircuitBreaker(5, 30000);
  }
  return paymentCircuitBreaker;
}

export async function getZoomCircuitBreaker(): Promise<CircuitBreaker> {
  if (!zoomCircuitBreaker) {
    zoomCircuitBreaker = new CircuitBreaker(5, 30000);
  }
  return zoomCircuitBreaker;
}