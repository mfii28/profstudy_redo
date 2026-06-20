import { collection, getDocs, query, where, addDoc, doc, writeBatch, setDoc, onSnapshot, orderBy, limit, startAfter } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { Notification } from '@/lib/db';

/**
 * @fileOverview Shared data service for user notifications.
 */

export const getNotificationsPage = async (
    userId: string,
    options?: { pageSize?: number; cursorTime?: string }
): Promise<{ notifications: Notification[]; nextCursor: string | null }> => {
    if (!db || !userId) return { notifications: [], nextCursor: null };
    const notificationsCollection = collection(db, 'notifications');
    const pageSize = Math.min(Math.max(options?.pageSize || 50, 1), 200);
    let q = query(
        notificationsCollection,
        where("userId", "==", userId),
        orderBy('time', 'desc'),
        limit(pageSize + 1),
    );

    if (options?.cursorTime) {
        q = query(
            notificationsCollection,
            where("userId", "==", userId),
            orderBy('time', 'desc'),
            startAfter(options.cursorTime),
            limit(pageSize + 1),
        );
    }
    const snapshot = await getDocs(q);

    const normalized = snapshot.docs
        .map(doc => normalizeNotification(doc.id, doc.data()))
        .sort((a, b) => b.time.localeCompare(a.time));
    const notifications = normalized.slice(0, pageSize);
    const nextCursor = normalized.length > pageSize ? notifications[notifications.length - 1]?.time || null : null;
    return { notifications, nextCursor };
};

export const getNotifications = async (userId: string): Promise<Notification[]> => {
    const page = await getNotificationsPage(userId, { pageSize: 200 });
    return page.notifications;
};

const toIsoTime = (value: any): string => {
    if (!value) return new Date(0).toISOString();
    if (typeof value === 'string') return value;
    if (typeof value?.toDate === 'function') {
        try {
            return value.toDate().toISOString();
        } catch {
            return new Date(0).toISOString();
        }
    }
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'number') return new Date(value).toISOString();
    return new Date(0).toISOString();
};

const normalizeNotification = (id: string, data: any): Notification => ({
    id,
    userId: data?.userId || '',
    title: data?.title || 'Notification',
    description: data?.description || '',
    time: toIsoTime(data?.time),
    read: Boolean(data?.read),
    category: data?.category || 'info',
});

export const subscribeToNotifications = (
    userId: string,
    onUpdate: (notifications: Notification[]) => void,
    onError?: (error: Error) => void
): (() => void) => {
    if (!db || !userId) {
        return () => {};
    }

    const notificationsCollection = collection(db, 'notifications');
    const q = query(
        notificationsCollection,
        where("userId", "==", userId),
        orderBy('time', 'desc')
    );

    const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            const notifications = snapshot.docs
                .map(doc => normalizeNotification(doc.id, doc.data()))
                .sort((a, b) => b.time.localeCompare(a.time));
            onUpdate(notifications);
        },
        (error) => {
            console.error('Error subscribing to notifications:', error);
            if (onError) onError(error as Error);
        }
    );

    return unsubscribe;
};

export const notifyUser = async (userId: string, title: string, description: string, category: 'info' | 'success' | 'alert' | 'achievement' = 'info'): Promise<void> => {
    if (!db) return;
    const data = {
        userId,
        title,
        description,
        time: new Date().toISOString(),
        read: false,
        category
    };
    await addDoc(collection(db, 'notifications'), data);
};

export const markAsRead = async (notificationId: string): Promise<void> => {
    if (!db) return;
    const docRef = doc(db, 'notifications', notificationId);
    await setDoc(docRef, { read: true }, { merge: true });
};

export const markAllAsRead = async (userId: string, notificationIds: string[]): Promise<void> => {
    if (!db || !userId || notificationIds.length === 0) return;
    const batch = writeBatch(db);
    notificationIds.forEach(id => {
        batch.update(doc(db, 'notifications', id), { read: true });
    });
    await batch.commit();
};
