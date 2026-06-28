'use client';

import { apiFetch } from '@/lib/api-client';
import type { PersonalizedStudyPlanOutput } from './db';

/**
 * @fileOverview Data service for personalized study plans.
 * Routes through the Python backend REST API.
 */

export const saveStudyPlan = async (userId: string, plan: PersonalizedStudyPlanOutput): Promise<void> => {
    await apiFetch('/study-plans', {
        method: 'POST',
        body: JSON.stringify({ userId, plan }),
    });
};

export const getActiveStudyPlan = async (userId: string): Promise<PersonalizedStudyPlanOutput | null> => {
    try {
        const res = await apiFetch(`/study-plans?userId=${encodeURIComponent(userId)}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.plan || null;
    } catch { return null; }
};

export const toggleTaskCompletion = async (userId: string, taskId: string, isCompleted: boolean): Promise<void> => {
    await apiFetch(`/study-plans/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ userId, isCompleted }),
    });
};
