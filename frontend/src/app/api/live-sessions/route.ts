import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/firebase/admin';
import type { LiveClass, User } from '@/lib/db';
import { logger } from '@/lib/logging';
import { isAdminRole, validateTrustedServerContext } from '@/lib/trusted-server-context';

const createSchema = z.object({
  title: z.string().trim().min(1, 'Session title is required.').max(200, 'Session title is too long.'),
  tutorId: z.string().trim().min(1, 'Tutor ID is required.'),
  courseId: z.string().optional(),
  zoomUrl: z.string().trim().url('Zoom URL must be a valid URL.').max(2000, 'Zoom URL is too long.'),
  startTime: z.string().min(1, 'Start time is required.'),
  durationMinutes: z.number().int().min(5, 'Duration must be at least 5 minutes.').max(480, 'Duration cannot exceed 480 minutes.'),
});

const isZoomUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return (
      parsed.hostname.endsWith('.zoom.us') ||
      parsed.hostname === 'zoom.us' ||
      parsed.hostname.endsWith('.zoom.com') ||
      parsed.hostname === 'zoom.com'
    );
  } catch {
    return false;
  }
};

export async function POST(request: NextRequest) {
  let userIdForLog = 'unknown';

  try {
    const authContext = await validateTrustedServerContext(request);
    if (!authContext.success || !authContext.userId || !authContext.role) {
      return NextResponse.json({ error: authContext.error || 'Invalid or expired token.' }, { status: 401 });
    }
    userIdForLog = authContext.userId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
    }

    const parsedInput = createSchema.safeParse(body);
    if (!parsedInput.success) {
      logger.warn('[API live-sessions POST] validation failed', {
        userId: authContext.userId,
        issues: parsedInput.error.issues,
      });
      return NextResponse.json(
        { error: parsedInput.error.issues[0]?.message || 'Invalid payload.' },
        { status: 400 }
      );
    }

    if (!isZoomUrl(parsedInput.data.zoomUrl)) {
      return NextResponse.json({ error: 'Zoom link must be from zoom.us or zoom.com.' }, { status: 400 });
    }

    const startTime = new Date(parsedInput.data.startTime);
    if (Number.isNaN(startTime.getTime())) {
      return NextResponse.json({ error: 'Invalid session time.' }, { status: 400 });
    }

    if (parsedInput.data.tutorId !== authContext.userId) {
      return NextResponse.json({ error: 'Tutor identity mismatch.' }, { status: 403 });
    }

    const callerDoc = await adminDb.collection('users').doc(authContext.userId).get();
    if (!callerDoc.exists) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }

    const caller = callerDoc.data() as User;
    const isAdmin = isAdminRole(authContext.role);
    const isTutor = authContext.role === 'tutor';

    if (!isAdmin && !isTutor) {
      return NextResponse.json({ error: 'Only tutors and admins can create sessions.' }, { status: 403 });
    }

    const sessionId = `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const normalizedCourseId = (parsedInput.data.courseId || '').trim();

    const meta: Omit<LiveClass, 'id'> = {
      title: parsedInput.data.title.trim(),
      instructor: caller.name || 'Instructor',
      instructorId: authContext.userId,
      startTime: startTime.toISOString(),
      durationMinutes: parsedInput.data.durationMinutes,
      status: 'upcoming',
      ...(normalizedCourseId ? { courseId: normalizedCourseId } : {}),
    };

    const batch = adminDb.batch();
    batch.set(adminDb.collection('liveClasses').doc(sessionId), {
      id: sessionId,
      ...meta,
      createdAt: now,
    });
    batch.set(adminDb.collection('liveClassUrls').doc(sessionId), {
      zoomUrl: parsedInput.data.zoomUrl,
      instructorId: authContext.userId,
      createdAt: now,
    });

    await batch.commit();

    logger.info('[API live-sessions POST] created', {
      userId: authContext.userId,
      sessionId,
      courseId: normalizedCourseId || null,
    });

    return NextResponse.json({ id: sessionId }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[API live-sessions POST] failed', { error: message, userId: userIdForLog });
    return NextResponse.json(
      {
        error: 'Failed to create session. Please try again.',
        ...(process.env.NODE_ENV !== 'production' ? { details: message } : {}),
      },
      { status: 500 }
    );
  }
}
