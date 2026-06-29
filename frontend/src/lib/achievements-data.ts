'use client';

/**
 * @fileOverview Data service for student achievements.
 * Routes through the Python backend REST API.
 */

import type { Achievement } from '@/lib/db';
import { apiFetch } from '@/lib/api-client';

export const getAchievements = async (userId: string): Promise<Achievement[]> => {
    if (!userId) return [];
    try {
        const res = await apiFetch(`/achievements/${userId}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.achievements || [];
    } catch (e) {
        console.error('[Achievements] getAchievements error:', e);
        return [];
    }
};
