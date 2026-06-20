'use server';

import crypto from 'crypto';
import { adminDb, adminAuth } from '@/firebase/admin';
import { initializeTransaction } from '@/app/actions/payments';
import { type UserAddress } from '@/lib/db';

/**
 * @fileOverview Book purchase server actions.
 * SECURITY: Price re-fetched from Firestore on the server — no client-side amount trust.
 * IDEMPOTENCY: Duplicate purchases blocked per user/book.
 */

interface PurchaseBookResult {
  error?: string;
  authorization_url?: string;
  reference?: string;
}

async function verifyUserToken(idToken: string): Promise<{ uid?: string; error?: string }> {
  if (!idToken) return { error: 'Authentication required.' };
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return { uid: decoded.uid };
  } catch {
    return { error: 'Session expired. Please sign in again.' };
  }
}

export async function purchaseBook(
  bookId: string,
  idToken: string,
  email: string,
  shippingAddress?: UserAddress
): Promise<PurchaseBookResult> {
  const auth = await verifyUserToken(idToken);
  if (auth.error || !auth.uid) return { error: auth.error };
  const uid = auth.uid;

  // Re-fetch book from Firestore — never trust client price
  const bookSnap = await adminDb.doc(`books/${bookId}`).get();
  if (!bookSnap.exists) return { error: 'Book not found.' };
  const book = bookSnap.data()!;

  if (String(book.status || '').toLowerCase() !== 'published') {
    return { error: 'This book is not available for purchase.' };
  }

  // Block duplicate purchases
  const existing = await adminDb
    .collection('bookPurchases')
    .where('userId', '==', uid)
    .where('bookId', '==', bookId)
    .limit(1)
    .get();
  if (!existing.empty) return { error: 'You have already purchased this book.' };

  const rawPrice = Number(book.price ?? 0);
  const isFreeBook = Boolean(book.isFree) || rawPrice === 0;
  if (isFreeBook) return { error: 'This book is free. Use the free claim action instead.' };
  if (!Number.isFinite(rawPrice) || rawPrice <= 0) return { error: 'Invalid book price.' };
  const price = Math.round(rawPrice * 100) / 100;

  const metadata = {
    checkoutType: 'book_purchase',
    userId: uid,
    bookId,
    bookTitle: book.title,
    bookType: book.type,
    amount: price,
    shippingAddress: shippingAddress ?? null,
  };

  return initializeTransaction(idToken, email, price, metadata);
}

interface ClaimFreeBookResult {
  error?: string;
  ok?: boolean;
}

export async function claimFreeBook(
  bookId: string,
  idToken: string
): Promise<ClaimFreeBookResult> {
  const auth = await verifyUserToken(idToken);
  if (auth.error || !auth.uid) return { error: auth.error };
  const uid = auth.uid;

  const bookSnap = await adminDb.doc(`books/${bookId}`).get();
  if (!bookSnap.exists) return { error: 'Book not found.' };
  const book = bookSnap.data()!;

  if (String(book.status || '').toLowerCase() !== 'published') return { error: 'This book is not available.' };
  const rawPrice = Number(book.price ?? 0);
  const isFreeBook = Boolean(book.isFree) || rawPrice === 0;
  if (!isFreeBook) return { error: 'This book is not free.' };
  if (book.type !== 'digital') return { error: 'Free claim is only available for digital books.' };

  // Idempotent — silently succeed if already claimed
  const existing = await adminDb
    .collection('bookPurchases')
    .where('userId', '==', uid)
    .where('bookId', '==', bookId)
    .limit(1)
    .get();
  if (!existing.empty) return { ok: true };

  const now = new Date().toISOString();
  await adminDb.collection('bookPurchases').add({
    userId: uid,
    bookId,
    bookTitle: String(book.title || ''),
    bookType: 'digital',
    amount: 0,
    purchasedAt: now,
    paymentReference: 'free',
    orderReference: `free-${uid}-${bookId}-${Date.now()}`,
    createdAt: now,
  });

  return { ok: true };
}

interface BookReaderSessionResult {
  error?: string;
  token?: string;
  expiresAt?: string;
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

export async function createBookReaderSession(
  bookId: string,
  idToken: string
): Promise<BookReaderSessionResult> {
  const auth = await verifyUserToken(idToken);
  if (auth.error || !auth.uid) return { error: auth.error };
  const uid = auth.uid;

  // Verify direct purchase or course-linked entitlement
  const purchases = await adminDb
    .collection('bookPurchases')
    .where('userId', '==', uid)
    .where('bookId', '==', bookId)
    .limit(1)
    .get();

  if (purchases.empty) {
    const hasLinkedAccess = await hasCourseLinkedBookAccess(uid, bookId);
    if (!hasLinkedAccess) return { error: 'Purchase not found.' };
  }

  // Fetch book and assert read-only digital flow
  const bookSnap = await adminDb.doc(`books/${bookId}`).get();
  if (!bookSnap.exists) return { error: 'Book not found.' };
  const bookData = bookSnap.data()!;
  if (bookData.type !== 'digital') return { error: 'Only digital books can be read online.' };
  const fileKey = bookData.fileKey as string | undefined;
  if (!fileKey) return { error: 'Book file is not available yet.' };

  // Time-scoped viewer token (15 minutes)
  const token = `brs_${crypto.randomBytes(18).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await adminDb.doc(`bookReaderSessions/${token}`).set({
    token,
    userId: uid,
    bookId,
    fileKey,
    expiresAt,
    createdAt: new Date().toISOString(),
  });

  return { token, expiresAt };
}
