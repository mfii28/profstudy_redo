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
    return [];
};

export const getFunnelData = async (): Promise<FunnelDataPoint[]> => {
    return [];
};
