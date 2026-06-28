'use client';

/**
 * @fileOverview Data service for books.
 * Routes through the Python backend REST API.
 */

import { apiFetch } from '@/lib/api-client';
import type { Book } from '@/lib/db';

export const getBooks = async (options?: { includeDraft?: boolean }): Promise<Book[]> => {
  try {
    const params = options?.includeDraft ? '?includeDraft=true' : '';
    const res = await apiFetch(`/books${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.books || [];
  } catch {
    return [];
  }
};

export const hasUserPurchasedBook = async (_userId: string, _bookId: string): Promise<boolean> => {
  try {
    const res = await apiFetch(`/books/${_bookId}/purchase`);
    return res.ok;
  } catch {
    return false;
  }
};

export const getBookById = async (id: string): Promise<Book | null> => {
  return getBook(id);
};

export const getBook = async (id: string): Promise<Book | null> => {
  try {
    const res = await apiFetch(`/books/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.book || null;
  } catch {
    return null;
  }
};

