import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/firebase/admin';
import { deleteAsset } from '@/app/actions/storage';

type AdminRole = 'admin' | 'superadmin' | 'subadmin';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

async function getRequestContext(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return { uid: null, role: null as string | null };
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.doc(`users/${decoded.uid}`).get();
    const role = userSnap.exists ? (userSnap.data()?.role as string | undefined) : null;
    return { uid: decoded.uid, role: role ?? null };
  } catch {
    return { uid: null, role: null as string | null };
  }
}

function isAdminRole(role: string | null): role is AdminRole {
  return role === 'admin' || role === 'superadmin' || role === 'subadmin';
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const ctx = await getRequestContext(req);
    let snap = await adminDb.doc(`books/${id}`).get();

    // Backward compatibility: legacy links may use a stored `id` field that
    // does not match the Firestore document ID.
    if (!snap.exists) {
      const fallback = await adminDb
        .collection('books')
        .where('id', '==', id)
        .limit(1)
        .get();

      if (!fallback.empty) {
        snap = fallback.docs[0];
      }
    }

    if (!snap.exists) {
      return NextResponse.json({ error: 'Book not found.' }, { status: 404 });
    }

    const book: Record<string, unknown> & { id: string } = {
      ...(snap.data() as Record<string, unknown>),
      id: snap.id,
    };
    const isPublished = String(book['status'] || '').toLowerCase() === 'published';
    if (!isPublished && !isAdminRole(ctx.role)) {
      return NextResponse.json({ error: 'Book not found.' }, { status: 404 });
    }

    return NextResponse.json({ book });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch book.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getRequestContext(req);
  if (!ctx.uid || !isAdminRole(ctx.role)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  try {
    const payload = await req.json();
    await adminDb.doc(`books/${id}`).set({
      ...payload,
      id,
      updatedAt: new Date().toISOString(),
      updatedBy: ctx.uid,
    }, { merge: true });

    const updated = await adminDb.doc(`books/${id}`).get();
    return NextResponse.json({ book: { ...(updated.data() as Record<string, unknown>), id: updated.id } });
  } catch {
    return NextResponse.json({ error: 'Failed to update book.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ctx = await getRequestContext(req);
  if (!ctx.uid || !isAdminRole(ctx.role)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  try {
    const ref = adminDb.doc(`books/${id}`);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: true });

    const data = snap.data() || {};
    if (data.coverUrl && String(data.coverUrl).startsWith('public/')) {
      await deleteAsset(String(data.coverUrl), ctx.uid);
    }
    if (data.fileKey && String(data.fileKey).startsWith('private/')) {
      await deleteAsset(String(data.fileKey), ctx.uid);
    }

    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete book.' }, { status: 500 });
  }
}
