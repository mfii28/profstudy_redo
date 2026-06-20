import { NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';

type PublicStatsPayload = {
  activeStudents: number;
  averageRating: number;
  expertCourses: number;
  engagementRate: number;
  qualifiedStudents: number;
};

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function GET() {
  try {
    const [usersSnap, coursesSnap, reviewsSnap] = await Promise.all([
      adminDb.collection('users').get(),
      adminDb.collection('courses').where('status', 'in', ['Published', 'published']).get(),
      adminDb.collection('reviews').get(),
    ]);

    const users = usersSnap.docs.map((docSnap) => docSnap.data() as {
      role?: unknown;
      status?: unknown;
      enrollments?: unknown;
    });

    const activeStudents = users.filter((user) => {
      const role = String(user.role || '').toLowerCase();
      const status = String(user.status || '').toLowerCase();
      return role === 'student' && status === 'active';
    }).length;

    const studentUsers = users.filter((user) => String(user.role || '').toLowerCase() === 'student');
    const qualifiedStudents = studentUsers.filter((user) => Array.isArray(user.enrollments) && user.enrollments.length > 0).length;

    const engagementRate = studentUsers.length > 0
      ? Math.round((qualifiedStudents / studentUsers.length) * 100)
      : 0;

    const ratings = reviewsSnap.docs
      .map((docSnap) => toNumber((docSnap.data() as { rating?: unknown }).rating))
      .filter((rating) => rating > 0);

    const averageRating = ratings.length > 0
      ? Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1))
      : 0;

    const payload: PublicStatsPayload = {
      activeStudents,
      averageRating,
      expertCourses: coursesSnap.size,
      engagementRate,
      qualifiedStudents,
    };

    return NextResponse.json({ stats: payload });
  } catch (error) {
    console.error('[PublicStats] Failed to compute public stats:', error);
    // Return 200 so marketing pages and layouts do not break; zeros are an honest fallback.
    const fallback: PublicStatsPayload = {
      activeStudents: 0,
      averageRating: 0,
      expertCourses: 0,
      engagementRate: 0,
      qualifiedStudents: 0,
    };
    return NextResponse.json(
      { stats: fallback, degraded: true as const },
      { status: 200, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    );
  }
}
