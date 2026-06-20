'use server';

import { adminDb } from '@/firebase/admin';
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

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function getAdminDashboardStats(idToken: string): Promise<AdminDashboardStatsResult> {
  try {
    if (!idToken) {
      return {
        totalUsers: 0,
        totalCourses: 0,
        totalRevenue: 0,
        pendingApprovals: 0,
        totalBooks: 0,
        totalReviews: 0,
        error: 'Authentication required.',
      };
    }

    const adminCtx = await requireAdminContextFromIdToken(idToken);
    if (!adminCtx.ok) {
      return {
        totalUsers: 0,
        totalCourses: 0,
        totalRevenue: 0,
        pendingApprovals: 0,
        totalBooks: 0,
        totalReviews: 0,
        error: adminCtx.error,
      };
    }

    const [usersSnap, coursesSnap, ordersSnap, booksSnap, reviewsSnap] = await Promise.all([
      adminDb.collection('users').get(),
      adminDb.collection('courses').get(),
      adminDb.collection('orders').get(),
      adminDb.collection('books').get(),
      adminDb.collection('reviews').get(),
    ]);

    const totalRevenue = ordersSnap.docs.reduce((sum, orderDoc) => {
      const data = orderDoc.data() as { total?: unknown };
      return sum + toNumber(data.total);
    }, 0);

    const pendingApprovals = coursesSnap.docs.reduce((count, courseDoc) => {
      const status = String((courseDoc.data() as { status?: unknown }).status || '').trim().toLowerCase();
      return count + (status === 'under review' ? 1 : 0);
    }, 0);

    return {
      totalUsers: usersSnap.size,
      totalCourses: coursesSnap.size,
      totalRevenue,
      pendingApprovals,
      totalBooks: booksSnap.size,
      totalReviews: reviewsSnap.size,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Admin Dashboard] Failed to load dashboard stats', {
      errorMessage: message,
    });
    const isDev = process.env.NODE_ENV !== 'production';
    const hint =
      isDev && /credential|admin/i.test(message)
        ? ' Check FIREBASE_ADMIN_CREDENTIALS in .env.local.'
        : '';
    return {
      totalUsers: 0,
      totalCourses: 0,
      totalRevenue: 0,
      pendingApprovals: 0,
      totalBooks: 0,
      totalReviews: 0,
      error: `Failed to load dashboard stats.${hint}`,
    };
  }
}