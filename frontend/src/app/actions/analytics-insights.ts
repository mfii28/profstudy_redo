'use server';

import { apiFetchServer } from '@/lib/api-client.server';
import { logger } from '@/lib/logging';

export type DashboardInsightData = Record<string, any>;
export type CourseInsightData = Record<string, any>;

export async function generateDashboardInsightAction(data: DashboardInsightData, idToken?: string) {
  try {
    const res = await apiFetchServer('/api/v1/ai/insights/dashboard', {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
    return res.json();
  } catch (error: any) {
    logger.error('[Analytics Insights] Failed to generate dashboard insight', { error: error.message });
    return { insight: 'Failed to generate insight', tokensUsed: 0, premium: false };
  }
}

export async function generateCourseInsightAction(data: CourseInsightData, idToken?: string) {
  try {
    const res = await apiFetchServer('/api/v1/ai/insights/course', {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
    return res.json();
  } catch (error: any) {
    logger.error('[Analytics Insights] Failed to generate course insight', { error: error.message });
    return { insight: 'Failed to generate insight', tokensUsed: 0, premium: false };
  }
}
