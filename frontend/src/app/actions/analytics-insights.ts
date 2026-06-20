'use server';

import {
  generateDashboardInsight,
  generateCourseInsight,
  type DashboardInsightData,
  type CourseInsightData,
} from '@/lib/ai-insights';
import { adminAuth } from '@/firebase/admin';
import { logger } from '@/lib/logging';

async function verifyAuthenticated(idToken: string): Promise<string | null> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function generateDashboardInsightAction(data: DashboardInsightData, idToken: string) {
  const uid = await verifyAuthenticated(idToken);
  if (!uid) {
    logger.warn('[Analytics Insights] Unauthorized dashboard insight request');
    return { insight: 'Authentication required. Please sign in again.', tokensUsed: 0, premium: false };
  }
  return generateDashboardInsight(data);
}

export async function generateCourseInsightAction(data: CourseInsightData, idToken: string) {
  const uid = await verifyAuthenticated(idToken);
  if (!uid) {
    logger.warn('[Analytics Insights] Unauthorized course insight request');
    return { insight: 'Authentication required. Please sign in again.', tokensUsed: 0, premium: false };
  }
  return generateCourseInsight(data);
}
