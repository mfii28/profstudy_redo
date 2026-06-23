'use server';

import { adminDb } from '@/firebase/admin';
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

function buildRegistrationTrend(userDocs: FirebaseFirestore.QueryDocumentSnapshot[]): AnalyticsTrendPoint[] {
  const buckets = new Map<string, { label: string; count: number }>();

  for (let index = 13; index >= 0; index -= 1) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - index);
    const iso = day.toISOString().split('T')[0];
    buckets.set(iso, {
      label: day.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      count: 0,
    });
  }

  for (const userDoc of userDocs) {
    const data = userDoc.data() as { createdAt?: unknown };
    const rawCreatedAt = data.createdAt;

    let createdAt: Date | null = null;
    if (typeof rawCreatedAt === 'string') {
      const parsed = new Date(rawCreatedAt);
      createdAt = Number.isNaN(parsed.getTime()) ? null : parsed;
    } else if (rawCreatedAt && typeof (rawCreatedAt as any).toDate === 'function') {
      createdAt = (rawCreatedAt as FirebaseFirestore.Timestamp).toDate();
    }

    if (!createdAt) continue;
    const iso = createdAt.toISOString().split('T')[0];
    const bucket = buckets.get(iso);
    if (bucket) {
      bucket.count += 1;
    }
  }

  return Array.from(buckets.values());
}

export async function getAdminAnalyticsOverview(idToken: string): Promise<AdminAnalyticsOverviewResult> {
  try {
    if (!idToken) {
      return emptyResult('Authentication required.');
    }

    const adminCtx = await requireAdminContextFromIdToken(idToken, 'dashboard:view:analytics');
    if (!adminCtx.ok) return emptyResult(adminCtx.error);

    const [usersSnap, subscriptionsSnap, subscriptionPlansSnap] = await Promise.all([
      adminDb.collection('users').get(),
      adminDb.collection('subscriptions').get(),
      adminDb.collection('subscriptionPlans').get(),
    ]);

    let reviewsSnap: FirebaseFirestore.QuerySnapshot;
    try {
      reviewsSnap = await adminDb.collection('reviews').orderBy('date', 'desc').limit(8).get();
    } catch (reviewError: any) {
      // Some deployments may not have the required composite index yet.
      logger.warn('[Admin Analytics] Falling back to unordered review query', {
        errorMessage: reviewError?.message,
        errorCode: reviewError?.code,
      });
      reviewsSnap = await adminDb.collection('reviews').limit(50).get();
    }

    const userDocs = usersSnap.docs;
    const activeUsers = userDocs.filter((userDoc: any) => {
      const status = String((userDoc.data() as { status?: unknown }).status || '').trim().toLowerCase();
      return status === 'active';
    }).length;

    const totalStreak = userDocs.reduce((sum: number, userDoc: any) => {
      const studyStreak = Number((userDoc.data() as { studyStreak?: unknown }).studyStreak || 0);
      return sum + (Number.isFinite(studyStreak) ? studyStreak : 0);
    }, 0);
    const avgStreak = userDocs.length > 0 ? totalStreak / userDocs.length : 0;
    const avgEngagement = `${Math.round(avgStreak * 5 + 35)} min`;

    const engagedUsers = userDocs.filter((userDoc: any) => {
      const enrollments = (userDoc.data() as { enrollments?: unknown }).enrollments;
      return Array.isArray(enrollments) && enrollments.length > 0;
    }).length;
    const retentionRate = `${userDocs.length > 0 ? Math.round((engagedUsers / userDocs.length) * 100) : 0}%`;

    const activeSubscriptions = subscriptionsSnap.docs.filter((subscriptionDoc: any) => {
      const status = String((subscriptionDoc.data() as { status?: unknown }).status || 'Active').trim().toLowerCase();
      return status === 'active';
    }).length;

    // Fallback: older deployments track active members in subscriptionPlans only.
    const activeSubscribersFromPlans = subscriptionPlansSnap.docs.reduce((sum: number, planDoc: any) => {
      const activeSubscribers = Number((planDoc.data() as { activeSubscribers?: unknown }).activeSubscribers || 0);
      return sum + (Number.isFinite(activeSubscribers) ? activeSubscribers : 0);
    }, 0);

    const totalSubscriptions = activeSubscriptions > 0 ? activeSubscriptions : activeSubscribersFromPlans;

    const recentReviews = reviewsSnap.docs.map((reviewDoc: any) => {
      const data = reviewDoc.data() as {
        course?: unknown;
        text?: unknown;
        rating?: unknown;
        date?: unknown;
      };

      const rawDate = data.date;
      const date = typeof rawDate === 'string'
        ? rawDate
        : rawDate && typeof (rawDate as any).toDate === 'function'
          ? (rawDate as FirebaseFirestore.Timestamp).toDate().toISOString()
          : new Date().toISOString();

      return {
        id: reviewDoc.id,
        course: String(data.course || 'Unknown Course'),
        text: String(data.text || ''),
        rating: Number(data.rating || 0),
        date,
      };
    }).sort((left: any, right: any) => new Date(right.date).getTime() - new Date(left.date).getTime()).slice(0, 8);

    return {
      activeUsers,
      avgEngagement,
      totalSubscriptions,
      retentionRate,
      trendData: buildRegistrationTrend(userDocs),
      recentReviews,
    };
  } catch (error: any) {
    logger.error('[Admin Analytics] Failed to load overview', {
      errorMessage: error.message,
      errorCode: error.code,
    });
    return emptyResult('Failed to load analytics overview.');
  }
}