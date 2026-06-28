'use client';

/**
 * @fileOverview Data service for announcements/marketing.
 * Routes through the Python backend REST API.
 */

import { apiFetch } from '@/lib/api-client';
import type { Announcement } from '@/lib/db';

export const getAnnouncements = async (): Promise<Announcement[]> => {
  try {
    const res = await apiFetch('/announcements');
    if (!res.ok) return [];
    const data = await res.json();
    return data.announcements || [];
  } catch {
    return [];
  }
};

export const saveAnnouncement = async (announcement: Omit<Announcement, 'id' | 'date'> & { id?: string; date?: string }): Promise<void> => {
  await apiFetch('/announcements', {
    method: 'POST',
    body: JSON.stringify(announcement),
  });
};

export const updateAnnouncement = async (id: string, data: Partial<Announcement>): Promise<void> => {
  await apiFetch(`/announcements/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteAnnouncement = async (id: string): Promise<void> => {
  await apiFetch(`/announcements/${id}`, { method: 'DELETE' });
};

export const subscribeToAnnouncements = (
  callback: (announcements: Announcement[]) => void,
  _onErrorOrUserId?: (() => void) | string,
  _onComplete?: () => void
): (() => void) => {
  // Poll-based subscription since Supabase Realtime may not be configured for this table
  const poll = async () => {
    const items = await getAnnouncements();
    callback(items);
  };
  poll();
  const interval = setInterval(poll, 30000);
  return () => clearInterval(interval);
};

