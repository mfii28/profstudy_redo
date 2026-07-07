'use server';

import { apiFetchServer } from '@/lib/api-client.server';
import { logger } from '@/lib/logging';

export async function getAdminDashboardStats(idToken: string) {
  try {
    const res = await apiFetchServer('/api/v1/admin/dashboard/stats');
    return res.json();
  } catch (error: any) {
    logger.error('[Admin Dashboard] Failed to load dashboard stats', { error: error.message });
    return { totalUsers: 0, totalCourses: 0, totalRevenue: 0, pendingApprovals: 0, totalBooks: 0, totalReviews: 0, error: 'Failed to load dashboard stats.' };
  }
}