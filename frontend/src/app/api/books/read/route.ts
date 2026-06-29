import { GetObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';
import { s3Client } from '@/lib/s3-client';

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'profstudymate';
const BLOCKED_USER_AGENT_PATTERNS = [
  /idm/i,
  /internet download manager/i,
  /aria2/i,
  /wget/i,
  /curl/i,
  /python-requests/i,
  /yt-dlp/i,
];

function isBlockedUserAgent(userAgent: string): boolean {
  return BLOCKED_USER_AGENT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

async function hasCourseLinkedBookAccess(userId: string, bookId: string): Promise<boolean> {
  const userSnap = await adminDb.doc(`users/${userId}`).get();
  if (!userSnap.exists) return false;

  const userData = userSnap.data() as { enrollments?: Array<{ courseId?: string }> } | undefined;
  const enrollments = Array.isArray(userData?.enrollments) ? userData!.enrollments! : [];
  const courseIds = enrollments
    .map((enrollment) => enrollment?.courseId)
    .filter((courseId): courseId is string => typeof courseId === 'string' && courseId.length > 0);

  if (courseIds.length === 0) return false;

  for (let i = 0; i < courseIds.length; i += 100) {
    const chunk = courseIds.slice(i, i + 100);
    const refs = chunk.map((courseId) => adminDb.doc(`courses/${courseId}`));
    const courseSnaps = await adminDb.getAll(...refs);

    for (const courseSnap of courseSnaps) {
      if (!courseSnap.exists) continue;
      const courseData = courseSnap.data() as { books?: Array<{ id?: string }> };
      const linkedBooks = Array.isArray(courseData.books) ? courseData.books : [];
      if (linkedBooks.some((bookRef) => bookRef?.id === bookId)) {
        return true;
      }
    }
  }

  return false;
}

export async function GET(req: NextRequest) {
  const userAgent = req.headers.get('user-agent') || '';
  if (isBlockedUserAgent(userAgent)) {
    return NextResponse.json({ error: 'Download agent blocked.' }, { status: 403 });
  }

  const token = req.nextUrl.searchParams.get('token')?.trim();
  if (!token) {
    return NextResponse.json({ error: 'Reader token is required.' }, { status: 400 });
  }

  try {
    const sessionRef = adminDb.doc(`bookReaderSessions/${token}`);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      return NextResponse.json({ error: 'Invalid reader session.' }, { status: 403 });
    }

    const session = sessionSnap.data() as {
      userId: string;
      bookId: string;
      fileKey: string;
      expiresAt: string;
    };

    if (!session?.userId || !session?.bookId || !session?.fileKey || !session?.expiresAt) {
      return NextResponse.json({ error: 'Reader session is malformed.' }, { status: 403 });
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await sessionRef.delete();
      return NextResponse.json({ error: 'Reader session expired.' }, { status: 403 });
    }

    const [bookSnap, purchaseSnap] = await Promise.all([
      adminDb.doc(`books/${session.bookId}`).get(),
      adminDb
        .collection('bookPurchases')
        .where('userId', '==', session.userId)
        .where('bookId', '==', session.bookId)
        .limit(1)
        .get(),
    ]);

    if (!bookSnap.exists) {
      return NextResponse.json({ error: 'Book not found.' }, { status: 404 });
    }

    const book = bookSnap.data() as { type?: string; fileKey?: string };
    if (book.type !== 'digital') {
      return NextResponse.json({ error: 'Only digital books can be streamed.' }, { status: 403 });
    }

    if (purchaseSnap.empty) {
      const hasLinkedAccess = await hasCourseLinkedBookAccess(session.userId, session.bookId);
      if (!hasLinkedAccess) {
        return NextResponse.json({ error: 'Purchase required.' }, { status: 403 });
      }
    }

    if (!book.fileKey || book.fileKey !== session.fileKey) {
      return NextResponse.json({ error: 'Book file unavailable.' }, { status: 404 });
    }

    const object = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: book.fileKey,
    }));

    const body = object.Body;
    if (!body) {
      return NextResponse.json({ error: 'Book file missing.' }, { status: 404 });
    }

    // Stream the file directly instead of buffering to avoid OOM on large PDFs
    const webStream = body.transformToWebStream();

    return new Response(webStream, {
      headers: {
        'Content-Type': object.ContentType || 'application/pdf',
        'Content-Disposition': 'inline; filename="reader.pdf"',
        'Cache-Control': 'private, no-store, max-age=0',
        'Pragma': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to stream digital book.' }, { status: 500 });
  }
}
