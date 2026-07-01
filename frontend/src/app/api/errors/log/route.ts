import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple client-side error log endpoint.
 * Receives errors from the browser and logs them server-side.
 * In production, forward these to Sentry or your logging service.
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Log to server console
    console.error('[ClientError]', {
      message: body.message,
      url: body.url,
      timestamp: body.timestamp,
      context: body.context,
    });

    // In production, forward to external service:
    // if (process.env.SENTRY_DSN) { ... forward to Sentry ... }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
