import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/firebase/admin';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '@/lib/s3-client';
import { isUserInCourseEnrollmentIndex } from '@/lib/enrollment-index';

/**
 * Streaming media proxy — fetches the object from R2 and pipes the
 * binary content back to the browser.  Unlike /api/media/file (which
 * 307-redirects to a cross-origin presigned URL), this route returns
 * the bytes directly so same-origin policies are satisfied.
 *
 * Used by react-pdf and other clients that need fetch()-based access
 * to R2 objects without CORS.
 *
 * Auth: Private keys (not starting with "public/") require a valid
 *       Firebase ID token in the Authorization header.
 */

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

function normalizeOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  if (origin) return origin;
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return '';
    }
  }
  return '';
}

function sameOrigin(left: string, right: string): boolean {
  if (!left || !right) return false;
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return left === right;
  }
}

async function validatePlaybackToken(
  request: NextRequest,
  uid: string,
  key: string,
): Promise<{ ok: boolean; reason: string }> {
  const playbackToken = request.nextUrl.searchParams.get('pt')?.trim();
  if (!playbackToken) return { ok: false, reason: 'missing_playback_token' };

  const tokenRef = adminDb.doc(`mediaPlaybackTokens/${playbackToken}`);
  const tokenSnap = await tokenRef.get();
  if (!tokenSnap.exists) return { ok: false, reason: 'invalid_playback_token' };

  const tokenData = tokenSnap.data() as {
    uid?: string;
    key?: string;
    userAgent?: string;
    origin?: string;
    expiresAt?: string;
    uses?: number;
    maxUses?: number;
  } | undefined;

  const now = Date.now();
  const expiresAtMs = new Date(tokenData?.expiresAt || 0).getTime();
  if (!expiresAtMs || expiresAtMs <= now) return { ok: false, reason: 'expired_playback_token' };
  if (tokenData?.uid !== uid) return { ok: false, reason: 'playback_uid_mismatch' };
  if (tokenData?.key !== key) return { ok: false, reason: 'playback_key_mismatch' };

  const requestUa = request.headers.get('user-agent') || '';
  const requestOrigin = normalizeOrigin(request);
  const tokenUserAgent = tokenData?.userAgent || '';
  const tokenOrigin = tokenData?.origin || '';
  if (tokenUserAgent && requestUa && tokenUserAgent !== requestUa) {
    console.warn('[Stream API] Playback user agent mismatch (allowed):', { tokenUserAgent, requestUa });
  }
  if (tokenOrigin && requestOrigin && !sameOrigin(tokenOrigin, requestOrigin)) {
    console.warn('[Stream API] Playback origin mismatch (allowed):', { tokenOrigin, requestOrigin });
  }

  const uses = Number(tokenData?.uses || 0);
  const maxUses = Number(tokenData?.maxUses || 30);
  if (uses >= maxUses) return { ok: false, reason: 'playback_use_limit_reached' };

  await tokenRef.set({ uses: uses + 1, lastUsedAt: new Date().toISOString() }, { merge: true });
  return { ok: true, reason: 'ok' };
}

/** Returns the allowed origin if the request origin is permitted, otherwise null. */
function getAllowedOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin') || '';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  // Allow same-origin, configured app URL, and localhost for development
  const allowedOrigins = [
    appUrl,
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter(Boolean);
  return allowedOrigins.includes(origin) ? origin : appUrl;
}

// CORS preflight handler for range requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': getAllowedOrigin(request),
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  });
}

/**
 * Checks whether the given user has access to the requested private key.
 * - For keys under private/courses/{courseId}/... → must be enrolled in that course, or be an admin/tutor owner.
 * - For keys under private/books/{bookId}/... → must have purchased that book.
 * - For keys under private/users/{uid}/... → must be that user.
 * - For keys under private/tutors/{uid}/... → must be that user or admin.
 */
