'use client';

/**
 * @fileOverview Shared data service for user notifications.
 * Routes through the Python backend REST API.
 */

import type { Notification } from '@/lib/db';
import { apiFetch } from '@/lib/api-client';

export const getNotificationsPage = async (
    userId: string,
    options?: { pageSize?: number; cursorTime?: string }
): Promise<{ notifications: Notification[]; nextCursor: string | null }> => {
    if (!userId) return { notifications: [], nextCursor: null };
    try {
        const res = await apiFetch('/notifications/');
        if (!res.ok) return { notifications: [], nextCursor: null };
        const data = await res.json();
        return { notifications: data.notifications || [], nextCursor: null };
    } catch (e) {
        console.error("Error fetching notifications:", e);
        return { notifications: [], nextCursor: null };
    }
};

export const subscribeToNotifications = (
    userId: string,
    callback: (notifications: Notification[]) => void
): (() => void) => {
    // Real-time notifications not yet implemented via Supabase Realtime
    return () => {};
};
