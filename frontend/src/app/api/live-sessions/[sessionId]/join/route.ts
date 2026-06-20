import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';
import type { Enrollment, LiveClass, User } from '@/lib/db';
import { logger } from '@/lib/logging';
import { isAdminRole, validateTrustedServerContext } from '@/lib/trusted-server-context';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session ID.' }, { status: 400 });
    }

    const authContext = await validateTrustedServerContext(request);
    if (!authContext.success || !authContext.userId || !authContext.role) {
      return NextResponse.json({ error: authContext.error || 'Invalid or expired token.' }, { status: 401 });
    }

    const [sessionSnap, urlSnap, userSnap] = await Promise.all([
      adminDb.collection('liveClasses').doc(sessionId).get(),
      adminDb.collection('liveClassUrls').doc(sessionId).get(),
      adminDb.collection('users').doc(authContext.userId).get(),
    ]);

    if (!sessionSnap.exists) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }

    if (!userSnap.exists) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }

    const session = sessionSnap.data() as LiveClass;
    const urlDoc = urlSnap.data() as { zoomUrl?: string };
    const user = userSnap.data() as User;

    const resolvedMeetingLink = urlDoc?.zoomUrl || session.meetingLink;

    if (!resolvedMeetingLink) {
      return NextResponse.json({ error: 'Session link is unavailable.' }, { status: 500 });
    }

    const isAdmin = isAdminRole(authContext.role);
    const isInstructor = session.instructorId === authContext.userId;

    if (!isAdmin && !isInstructor) {
      if (user.role !== 'student') {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
      }

      if (session.courseId) {
        const enrollments: Enrollment[] = user.enrollments || [];
        const enrolled = enrollments.some((e) => e.courseId === session.courseId);
        if (!enrolled) {
          return NextResponse.json({ error: 'You are not enrolled for this session.' }, { status: 403 });
        }
      }
    }

    return NextResponse.json({ url: resolvedMeetingLink, title: session.title }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[API live-sessions join] failed', { error: message });
    return NextResponse.json({ error: 'Unable to join this session right now.' }, { status: 500 });
  }
}
