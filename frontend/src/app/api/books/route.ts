import { NextRequest, NextResponse } from 'next/server';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get('search')?.toLowerCase().trim() || '';
    const type = req.nextUrl.searchParams.get('type');
    const pageSize = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit') || 20), 1), 50);

    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type) params.set('type', type);
    params.set('limit', String(pageSize));

    const res = await fetch(`${API_URL}/books?${params.toString()}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Backend fetch failed');
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Books API] GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch books.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const res = await fetch(`${API_URL}/books`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json(data, { status: res.status });
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Books API] POST failed:', error);
    return NextResponse.json({ error: 'Failed to create book.' }, { status: 500 });
  }
}