async function verifyContentAccess(uid: string, cleanKey: string): Promise<{ allowed: boolean; reason: string }> {
  try {
    // Course lesson / assignment access
    const courseMatch = cleanKey.match(/^private\/courses\/([^/]+)\//)
    if (courseMatch) {
      const courseId = courseMatch[1];
      // 1. Check if the user is the tutor owner or an admin
      const [courseDoc, userDoc] = await Promise.all([
        adminDb.doc(`courses/${courseId}`).get(),
        adminDb.doc(`users/${uid}`).get(),
      ]);
      const userRole: string = userDoc.data()?.role || '';
      const isAdmin = ['admin', 'superadmin', 'subadmin'].includes(userRole);
      const courseData = courseDoc.exists ? (courseDoc.data() as { tutorId?: string; createdByTutorId?: string; assignedTutorIds?: string[] }) : null;
      const isTutorOwner = Boolean(
        courseData && (
          courseData.tutorId === uid ||
          courseData.createdByTutorId === uid ||
          (Array.isArray(courseData.assignedTutorIds) && courseData.assignedTutorIds.includes(uid))
        )
      );
      if (isAdmin || isTutorOwner) {
        return { allowed: true, reason: 'admin_or_owner' };
      }
      // 2. Check enrollment via index (fallback to user document array for legacy records)
      let isEnrolled = await isUserInCourseEnrollmentIndex(courseId, uid);
      if (!isEnrolled) {
        const enrollments: { courseId: string }[] = userDoc.data()?.enrollments || [];
        isEnrolled = enrollments.some((e) => e.courseId === courseId);
      }
      if (isEnrolled) {
        return { allowed: true, reason: 'enrolled' };
      }
      return { allowed: false, reason: 'not_enrolled' };
    }

    // Book file access
    const bookMatch = cleanKey.match(/^private\/books\/([^/]+)\//)
    if (bookMatch) {
      const bookId = bookMatch[1];
      const purchasesSnap = await adminDb
        .collection('bookPurchases')
        .where('userId', '==', uid)
        .where('bookId', '==', bookId)
        .limit(1)
        .get();
      if (!purchasesSnap.empty) {
        return { allowed: true, reason: 'purchased' };
      }

      // Course-linked entitlement: only users who explicitly purchased a "course + book" bundle can access.
      const ordersSnap = await adminDb
        .collection('orders')
        .where('userId', '==', uid)
        .limit(50)
        .get();
      for (const orderDoc of ordersSnap.docs) {
        const orderData = orderDoc.data() as { courseBookEntitlements?: Array<{ bookId?: string }> };
        const entitlements = Array.isArray(orderData.courseBookEntitlements) ? orderData.courseBookEntitlements : [];
        if (entitlements.some((entry) => entry?.bookId === bookId)) {
          return { allowed: true, reason: 'course_bundle_entitlement' };
        }
      }

      // Admins can also access book files
      const userSnap = await adminDb.doc(`users/${uid}`).get();
      const userData = userSnap.exists ? (userSnap.data() as { role?: string }) : null;
      const userRole: string = userData?.role || '';
      if (['admin', 'superadmin', 'subadmin'].includes(userRole)) {
        return { allowed: true, reason: 'admin' };
      }
      return { allowed: false, reason: 'book_not_purchased' };
    }

    // User-scoped private content — user can only access their own
    const userScopeMatch = cleanKey.match(/^private\/users\/([^/]+)\//)
    if (userScopeMatch) {
      return { allowed: userScopeMatch[1] === uid, reason: userScopeMatch[1] === uid ? 'own_content' : 'wrong_user' };
    }

    // Tutor library — tutor or admin
    const tutorScopeMatch = cleanKey.match(/^private\/tutors\/([^/]+)\//)
    if (tutorScopeMatch) {
      if (tutorScopeMatch[1] === uid) return { allowed: true, reason: 'own_content' };
      const userDoc = await adminDb.doc(`users/${uid}`).get();
      const userRole: string = userDoc.data()?.role || '';
      return { allowed: ['admin', 'superadmin'].includes(userRole), reason: 'admin' };
    }

    // Unknown private path — deny by default
    return { allowed: false, reason: 'unknown_private_path' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Stream API] Content access check failed:', msg);
    // Fail closed on errors
    return { allowed: false, reason: 'access_check_error' };
  }
}

function sanitizeKey(key: string) {
  let decoded = key;
  try { decoded = decodeURIComponent(key); } catch { /* keep original */ }
  let prev = '';
  while (prev !== decoded) {
    prev = decoded;
    decoded = decoded.replace(/\.\.[/\\]/g, '').replace(/%2e%2e[/\\%]/gi, '');
  }
  return decoded.replace(/[<>:"|?*\\]/g, '').replace(/\0/g, '').trim();
}

export async function GET(request: NextRequest) {
  const keyParam = request.nextUrl.searchParams.get('key');
  const range = request.headers.get('range');
  console.log('[Stream API] Request received:', { 
    key: keyParam, 
    hasAuthHeader: !!request.headers.get('authorization'),
    hasRange: !!range,
    range: range
  });
  
  if (!keyParam) {
    console.log('[Stream API] Missing key parameter');
    return NextResponse.json({ error: 'Missing key parameter.' }, { status: 400 });
  }

  const cleanKey = sanitizeKey(keyParam);
  console.log('[Stream API] Sanitized key:', cleanKey);

  const requestUserAgent = request.headers.get('user-agent') || '';
  if (isBlockedUserAgent(requestUserAgent)) {
    return NextResponse.json({ error: 'Download agent blocked.' }, { status: 403 });
  }

  // Private assets require authentication AND content-level access control
  if (!cleanKey.startsWith('public/')) {
    console.log('[Stream API] Private key detected, checking auth');
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '') || request.cookies.get('__session')?.value || '';
    const playbackToken = request.nextUrl.searchParams.get('pt')?.trim() || '';

    let verifiedUid = '';

    if (playbackToken) {
      // 1. Retrieve the playback token from Firestore
      const tokenRef = adminDb.doc(`mediaPlaybackTokens/${playbackToken}`);
      const tokenSnap = await tokenRef.get();
      if (!tokenSnap.exists) {
        return NextResponse.json({ error: 'Invalid playback token.' }, { status: 403 });
      }
      const tokenData = tokenSnap.data() as {
        uid?: string;
        key?: string;
        userAgent?: string;
        origin?: string;
        expiresAt?: string;
        uses?: number;
        maxUses?: number;
      } | undefined;

      const now = Date.now();
      const expiresAtMs = new Date(tokenData?.expiresAt || 0).getTime();
      if (!expiresAtMs || expiresAtMs <= now) {
        return NextResponse.json({ error: 'Expired playback token.' }, { status: 403 });
      }
      if (tokenData?.key !== cleanKey) {
        return NextResponse.json({ error: 'Playback key mismatch.' }, { status: 403 });
      }

      const requestUa = request.headers.get('user-agent') || '';
      const requestOrigin = normalizeOrigin(request);
      const tokenUserAgent = tokenData?.userAgent || '';
      const tokenOrigin = tokenData?.origin || '';
      if (tokenUserAgent && requestUa && tokenUserAgent !== requestUa) {
        console.warn('[Stream API] Playback user agent mismatch (allowed):', { tokenUserAgent, requestUa });
      }
      if (tokenOrigin && requestOrigin && !sameOrigin(tokenOrigin, requestOrigin)) {
        console.warn('[Stream API] Playback origin mismatch (allowed):', { tokenOrigin, requestOrigin });
      }

      const uses = Number(tokenData?.uses || 0);
      const maxUses = Number(tokenData?.maxUses || 30);
      if (uses >= maxUses) {
        return NextResponse.json({ error: 'Playback use limit reached.' }, { status: 403 });
      }

      // Increment uses
      await tokenRef.set({ uses: uses + 1, lastUsedAt: new Date().toISOString() }, { merge: true });
      verifiedUid = tokenData?.uid || '';
    } else {
      // Fallback: Check ID Token in headers / cookie if no playback token is present
      if (!token) {
        console.log('[Stream API] No auth token or playback token provided for private key');
        return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
      }

      try {
        const decoded = await adminAuth.verifyIdToken(token);
        verifiedUid = decoded.uid;
        console.log('[Stream API] Token verified for user:', verifiedUid);
      } catch (error) {
        console.error('[Stream API] Token verification failed:', error);
        return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 403 });
      }
    }

    if (!verifiedUid) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    // Enrollment / purchase access check
    const { allowed, reason } = await verifyContentAccess(verifiedUid, cleanKey);
    console.log('[Stream API] Content access check:', { allowed, reason, uid: verifiedUid });
    if (!allowed) {
      return NextResponse.json(
        { error: 'Access denied. Enroll in this course to access content.' },
        { status: 403 }
      );
    }
  } else {
    console.log('[Stream API] Public key, no auth required');
  }

  try {
    console.log('[Stream API] Generating presigned URL for bucket:', BUCKET_NAME, 'key:', cleanKey);
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: cleanKey,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    console.log('[Stream API] Presigned URL generated, fetching from R2');
    
    const upstream = await fetch(signedUrl);
    console.log('[Stream API] R2 fetch result:', { status: upstream.status, ok: upstream.ok });

    if (!upstream.ok) {
      console.error('[Stream API] R2 fetch failed with status:', upstream.status);
      return NextResponse.json(
        { error: 'Object not found or inaccessible.' },
        { status: upstream.status },
      );
    }

    const contentType = upstream.headers.get('content-type') || 'application/pdf';
    const contentLength = upstream.headers.get('content-length');
    const acceptRanges = upstream.headers.get('accept-ranges');
    const contentRange = upstream.headers.get('content-range');
    
    console.log('[Stream API] Streaming response:', { 
      contentType, 
      contentLength, 
      acceptRanges,
      contentRange,
      status: upstream.status 
    });

    // Production-ready headers for React-PDF compatibility
    const headers: HeadersInit = {
      // CRITICAL: These headers are non-negotiable for React-PDF
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Content-Disposition': 'inline; filename="document.pdf"',
      
      // CORS headers — scoped to allowed origins, not wildcard
      'Access-Control-Allow-Origin': getAllowedOrigin(request),
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Authorization, Content-Type',
      'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Length, Content-Range, Content-Type',
      'Vary': 'Origin',
      
      // Cache control to prevent Cloudflare modification
      'Cache-Control': 'private, max-age=300, no-transform',
      'X-Content-Type-Options': 'nosniff',
      
      // Cloudflare bypass hints
      'CF-Cache-Status': 'DYNAMIC',
    };
    
    // Preserve length and range headers from upstream
    if (contentLength) {
      headers['Content-Length'] = contentLength;
    }
    if (contentRange) {
      headers['Content-Range'] = contentRange;
    }

    return new NextResponse(upstream.body, { 
      status: upstream.status, // Preserve 206 for range requests
      headers 
    });
  } catch (error: unknown) {
    console.error('[Stream API] Failed to stream key:', cleanKey, error);
    return NextResponse.json(
      { error: 'Failed to retrieve media.' },
      { status: 500 },
    );
  }
}
