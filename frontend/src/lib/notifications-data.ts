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

    // Dynamic import to avoid SSR issues
    let channel: any = null;

    import('@/lib/supabase-client').then(({ supabase }) => {
      channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes' as any,
          {
            event: 'INSERT',
            schema: 'public',
            table: 'Notification',
            filter: `userId=eq.${userId}`,
          },
          (payload: any) => {
            const newNotif = payload.new as Notification;
            if (newNotif) {
              callback([newNotif]);
            }
          }
        )
        .subscribe();
    });

    return () => {
      import('@/lib/supabase-client').then(({ supabase }) => {
        if (channel) supabase.removeChannel(channel);
      });
    };
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
