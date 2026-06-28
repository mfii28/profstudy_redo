import { apiFetch } from '@/lib/api-client';
import type { DiscussionThread } from './db';

/**
 * @fileOverview Data service for community discussions.
 * Routes through the Python backend REST API.
 */

export const getDiscussions = async (): Promise<DiscussionThread[]> => {
    try {
        const res = await apiFetch('/discussions');
        if (!res.ok) return [];
        return (await res.json()).discussions || [];
    } catch { return []; }
};

export const getDiscussionsByCourse = async (courseTitle: string): Promise<DiscussionThread[]> => {
    try {
        const res = await apiFetch(`/discussions?course=${encodeURIComponent(courseTitle)}`);
        if (!res.ok) return [];
        return (await res.json()).discussions || [];
    } catch { return []; }
};

export const addDiscussionThread = async (newThread: DiscussionThread): Promise<void> => {
    await apiFetch('/discussions', { method: 'POST', body: JSON.stringify(newThread) });
};

export const updateDiscussionThread = async (thread: DiscussionThread): Promise<void> => {
    await apiFetch(`/discussions/${thread.id}`, { method: 'PUT', body: JSON.stringify(thread) });
};
