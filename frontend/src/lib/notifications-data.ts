'use client';

/**
 * @fileOverview Shared data service for user notifications.
 * Routes through the Python backend REST API.
 */

import type { Notification } from '@/lib/db';
import { apiFetch } from '@/lib/api-client';

export const getNotifications = async (userId: string): Promise<Notification[]> => {
    if (!userId) return [];
    try {
        const res = await apiFetch('/notifications/');
        if (!res.ok) return [];
        const data = await res.json();
        return data.notifications || [];
    } catch {
        return [];
    }
};

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
    callback: (notifications: Notification[]) => void,
    onError?: (error?: any) => void
): (() => void) => {
    if (!userId || typeof window === 'undefined') return () => {};

    // Use polling since Firebase Firestore isn't connected and PostgreSQL doesn't have realtime setup for this
    const poll = async () => {
        try {
            const notifications = await getNotifications(userId);
            if (notifications.length > 0) {
                // Since this is a simple polling, we can't reliably trigger only on *new* notifications
                // The consumer of this hook must handle deduplication.
                callback(notifications);
            }
        } catch (e) {
            if (onError) onError(e);
        }
    };

    poll();
    const interval = setInterval(poll, 30000); // 30 seconds

    return () => clearInterval(interval);
};

export const markAsRead = async (notificationId: string): Promise<void> => {
    await apiFetch(`/notifications/${notificationId}/read`, { method: 'PUT' });
};

export const markAllAsRead = async (_userId?: string, _notificationIds?: string[]): Promise<void> => {
    // Mark all as read - iterate through notifications
    try {
        const res = await apiFetch('/notifications/');
        if (res.ok) {
            const data = await res.json();
            const notifications = data.notifications || [];
            await Promise.all(notifications.map((n: Notification) => markAsRead(n.id)));
        }
    } catch {
        // ignore
    }
};
