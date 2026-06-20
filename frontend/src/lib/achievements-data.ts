
'use client';

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { Achievement } from '@/lib/db';

/**
 * @fileOverview Data service for student achievements.
 * SCRUBBED: Removed all hardcoded mock data.
 */

export const getAchievements = async (userId: string): Promise<Achievement[]> => {
    if (!db || !userId) return [];
    const achievementsCollection = collection(db, 'achievements');
    const q = query(achievementsCollection, where("userId", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Achievement));
};
