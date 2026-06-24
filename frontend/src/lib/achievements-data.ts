'use client';

/**
 * @fileOverview Data service for student achievements.
 * Routes through the Python backend REST API.
 */

import type { Achievement } from '@/lib/db';
import { apiFetch } from '@/lib/api-client';

export const getAchievements = async (userId: string): Promise<Achievement[]> => {
    if (!userId) return [];
    // Achievements not yet exposed via REST - return empty
    return [];
};
