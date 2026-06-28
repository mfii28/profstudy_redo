'use client';

/**
 * @fileOverview Data service for book reviews.
 * Routes through the Python backend REST API.
 */

import { apiFetch } from '@/lib/api-client';
import type { BookReview } from '@/lib/db';

export const getBookReviews = async (): Promise<BookReview[]> => {
  try {
    const res = await apiFetch('/book-reviews');
    if (!res.ok) return [];
    const data = await res.json();
    return data.reviews || [];
  } catch {
    return [];
  }
};

export const updateBookReview = async (id: string, data: Partial<BookReview>): Promise<void> => {
  await apiFetch(`/book-reviews/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const removeBookReview = async (id: string): Promise<void> => {
  await apiFetch(`/book-reviews/${id}`, { method: 'DELETE' });
};

