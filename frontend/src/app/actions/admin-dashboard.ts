'use server';

import { logger } from '@/lib/logging';
import { requireAdminContextFromIdToken } from '@/lib/trusted-server-context';

type AdminDashboardStatsResult = {
  totalUsers: number;
  totalCourses: number;
  totalRevenue: number;
  pendingApprovals: number;
  totalBooks: number;
  totalReviews: number;
  error?: string;
};

export async function getAdminDashboardStats(idToken: string): Promise<AdminDashboardStatsResult> {
  try {
    if (!idToken) {
      return { totalUsers: 0, totalCourses: 0, totalRevenue: 0, pendingApprovals: 0, totalBooks: 0, totalReviews: 0, error: 'Authentication required.' };
    }

    const adminCtx = await requireAdminContextFromIdToken(idToken);
    if (!adminCtx.ok) {
      return { totalUsers: 0, totalCourses: 0, totalRevenue: 0, pendingApprovals: 0, totalBooks: 0, totalReviews: 0, error: adminCtx.error };
    }

    const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
    const res = await fetch(`${apiUrl}/admin/dashboard/stats`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) {
      return { totalUsers: 0, totalCourses: 0, totalRevenue: 0, pendingApprovals: 0, totalBooks: 0, totalReviews: 0, error: 'Failed to fetch stats' };
    }
    const data = await res.json();

    return {
      totalUsers: data.totalUsers || 0,
      totalCourses: data.totalCourses || 0,
      totalRevenue: data.totalRevenue || 0,
      pendingApprovals: data.pendingApprovals || 0,
      totalBooks: data.totalBooks || 0,
      totalReviews: data.totalReviews || 0,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Admin Dashboard] Failed to load dashboard stats', { errorMessage: message });
    return { totalUsers: 0, totalCourses: 0, totalRevenue: 0, pendingApprovals: 0, totalBooks: 0, totalReviews: 0, error: `Failed to load dashboard stats.` };
  }
}