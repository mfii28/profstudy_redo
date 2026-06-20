import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/affiliate/track
 * Body: { code: string }
 *
 * Increments the `clicks` counter on the affiliate document.
 * Called from the /ref/[code] landing page client-side after
 * storing the referral code in localStorage.
 *
 * Rate-limiting is handled by the global middleware (per-IP bucket).
 * No authentication required — this is a public impression event.
 */
export async function POST(request: NextRequest) {
  let code: string;

  try {
    const body = await request.json();
    code = typeof body?.code === 'string' ? body.code.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // Validate code format: alphanumeric + hyphens/underscores, max 128 chars
  if (!code || !/^[a-zA-Z0-9_-]{1,128}$/.test(code)) {
    return NextResponse.json({ error: 'Invalid affiliate code.' }, { status: 400 });
  }

  try {
    const affiliateRef = adminDb.collection('affiliates').doc(code);
    const snap = await affiliateRef.get();

    // Only track clicks for existing, active affiliates
    if (!snap.exists || snap.data()?.status !== 'active') {
      // Return 200 silently to avoid leaking whether a code exists
      return NextResponse.json({ ok: true });
    }

    await affiliateRef.update({
      clicks: FieldValue.increment(1),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Affiliate Track] Failed to record click:', err);
    return NextResponse.json({ error: 'Internal error.' }, { status: 500 });
  }
}
