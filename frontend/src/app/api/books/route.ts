import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';
import { isAdminRole, validateTrustedServerContext } from '@/lib/trusted-server-context';
import { firebaseConfig } from '@/firebase/config';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  query,
} from 'firebase/firestore';

type BookRecord = Record<string, unknown> & { id: string };

async function fetchPublishedBooksViaPublicSdk(options: {
  pageSize: number;
  type: string | null;
  search: string;
}) {
  const { pageSize, type, search } = options;

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error('Public Firebase config is missing for fallback query.');
  }

  const appName = 'books-api-public-fallback';
  const app = getApps().some((entry) => entry.name === appName)
    ? getApp(appName)
    : initializeApp(firebaseConfig, appName);
  const db = getFirestore(app);

  const q = query(
    collection(db, 'books'),
    limit(Math.max(pageSize * 3, pageSize + 1))
  );

  const snap = await getDocs(q);
  let books: BookRecord[] = snap.docs
    .map((entry): BookRecord => ({
      ...(entry.data() as Record<string, unknown>),
      id: entry.id,
    }))
    .filter((book) => ['published'].includes(String(book['status'] || '').toLowerCase()));

  if (type === 'digital' || type === 'physical') {
    books = books.filter((book) => String(book['type'] || '') === type);
  }

  if (search) {
    books = books.filter((book) => {
      const title = String(book['title'] || '').toLowerCase();
      const author = String(book['author'] || '').toLowerCase();
      const category = String(book['category'] || '').toLowerCase();
      return title.includes(search) || author.includes(search) || category.includes(search);
    });
  }
  books.sort((a, b) => String(b['createdAt'] || '').localeCompare(String(a['createdAt'] || '')));

  const hasMore = books.length > pageSize;
  const trimmed = books.slice(0, pageSize);
  const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id || null : null;

  return { books: trimmed, pageSize, hasMore, nextCursor };
}

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams.get('search')?.toLowerCase().trim() || '';
    const type = req.nextUrl.searchParams.get('type');
    const includeDraftRequested = req.nextUrl.searchParams.get('includeDraft') === 'true';
    let includeDraft = false;

    if (includeDraftRequested) {
      const ctx = await validateTrustedServerContext(req);
      if (!ctx.success || !isAdminRole(ctx.role)) {
        return NextResponse.json({ error: 'Admin access required for draft books.' }, { status: 403 });
      }
      includeDraft = true;
    }

    const pageSize = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit') || 20), 1), 50);
    try {
      const snap = await adminDb.collection('books').limit(Math.max(pageSize * 3, pageSize + 1)).get();
      let books: BookRecord[] = snap.docs
        .map((entry): BookRecord => ({
          ...(entry.data() as Record<string, unknown>),
          id: entry.id,
        }))
        .filter((book) => {
          if (includeDraft) return true;
          return ['published'].includes(String(book['status'] || '').toLowerCase());
        });

      if (type === 'digital' || type === 'physical') {
        books = books.filter((book) => String(book['type'] || '') === type);
      }

      if (search) {
        books = books.filter((book) => {
          const title = String(book['title'] || '').toLowerCase();
          const author = String(book['author'] || '').toLowerCase();
          const category = String(book['category'] || '').toLowerCase();
          return title.includes(search) || author.includes(search) || category.includes(search);
        });
      }
      books.sort((a, b) => String(b['createdAt'] || '').localeCompare(String(a['createdAt'] || '')));

      const hasMore = books.length > pageSize;
      const trimmed = books.slice(0, pageSize);
      const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id || null : null;

      return NextResponse.json({ books: trimmed, pageSize, hasMore, nextCursor });
    } catch (adminError) {
      if (includeDraft) {
        throw adminError;
      }

      console.warn('[Books API] Admin query failed, falling back to public SDK query:', adminError);
      const fallbackResult = await fetchPublishedBooksViaPublicSdk({ pageSize, type, search });
      return NextResponse.json(fallbackResult);
    }
  } catch (error) {
    console.error('[Books API] GET failed:', error);
    return NextResponse.json({ error: 'Failed to fetch books.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await validateTrustedServerContext(req);
  if (!ctx.success || !ctx.userId || !isAdminRole(ctx.role)) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  try {
    const payload = await req.json();
    const title = String(payload.title || '').trim();
    const author = String(payload.author || '').trim();
    const description = String(payload.description || '').trim();
    const category = String(payload.category || '').trim();
    const type = payload.type === 'physical' ? 'physical' : 'digital';
    const status = payload.status === 'Draft' ? 'Draft' : 'Published';
    const submittedPrice = Number(payload.price ?? 0);
    const requestedFree = Boolean(payload.isFree);

    if (!title || !author || !description || !category) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    if (!Number.isFinite(submittedPrice) || submittedPrice < 0) {
      return NextResponse.json({ error: 'Invalid price.' }, { status: 400 });
    }

    const normalizedIsFree = requestedFree || submittedPrice === 0;
    const normalizedPrice = normalizedIsFree
      ? 0
      : Math.round(submittedPrice * 100) / 100;

    if (!normalizedIsFree && normalizedPrice <= 0) {
      return NextResponse.json({ error: 'Paid books must have a price greater than 0.' }, { status: 400 });
    }

    const id = payload.id && String(payload.id).trim().length > 0
      ? String(payload.id)
      : `book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const now = new Date().toISOString();
    const data: Record<string, unknown> = {
      id,
      title,
      author,
      description,
      category,
      type,
      status,
      price: normalizedPrice,
      isFree: normalizedIsFree,
      coverUrl: String(payload.coverUrl || ''),
      fileKey: String(payload.fileKey || ''),
      tags: Array.isArray(payload.tags) ? payload.tags.map((tag: unknown) => String(tag)) : [],
      createdAt: payload.createdAt ? String(payload.createdAt) : now,
      updatedAt: now,
      updatedBy: ctx.userId,
    };

    if (payload.isbn) data.isbn = String(payload.isbn);
    if (payload.pages) data.pages = Number(payload.pages);
    if (payload.stockCount != null) data.stockCount = Number(payload.stockCount);
    if (payload.shippingEst) data.shippingEst = String(payload.shippingEst);

    await adminDb.doc(`books/${id}`).set(data, { merge: true });
    return NextResponse.json({ id, book: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Books API] POST failed:', err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Failed to save book.' },
      { status: 500 }
    );
  }
}
