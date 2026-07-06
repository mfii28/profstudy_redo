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

import { apiFetch } from '@/lib/api-client';

export async function createLiveSessionApi(idToken: string, payload: CreateLiveSessionPayload) {
  const res = await apiFetch('/live-classes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.detail || 'Failed to create live session');
  }
  return res.json() as Promise<LiveSessionCreateResponse>;
}

export async function getLiveSessionJoinUrlApi(idToken: string, sessionId: string) {
  const res = await apiFetch(`/live-classes/${encodeURIComponent(sessionId)}/join-url`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.detail || 'Failed to get join URL');
  }
  return res.json() as Promise<LiveSessionJoinResponse>;
}

export async function deleteLiveSessionApi(idToken: string, sessionId: string) {
  const res = await apiFetch(`/live-classes/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.detail || 'Failed to delete live session');
  }
  return res.json() as Promise<LiveSessionDeleteResponse>;
}