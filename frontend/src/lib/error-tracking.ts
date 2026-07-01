/**
 * Lightweight error tracking.
 *
 * Currently logs to console + can POST to a backend endpoint.
 * To enable Sentry:
 *   1. npm install @sentry/nextjs
 *   2. Uncomment the Sentry init below
 *   3. Add SENTRY_DSN to your .env.local
 */

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || '';

type ErrorContext = Record<string, unknown>;

let _sentryInitialized = false;

function initSentry(): void {
  if (_sentryInitialized || !SENTRY_DSN) return;
  try {
    // Dynamic import so the app doesn't break if @sentry/nextjs isn't installed
    // const Sentry = await import('@sentry/nextjs');
    // Sentry.init({ dsn: SENTRY_DSN, environment: process.env.NODE_ENV });
    _sentryInitialized = true;
  } catch {
    // Sentry not installed — use console fallback
  }
}

/**
 * Capture an exception for monitoring.
 * Falls back to console.error when Sentry is not configured.
 */
export function captureError(error: unknown, context?: ErrorContext): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  // Always log to console
  console.error('[ErrorTracking]', message, context || '', stack || '');

  // If Sentry is configured, forward
  if (SENTRY_DSN && typeof window !== 'undefined') {
    try {
      fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          stack,
          context,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch {
      // Silently fail
    }
  }
}

/**
 * Log a warning for non-critical issues.
 */
export function captureWarning(message: string, context?: ErrorContext): void {
  console.warn('[Warning]', message, context || '');
}

/**
 * Set user context for error reports.
 */
export function setErrorUser(id: string, email?: string): void {
  if (_sentryInitialized) {
    // Sentry.setUser({ id, email });
  }
}
