
'use client';

import { collection, getDocs, addDoc, query, orderBy, where, doc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { Announcement } from '@/lib/db';
import { updateDoc } from 'firebase/firestore';

/**
 * @fileOverview Data service for site-wide marketing and announcements.
 */

export const getAnnouncements = async (authorId?: string): Promise<Announcement[]> => {
    if (!db) return [];
    const announcementsCollection = collection(db, 'announcements');
    let q;
    
    if (authorId) {
        // NOTE: This query requires a composite index: authorId (Asc), date (Desc)
        q = query(announcementsCollection, where("authorId", "==", authorId), orderBy("date", "desc"));
    } else {
        q = query(announcementsCollection, orderBy("date", "desc"));
    }
    
    try {
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
    } catch (error: any) {
        // Fallback for missing index in prototype environment
        if (error.code === 'failed-precondition' && authorId) {
            console.warn("[Announcements] Index required for filtered sorting. Falling back to client-side filter.");
            const fallbackQ = query(announcementsCollection, where("authorId", "==", authorId));
            const snapshot = await getDocs(fallbackQ);
            const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement));
            return results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
        console.error("Failed to fetch announcements:", error);
        return [];
    }
};

export const saveAnnouncement = async (announcement: Omit<Announcement, 'id' | 'date'>): Promise<void> => {
    if (!db) return;
    const announcementsCollection = collection(db, 'announcements');
    await addDoc(announcementsCollection, {
        ...announcement,
        date: new Date().toISOString(),
    });
};

export const subscribeToAnnouncements = (
    onUpdate: (announcements: Announcement[]) => void,
    authorId?: string,
    onError?: (error: Error) => void
): (() => void) => {
    if (!db) return () => {};

    const announcementsCollection = collection(db, 'announcements');
    const q = authorId
        ? query(announcementsCollection, where('authorId', '==', authorId), orderBy('date', 'desc'))
        : query(announcementsCollection, orderBy('date', 'desc'));

    const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            const announcements = snapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() } as Announcement))
                .sort((a, b) => b.date.localeCompare(a.date));
            onUpdate(announcements);
        },
        (error) => {
            console.error('Error subscribing to announcements:', error);
            if (onError) onError(error as Error);
        }
    );

    return unsubscribe;
};

export const deleteAnnouncement = async (id: string): Promise<void> => {
    if (!db) return;
    const docRef = doc(db, 'announcements', id);
    await deleteDoc(docRef);
};

export const updateAnnouncement = async (
    id: string,
    updates: Pick<Announcement, 'title' | 'message' | 'courseId'>
): Promise<void> => {
    if (!db) return;
    const docRef = doc(db, 'announcements', id);
    await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date().toISOString(),
    });
};
