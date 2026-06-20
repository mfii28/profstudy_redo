export type ServiceErrorKind =
  | 'quota'
  | 'permission'
  | 'auth'
  | 'network'
  | 'index'
  | 'unknown';

export type NormalizedServiceError = {
  title: string;
  description: string;
  kind: ServiceErrorKind;
  retryable: boolean;
};

export type ServiceErrorContext = {
  feature?: string;
};

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || '');
  }
  return String(error ?? 'Unknown error');
}

function extractCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code || '');
  }
  return '';
}

function extractStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = Number((error as { status?: unknown }).status);
    return Number.isFinite(status) ? status : undefined;
  }
  return undefined;
}

function withFeaturePrefix(message: string, feature?: string): string {
  if (!feature) return message;
  return `${feature}: ${message}`;
}

export function isQuotaError(error: unknown): boolean {
  return normalizeServiceError(error).kind === 'quota';
}

export function isIndexError(error: unknown): boolean {
  return normalizeServiceError(error).kind === 'index';
}

export function toUserFacingMessage(error: unknown, ctx?: ServiceErrorContext): string {
  const normalized = normalizeServiceError(error, ctx);
  return normalized.description;
}

export function normalizeServiceError(
  error: unknown,
  ctx?: ServiceErrorContext
): NormalizedServiceError {
  const message = extractMessage(error);
  const code = extractCode(error).toLowerCase();
  const lowered = message.toLowerCase();
  const status = extractStatus(error);
  const feature = ctx?.feature;

  if (
    code === 'resource-exhausted' ||
    lowered.includes('resource exhausted') ||
    lowered.includes('quota exceeded') ||
    lowered.includes('quota has been exceeded') ||
    lowered.includes('exceeded your quota') ||
    (lowered.includes('quota') && lowered.includes('exceed'))
  ) {
    return {
      title: 'Service busy',
      description: withFeaturePrefix(
        'The service is temporarily busy. Please wait a minute and try again.',
        feature
      ),
      kind: 'quota',
      retryable: true,
    };
  }

  if (
    code === 'auth/too-many-requests' ||
    code === 'auth/quota-exceeded' ||
    lowered.includes('too many requests') ||
    status === 429 ||
    lowered.includes('rate limit')
  ) {
    return {
      title: 'Too many attempts',
      description: withFeaturePrefix(
        'Too many attempts. Wait a moment, then try again.',
        feature
      ),
      kind: 'quota',
      retryable: true,
    };
  }

  if (
    code === 'failed-precondition' ||
    lowered.includes('requires an index') ||
    lowered.includes('create index')
  ) {
    return {
      title: 'Still preparing',
      description: withFeaturePrefix(
        "We're still preparing this view. Try again in a few seconds.",
        feature
      ),
      kind: 'index',
      retryable: true,
    };
  }

  if (
    code === 'permission-denied' ||
    lowered.includes('permission-denied') ||
    lowered.includes('insufficient permissions') ||
    lowered.includes('missing or insufficient')
  ) {
    return {
      title: 'Access denied',
      description: withFeaturePrefix(
        'You do not have permission to perform this action.',
        feature
      ),
      kind: 'permission',
      retryable: false,
    };
  }

  if (
    code === 'unauthenticated' ||
    lowered.includes('unauthorized') ||
    lowered.includes('authentication required') ||
    lowered.includes('token verification failed')
  ) {
    return {
      title: 'Sign in required',
      description: withFeaturePrefix(
        'Your session may have expired. Sign in again and retry.',
        feature
      ),
      kind: 'auth',
      retryable: false,
    };
  }

  if (
    code === 'unavailable' ||
    lowered.includes('network') ||
    lowered.includes('fetch failed') ||
    lowered.includes('econnreset') ||
    lowered.includes('offline')
  ) {
    return {
      title: 'Connection issue',
      description: withFeaturePrefix(
        'We could not reach the server. Check your connection and try again.',
        feature
      ),
      kind: 'network',
      retryable: true,
    };
  }

  if (
    lowered.includes('model is overloaded') ||
    lowered.includes('resource_exhausted') ||
    (lowered.includes('limit') && lowered.includes('reached'))
  ) {
    return {
      title: 'Service busy',
      description: withFeaturePrefix(
        'The service is temporarily busy. Please wait a minute and try again.',
        feature
      ),
      kind: 'quota',
      retryable: true,
    };
  }

  return {
    title: 'Something went wrong',
    description: withFeaturePrefix(message || 'An unexpected error occurred.', feature),
    kind: 'unknown',
    retryable: false,
  };
}

export async function withServiceErrors<T extends Record<string, unknown>>(
  fn: () => Promise<T>,
  ctx?: ServiceErrorContext
): Promise<T | { error: string; errorKind: ServiceErrorKind; retryable: boolean }> {
  try {
    return await fn();
  } catch (error) {
    const normalized = normalizeServiceError(error, ctx);
    return {
      error: normalized.description,
      errorKind: normalized.kind,
      retryable: normalized.retryable,
    };
  }
}
