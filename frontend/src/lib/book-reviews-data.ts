'use client';

import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { BookReview } from './db';

export const getBookReviews = async (): Promise<BookReview[]> => {
  if (!db) return [];
  try {
    const q = query(collection(db, 'bookReviews'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BookReview));
  } catch (err) {
    console.error('[BookReviewsData] fetch error:', err);
    return [];
  }
};

export const updateBookReview = async (
  id: string,
  updates: Partial<Pick<BookReview, 'status' | 'adminReply' | 'repliedAt'>>
): Promise<void> => {
  if (!db) throw new Error('Database unavailable');
  await updateDoc(doc(db, 'bookReviews', id), updates);
};

export const removeBookReview = async (id: string): Promise<void> => {
  if (!db) throw new Error('Database unavailable');
  await deleteDoc(doc(db, 'bookReviews', id));
};
