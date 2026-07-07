'use server';

import { apiFetchServer } from '@/lib/api-client.server';
import { logger } from '@/lib/logging';

export async function getAdminAnalyticsOverview(idToken?: string, timeRange: '7d' | '30d' | '90d' | 'all' = '30d') {
  try {
    const res = await apiFetchServer(`/api/v1/admin/analytics/overview?timeRange=${timeRange}`);
    return res.json();
  } catch (error: any) {
    logger.error('[Admin Analytics] Failed to load overview', { error: error.message });
    return {
      activeUsers: 0,
      totalCourses: 0,
      totalEnrollments: 0,
      totalRevenue: 0,
      totalOrders: 0,
      totalSubscriptions: 0,
      retentionRate: 0,
      trendData: [],
      recentReviews: [],
      error: 'Failed to load analytics data'
    };
  }
}