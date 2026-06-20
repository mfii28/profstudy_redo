import { NextResponse } from 'next/server';
import { processDueCommunicationQueue } from '@/lib/communication-queue';

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const expected = process.env.INTERNAL_JOBS_SECRET;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await processDueCommunicationQueue(200);
  return NextResponse.json({ ok: true, ...result });
}
