'use client';

/**
 * @fileOverview Data service for platform and student analytics.
 * Routes through the Python backend REST API.
 */

import type { WeeklyStudyData, SubjectMasteryData, FunnelDataPoint, ForecastDataPoint } from '@/lib/db';
import { apiFetch } from '@/lib/api-client';

export const getWeeklyStudyData = async (userId: string): Promise<WeeklyStudyData[]> => {
    if (!userId) return [];
    try {
        const res = await apiFetch(`/admin/analytics/overview`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.trendData || [];
    } catch (e) {
        console.error("Error fetching weekly study data:", e);
        return [];
    }
};

export const getSubjectMasteryData = async (userId: string): Promise<SubjectMasteryData[]> => {
    if (!userId) return [];
    try {
        const res = await apiFetch(`/analytics/subject-mastery/${userId}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.subjects || [];
    } catch (e) {
        console.error("Error fetching subject mastery data:", e);
        return [];
    }
};

export const getFunnelData = async (): Promise<FunnelDataPoint[]> => {
    try {
        const res = await apiFetch(`/analytics/funnel`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.funnel || [];
    } catch (e) {
        console.error("Error fetching funnel data:", e);
        return [];
    }
};

export const recordStudySession = async (...args: any[]): Promise<void> => {
    const data = args.length === 1 && typeof args[0] === 'object' ? args[0]
        : { userId: args[0], courseId: args[1], duration: args[2] };
    await apiFetch('/analytics/study-session', {
        method: 'POST',
        body: JSON.stringify(data),
    });
};
