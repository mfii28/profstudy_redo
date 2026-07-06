'use server';

import { apiFetchServer } from '@/lib/api-client.server';

export async function deleteReview(reviewId: string, idToken: string) {
  try {
    await apiFetchServer(`/api/v1/reviews/${reviewId}`, {
      method: 'DELETE',
    });
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete review." };
  }
}

export async function updateReview(reviewId: string, newText: string, idToken: string) {
  try {
    await apiFetchServer(`/api/v1/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify({ text: newText }),
    });
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to update review." };
  }
}

export async function replyToReview(reviewId: string, replyText: string, idToken: string) {
  try {
    await apiFetchServer(`/api/v1/reviews/${reviewId}/reply`, {
      method: 'PUT',
      body: JSON.stringify({ replyText }),
    });
    return { success: true };
  } catch (error: any) {
    return { error: error.message || 'Failed to save review reply.' };
  }
}

type SubmitReviewInput = {
  courseId: string;
  rating: number;
  text: string;
};

export async function submitReview(input: SubmitReviewInput, idToken: string) {
  if (!input.courseId) {
    return { error: 'Course ID is required' };
  }
  if (input.rating < 1 || input.rating > 5) {
    return { error: 'Rating cannot exceed 5' };
  }
  if (!input.text || input.text.trim().length < 10) {
    return { error: 'Review must be at least 10 characters' };
  }

  try {
    const data = await apiFetchServer(`/api/v1/reviews/`, {
      method: 'POST',
      body: JSON.stringify({
        courseId: input.courseId,
        rating: input.rating,
        text: input.text,
      }),
    });
    return { success: true, reviewId: data.id };
  } catch (error: any) {
    return { error: error.message || 'Failed to submit review. Please try again.' };
  }
}
