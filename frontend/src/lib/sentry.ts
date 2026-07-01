/**
 * Sentry error tracking configuration.
 * Initialized once and exported for use across the app.
 */

import * as Sentry from '@sentry/browser';

const SENTRY_DSN = 'https://3b3b1c75c34803fe9c6b35d4a9231efe@o4511660973948928.ingest.de.sentry.io/4511660991643728';

let _initialized = false;

export function initSentry(): void {
  if (_initialized) return;
  if (typeof window === 'undefined') return; // server-side skip

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      // Only send errors in production to avoid noise during dev
      enabled: process.env.NODE_ENV === 'production',
      // Capture 10% of transactions for performance monitoring
      tracesSampleRate: 0.1,
      // Send personalized user info (pseudonymized)
      sendDefaultPii: false,
      // Ignore common non-actionable errors
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'NetworkError when attempting to fetch resource',
        'Failed to fetch',
        'ChunkLoadError',
      ],
    });
    _initialized = true;
    console.log('[Sentry] Initialized');
  } catch (e) {
    console.warn('[Sentry] Failed to initialize:', e);
  }
}

/**
 * Capture an exception and send to Sentry.
 * Safe to call even if Sentry isn't initialized.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  try {
    if (_initialized) {
      Sentry.captureException(error, { extra: context });
    }
  } catch {
    // Fallback to console
    console.error('[Error]', error, context);
  }
}

/**
 * Capture a warning message.
 */
export function captureMessage(message: string, context?: Record<string, unknown>): void {
  try {
    if (_initialized) {
      Sentry.captureMessage(message, { extra: context });
    }
  } catch {
    console.warn('[Warning]', message, context);
  }
}

/**
 * Set the current user for error reports.
 */
export function setSentryUser(user: { id: string; email?: string; username?: string } | null): void {
  try {
    if (_initialized) {
      Sentry.setUser(user);
    }
  } catch {
    // ignore
  }
}

export { Sentry };
