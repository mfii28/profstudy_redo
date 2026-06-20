import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';
import type { LiveClass, User } from '@/lib/db';
import { logger } from '@/lib/logging';
import { isAdminRole, validateTrustedServerContext } from '@/lib/trusted-server-context';

export async function DELETE(
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

    const [sessionSnap, userSnap] = await Promise.all([
      adminDb.collection('liveClasses').doc(sessionId).get(),
      adminDb.collection('users').doc(authContext.userId).get(),
    ]);

    if (!sessionSnap.exists) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
    }
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }

    const session = sessionSnap.data() as LiveClass;
    const user = userSnap.data() as User;
    const isAdmin = isAdminRole(authContext.role);

    if (!isAdmin && session.instructorId !== authContext.userId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const batch = adminDb.batch();
    batch.delete(adminDb.collection('liveClasses').doc(sessionId));
    batch.delete(adminDb.collection('liveClassUrls').doc(sessionId));
    await batch.commit();

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[API live-sessions DELETE] failed', { error: message });
    return NextResponse.json({ error: 'Failed to delete session.' }, { status: 500 });
  }
}
