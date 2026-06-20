'use client';

import { collection, addDoc, query, where, orderBy, getDocs, limit, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { AiInteraction } from './db';

/**
 * @fileOverview Data service for persisting AI tutoring history.
 */

const COLLECTION_NAME = 'ai_interactions';

export const saveAiInteraction = async (interaction: Omit<AiInteraction, 'id' | 'timestamp'>): Promise<void> => {
    if (!db) return;
    try {
        await addDoc(collection(db, COLLECTION_NAME), {
            ...interaction,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[AiHistory] Failed to save interaction:', error);
    }
};

export const getAiHistory = async (userId: string, type?: AiInteraction['type']): Promise<AiInteraction[]> => {
    if (!db || !userId) return [];
    try {
        const interactionsRef = collection(db, COLLECTION_NAME);
        const q = type
            ? query(
                  interactionsRef,
                  where('userId', '==', userId),
                  where('type', '==', type),
                  orderBy('timestamp', 'desc'),
                  limit(50),
              )
            : query(
                  interactionsRef,
                  where('userId', '==', userId),
                  orderBy('timestamp', 'desc'),
                  limit(50),
              );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AiInteraction));
    } catch (error) {
        console.error('[AiHistory] Failed to fetch history:', error);
        return [];
    }
};

export const deleteAiInteraction = async (id: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, COLLECTION_NAME, id));
};
