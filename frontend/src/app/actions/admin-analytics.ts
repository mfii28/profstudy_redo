'use server';

import { logger } from '@/lib/logging';
import { requireAdminContextFromIdToken } from '@/lib/trusted-server-context';

type AnalyticsTrendPoint = {
  label: string;
  count: number;
};

type AnalyticsReview = {
  id: string;
  course: string;
  text: string;
  rating: number;
  date: string;
};

type AdminAnalyticsOverviewResult = {
  activeUsers: number;
  avgEngagement: string;
  totalSubscriptions: number;
  retentionRate: string;
  trendData: AnalyticsTrendPoint[];
  recentReviews: AnalyticsReview[];
  error?: string;
};

function emptyResult(error?: string): AdminAnalyticsOverviewResult {
  return {
    activeUsers: 0,
    avgEngagement: '0 min',
    totalSubscriptions: 0,
    retentionRate: '0%',
    trendData: [],
    recentReviews: [],
    error,
  };
}

export async function getAdminAnalyticsOverview(idToken: string): Promise<AdminAnalyticsOverviewResult> {
  try {
    if (!idToken) return emptyResult('Authentication required.');

    const adminCtx = await requireAdminContextFromIdToken(idToken, 'dashboard:view:analytics');
    if (!adminCtx.ok) return emptyResult(adminCtx.error);

    const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
    const res = await fetch(`${apiUrl}/admin/analytics/overview`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return emptyResult('Failed to fetch analytics');

    const data = await res.json();

    // Map backend response to expected format
    const trendData: AnalyticsTrendPoint[] = (data.trendData || []).map((t: any) => ({
      label: t.date || '',
      count: t.revenue || 0,
    }));

    const recentReviews: AnalyticsReview[] = (data.recentReviews || []).map((r: any) => ({
      id: r.id || '',
      course: r.courseId || '',
      text: r.comment || '',
      rating: r.rating || 0,
      date: r.createdAt || '',
    }));

    return {
      activeUsers: data.activeUsers || 0,
      avgEngagement: `${data.avgEngagement || 0}`,
      totalSubscriptions: data.totalSubscriptions || 0,
      retentionRate: `${data.retentionRate || 0}%`,
      trendData,
      recentReviews,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Admin Analytics] Failed to load analytics overview', { errorMessage: message });
    return emptyResult('Failed to load analytics.');
  }
}