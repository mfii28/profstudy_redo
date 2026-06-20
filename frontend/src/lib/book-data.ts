import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { Book, BookPurchase } from './db';

/**
 * @fileOverview Client-side data service for the Books marketplace.
 * All reads are scoped — no full-collection overfetch.
 */

export const getBooks = async (opts?: {
  includeDraft?: boolean;
  type?: 'digital' | 'physical';
  max?: number;
}): Promise<Book[]> => {
  if (!db) return [];
  try {
    const booksRef = collection(db, 'books');
    const constraints: any[] = [];
    if (!opts?.includeDraft) constraints.push(where('status', 'in', ['Published', 'published']));
    if (opts?.type) constraints.push(where('type', '==', opts.type));
    if (opts?.max && opts.max > 0) constraints.push(limit(Math.max(opts.max * 3, opts.max)));
    const q = query(booksRef, ...constraints);
    const snap = await getDocs(q);
    const books = snap.docs
      .map((d) => ({ ...(d.data() as Record<string, unknown>), id: d.id } as Book))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return opts?.max && opts.max > 0 ? books.slice(0, opts.max) : books;
  } catch {
    return [];
  }
};

export const getBookById = async (id: string): Promise<Book | null> => {
  if (!db || !id) return null;
  try {
    const snap = await getDoc(doc(db, 'books', id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Book;
  } catch {
    return null;
  }
};

export const getUserBookPurchases = async (userId: string): Promise<BookPurchase[]> => {
  if (!db || !userId) return [];
  try {
    const ref = collection(db, 'bookPurchases');
    const q = query(ref, where('userId', '==', userId), orderBy('purchasedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as BookPurchase));
  } catch {
    return [];
  }
};

export const getAllBookPurchases = async (): Promise<BookPurchase[]> => {
  if (!db) return [];
  try {
    const ref = collection(db, 'bookPurchases');
    const q = query(ref, orderBy('purchasedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as BookPurchase));
  } catch {
    return [];
  }
};

export const hasUserPurchasedBook = async (
  userId: string,
  bookId: string
): Promise<boolean> => {
  if (!db || !userId || !bookId) return false;
  try {
    const ref = collection(db, 'bookPurchases');
    const q = query(ref, where('userId', '==', userId), where('bookId', '==', bookId));
    const snap = await getDocs(q);
    if (!snap.empty) return true;

    // Course-linked entitlement fallback: if user is enrolled in a course that
    // references this book, treat it as owned in the student library.
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (!userSnap.exists()) return false;
    const userData = userSnap.data() as { enrollments?: Array<{ courseId?: string }> };
    const enrollments = Array.isArray(userData.enrollments) ? userData.enrollments : [];
    const courseIds = enrollments
      .map((enrollment) => enrollment?.courseId)
      .filter((courseId): courseId is string => typeof courseId === 'string' && courseId.length > 0);

    for (const courseId of courseIds) {
      const courseSnap = await getDoc(doc(db, 'courses', courseId));
      if (!courseSnap.exists()) continue;
      const courseData = courseSnap.data() as { books?: Array<{ id?: string }> };
      const linkedBooks = Array.isArray(courseData.books) ? courseData.books : [];
      if (linkedBooks.some((bookRef) => bookRef?.id === bookId)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
};

export const saveBook = async (book: Book): Promise<void> => {
  if (!db || !book.id) return;
  await setDoc(doc(db, 'books', book.id), {
    ...book,
    updatedAt: new Date().toISOString(),
    createdAt: book.createdAt || new Date().toISOString(),
  }, { merge: true });
};

export const deleteBook = async (bookId: string): Promise<void> => {
  if (!db || !bookId) return;
  await deleteDoc(doc(db, 'books', bookId));
};

export const updateBookOrderStatus = async (
  purchaseId: string,
  status: NonNullable<BookPurchase['deliveryStatus']>,
  trackingReference?: string
): Promise<void> => {
  if (!db || !purchaseId) return;
  await updateDoc(doc(db, 'bookPurchases', purchaseId), {
    deliveryStatus: status,
    ...(trackingReference ? { trackingReference } : {}),
    updatedAt: new Date().toISOString(),
  });
};
