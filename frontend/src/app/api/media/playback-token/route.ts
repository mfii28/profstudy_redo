import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { adminAuth, adminDb } from '@/firebase/admin';

const TOKEN_TTL_MS = 1000 * 60 * 5;

function sanitizeKey(key: string) {
  let decoded = key;
  try { decoded = decodeURIComponent(key); } catch { /* ignore */ }
  return decoded.replace(/\.\.[/\\]/g, '').replace(/[<>:"|?*\\]/g, '').replace(/\0/g, '').trim();
}

function normalizeOrigin(request: NextRequest): string {
  const originHeader = request.headers.get('origin');
  const refererHeader = request.headers.get('referer');
  if (originHeader) return originHeader;
  if (refererHeader) {
    try {
      return new URL(refererHeader).origin;
    } catch {
      return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    }
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!idToken) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    let decoded: { uid: string };
    try {
      decoded = await adminAuth.verifyIdToken(idToken) as { uid: string };
    } catch {
      return NextResponse.json({ error: 'Invalid session token.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const key = sanitizeKey(String(body?.key || ''));
    if (!key || key.startsWith('public/')) {
      return NextResponse.json({ error: 'Private media key is required.' }, { status: 400 });
    }

    const token = `pt_${randomUUID().replace(/-/g, '')}`;
    const now = Date.now();
    const expiresAt = new Date(now + TOKEN_TTL_MS).toISOString();
    const ua = request.headers.get('user-agent') || '';
    const origin = normalizeOrigin(request);

    await adminDb.doc(`mediaPlaybackTokens/${token}`).set({
      token,
      uid: decoded.uid,
      key,
      userAgent: ua.slice(0, 500),
      origin,
      expiresAt,
      createdAt: new Date(now).toISOString(),
      maxUses: 30,
      uses: 0,
    });

    return NextResponse.json({ token, expiresAt });
  } catch {
    return NextResponse.json({ error: 'Could not create playback token.' }, { status: 500 });
  }
}

