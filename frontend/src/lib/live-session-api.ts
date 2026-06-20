'use client';

type JsonObject = Record<string, unknown>;

type CreateLiveSessionPayload = {
  title: string;
  tutorId: string;
  startTime: string;
  durationMinutes: number;
  zoomUrl: string;
  courseId?: string;
};

type LiveSessionCreateResponse = {
  id: string;
};

type LiveSessionJoinResponse = {
  url: string;
  title: string;
};

type LiveSessionDeleteResponse = {
  success: boolean;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJsonWithRetry<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  options?: { retries?: number; retryDelayMs?: number }
): Promise<T> {
  const retries = options?.retries ?? 1;
  const retryDelayMs = options?.retryDelayMs ?? 600;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(input, init);
      const payload = (await response.json().catch(() => ({}))) as JsonObject;

      if (!response.ok) {
        const message =
          typeof payload.error === 'string'
            ? payload.error
            : typeof payload.message === 'string'
              ? payload.message
              : `Request failed with status ${response.status}.`;

        if (response.status >= 500 && attempt < retries) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }

        throw new Error(message);
      }

      return payload as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unexpected request failure.');
      if (attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError ?? new Error('Unexpected request failure.');
}

export async function createLiveSessionApi(idToken: string, payload: CreateLiveSessionPayload) {
  return fetchJsonWithRetry<LiveSessionCreateResponse>(
    '/api/live-sessions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    },
    { retries: 1 }
  );
}

export async function getLiveSessionJoinUrlApi(idToken: string, sessionId: string) {
  return fetchJsonWithRetry<LiveSessionJoinResponse>(
    `/api/live-sessions/${encodeURIComponent(sessionId)}/join`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
    { retries: 1 }
  );
}

export async function deleteLiveSessionApi(idToken: string, sessionId: string) {
  return fetchJsonWithRetry<LiveSessionDeleteResponse>(
    `/api/live-sessions/${encodeURIComponent(sessionId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    },
    { retries: 1 }
  );
}