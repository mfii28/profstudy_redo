import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, ensureR2Cors } from '@/lib/s3-client';
import { adminAuth, adminDb } from '@/firebase/admin';
import { Readable } from 'stream';

// Allow up to 5 minutes for large video uploads
export const maxDuration = 300;

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'profstudymate';
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

// Allowed MIME types for uploads
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
  'application/pdf',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/ogg',
  'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

/**
 * Proxy upload endpoint that streams the file body to R2.
 * This avoids browser CORS issues with presigned PUT URLs by routing
 * the upload through our own origin.
 *
 * Authentication: Requires a valid Firebase ID token in the
 * Authorization header. The token is verified server-side and the
 * resulting UID is checked to ensure the upload key belongs to that
 * user (or the user has an admin role).
 *
 * The caller must first obtain a storage key from getPresignedUploadUrl(),
 * then POST the file here with the key, content-type, and auth token.
 */
export async function PUT(request: NextRequest) {
  // Ensure CORS rules are on the bucket so future direct browser→R2 uploads work
  ensureR2Cors().catch(() => {});

  // --- Auth ---
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  let verifiedUid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    verifiedUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 403 });
  }

  // --- Key ---
  const key = request.headers.get('x-upload-key');
  const contentType = request.headers.get('content-type') || 'application/octet-stream';

  // --- MIME validation ---
  if (!ALLOWED_MIME_TYPES.has(contentType) && !contentType.startsWith('image/') && !contentType.startsWith('video/') && !contentType.startsWith('audio/')) {
    return NextResponse.json({ error: 'File type not allowed.' }, { status: 415 });
  }

  // Block executable file types
  const blockedExtensions = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.scr', '.ps1', '.vbs', '.dll', '.jar', '.wasm', '.bin'];
  if (key && blockedExtensions.some(ext => key.toLowerCase().endsWith(ext))) {
    return NextResponse.json({ error: 'Executable files are not allowed.' }, { status: 415 });
  }

  if (!key) {
    return NextResponse.json({ error: 'Missing x-upload-key header.' }, { status: 400 });
  }

  // Basic path traversal protection
  if (key.includes('..') || key.includes('\0')) {
    return NextResponse.json({ error: 'Invalid key.' }, { status: 400 });
  }

  // --- Authorization: verify the upload key belongs to the authenticated user ---
  // Keys for private user content must strictly match the user's own path.
  // Use a regex to ensure the UID is not just a substring of another path.
  const ownPathRegex = new RegExp(`/(?:users/|user-)${verifiedUid}(?:_|/)`, 'i');
  const isOwnPath = ownPathRegex.test(key);

  if (!isOwnPath) {
    // Check if the user has an elevated role that allows uploading to shared paths
    // (e.g. product images, book covers, branding)
    try {
      const userDoc = await adminDb.doc(`users/${verifiedUid}`).get();
      const role: string = userDoc.data()?.role || '';
      const isElevated = ['admin', 'superadmin', 'subadmin', 'tutor'].includes(role);
      if (!isElevated) {
        console.warn('[Upload Proxy] Unauthorized path for user', { uid: verifiedUid, key });
        return NextResponse.json({ error: 'Permission denied.' }, { status: 403 });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Upload Proxy] Role check failed:', msg);
      return NextResponse.json({ error: 'Authorization check failed.' }, { status: 500 });
    }
  }

  // --- Size check ---
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 100 MB).' }, { status: 413 });
  }

  // --- Upload ---
  try {
    // Next.js 15+ Request.body is a ReadableStream. 
    // The AWS SDK PutObjectCommand can accept a Node.js Readable.
    if (!request.body) {
      return NextResponse.json({ error: 'Empty request body.' }, { status: 400 });
    }

    const nodeStream = Readable.fromWeb(request.body as any);

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: nodeStream,
      ContentType: contentType,
      ContentLength: contentLength > 0 ? contentLength : undefined,
    }));

    return NextResponse.json({ success: true, key }, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Upload Proxy] R2 PutObject failed:', key, msg);
    return NextResponse.json({ error: 'Upload failed.' }, { status: 502 });
  }
}
