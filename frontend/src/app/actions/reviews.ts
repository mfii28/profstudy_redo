'use server';

import { adminDb, adminAuth } from '@/firebase/admin';
import { z } from 'zod';
import { logger } from '@/lib/logging';

// Validation schemas
const reviewIdSchema = z.string().min(1, 'Review ID is required').max(255, 'Review ID is too long');
const reviewTextSchema = z.string().min(1, 'Review text is required').max(5000, 'Review text is too long');
const reviewReplySchema = z.string().min(1, 'Reply is required').max(2000, 'Reply is too long');

async function verifyReviewOwnership(uid: string, reviewId: string): Promise<boolean> {
  const reviewDoc = await adminDb.doc(`reviews/${reviewId}`).get();
  if (!reviewDoc.exists) return false;
  return reviewDoc.data()!.userId === uid;
}

async function verifyRole(uid: string, requiredRoles: string[]): Promise<boolean> {
  try {
    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) return false;
    return requiredRoles.includes(userDoc.data()!.role);
  } catch {
    return false;
  }
}

/**
 * Deletes a review from the database.
 * SECURITY: Requires valid idToken. Caller must own the review or be an admin.
 */
export async function deleteReview(reviewId: string, idToken: string) {
  try {
    // SECURITY: Validate input
    const validId = reviewIdSchema.safeParse(reviewId);
    if (!validId.success) {
      logger.warn('[Review Action] Invalid review ID for deletion', {
        errors: validId.error.issues,
      });
      return { error: 'Invalid review ID.' };
    }

    // SECURITY: Verify caller identity
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // SECURITY: Verify ownership or admin role
    const isOwner = await verifyReviewOwnership(uid, reviewId);
    const isAdmin = !isOwner && await verifyRole(uid, ['admin', 'superadmin', 'subadmin']);
    if (!isOwner && !isAdmin) {
      logger.warn('[Review Action] Unauthorized delete attempt', { uid, reviewId });
      return { error: 'You are not authorized to delete this review.' };
    }

    const reviewRef = adminDb.doc(`reviews/${reviewId}`);
    await reviewRef.delete();

    logger.info('[Review Action] Review deleted successfully', {
      reviewId,
      deletedBy: uid,
    });

    return { success: true };
  } catch (error: any) {
    if (error?.code === 'auth/id-token-expired' || error?.code === 'auth/argument-error') {
      return { error: 'Your session has expired. Please sign in again.' };
    }
    logger.error('[Review Action] Failed to delete review', {
      reviewId,
      errorMessage: error.message,
    });
    return { error: "Failed to delete review." };
  }
}

/**
 * Updates a review in the database.
 * SECURITY: Requires valid idToken. Caller must own the review or be an admin.
 */
export async function updateReview(reviewId: string, newText: string, idToken: string) {
  try {
    // SECURITY: Validate inputs
    const validId = reviewIdSchema.safeParse(reviewId);
    const validText = reviewTextSchema.safeParse(newText);

    if (!validId.success) {
      logger.warn('[Review Action] Invalid review ID for update', {
        errors: validId.error.issues,
      });
      return { error: 'Invalid review ID.' };
    }

    if (!validText.success) {
      logger.warn('[Review Action] Invalid review text', {
        errors: validText.error.issues,
      });
      return { error: 'Review text is required and must be less than 5000 characters.' };
    }

    // SECURITY: Verify caller identity
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // SECURITY: Verify ownership or admin role
    const isOwner = await verifyReviewOwnership(uid, reviewId);
    const isAdmin = !isOwner && await verifyRole(uid, ['admin', 'superadmin', 'subadmin']);
    if (!isOwner && !isAdmin) {
      logger.warn('[Review Action] Unauthorized update attempt', { uid, reviewId });
      return { error: 'You are not authorized to update this review.' };
    }

    const reviewRef = adminDb.doc(`reviews/${reviewId}`);
    await reviewRef.update({ 
      text: newText,
      updatedAt: new Date().toISOString(),
    });

    logger.info('[Review Action] Review updated successfully', {
      reviewId,
      textLength: newText.length,
      updatedBy: uid,
    });

    return { success: true };
  } catch (error: any) {
    if (error?.code === 'auth/id-token-expired' || error?.code === 'auth/argument-error') {
      return { error: 'Your session has expired. Please sign in again.' };
    }
    logger.error('[Review Action] Failed to update review', {
      reviewId,
      errorMessage: error.message,
    });
    return { error: "Failed to update review." };
  }
}

/**
 * Persists a tutor reply on a review.
 * SECURITY: Requires a valid idToken. Caller must be the course tutor or an admin.
 */
export async function replyToReview(reviewId: string, replyText: string, idToken: string) {
  try {
    const validId = reviewIdSchema.safeParse(reviewId);
    const validReply = reviewReplySchema.safeParse(replyText);

    if (!validId.success) {
      logger.warn('[Review Action] Invalid review ID for reply', {
        errors: validId.error.issues,
      });
      return { error: 'Invalid review ID.' };
    }

    if (!validReply.success) {
      logger.warn('[Review Action] Invalid review reply', {
        errors: validReply.error.issues,
      });
      return { error: 'Reply is required and must be less than 2000 characters.' };
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const reviewRef = adminDb.doc(`reviews/${reviewId}`);
    const reviewDoc = await reviewRef.get();
    if (!reviewDoc.exists) {
      return { error: 'Review not found.' };
    }

    const reviewData = reviewDoc.data() as { course?: string };
    const userDoc = await adminDb.doc(`users/${uid}`).get();
    const userData = userDoc.exists ? userDoc.data() : undefined;
    const isAdmin = !!userData && ['admin', 'superadmin', 'subadmin'].includes(userData.role);

    let isTutor = false;
    if (userData?.role === 'tutor' && reviewData.course) {
      const directCourseDoc = await adminDb.doc(`courses/${reviewData.course}`).get();

      if (directCourseDoc.exists) {
        isTutor = directCourseDoc.data()?.tutorId === uid;
      } else {
        const coursesSnapshot = await adminDb
          .collection('courses')
          .where('title', '==', reviewData.course)
          .limit(1)
          .get();

        if (!coursesSnapshot.empty) {
          isTutor = coursesSnapshot.docs[0].data().tutorId === uid;
        }
      }
    }

    if (!isTutor && !isAdmin) {
      logger.warn('[Review Action] Unauthorized reply attempt', { uid, reviewId });
      return { error: 'You are not authorized to reply to this review.' };
    }

    await reviewRef.update({
      reply: replyText.trim(),
      repliedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    logger.info('[Review Action] Review reply saved', {
      reviewId,
      repliedBy: uid,
    });

    return { success: true };
  } catch (error: any) {
    if (error?.code === 'auth/id-token-expired' || error?.code === 'auth/argument-error') {
      return { error: 'Your session has expired. Please sign in again.' };
    }

    logger.error('[Review Action] Failed to save review reply', {
      reviewId,
      errorMessage: error.message,
    });
    return { error: 'Failed to save review reply.' };
  }
}

// Validation schemas
const submitReviewSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
  text: z.string().min(10, 'Review must be at least 10 characters').max(2000, 'Review cannot exceed 2000 characters'),
});

type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

async function verifyCourseEnrollment(uid: string, courseId: string): Promise<boolean> {
  try {
    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) return false;

    const userData = userDoc.data();
    const enrollments = userData?.enrollments || [];
    return enrollments.some((e: any) => e?.courseId === courseId);
  } catch {
    return false;
  }
}

async function hasAlreadyReviewed(uid: string, courseId: string): Promise<boolean> {
  try {
    const reviewsSnapshot = await adminDb
      .collection('reviews')
      .where('userId', '==', uid)
      .where('course', '==', courseId)
      .limit(1)
      .get();

    return !reviewsSnapshot.empty;
  } catch {
    return false;
  }
}

/**
 * Submits a new course review.
 * SECURITY: Requires valid idToken. User must be enrolled in the course and not have reviewed it already.
 */
export async function submitReview(input: SubmitReviewInput, idToken: string) {
  try {
    // SECURITY: Validate input
    const validInput = submitReviewSchema.safeParse(input);
    if (!validInput.success) {
      logger.warn('[Review Submission] Invalid input', {
        errors: validInput.error.issues,
      });
      return { error: validInput.error.issues.map((issue) => issue.message).join(', ') };
    }

    const { courseId, rating, text } = validInput.data;

    // SECURITY: Verify caller identity
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // SECURITY: Verify course enrollment
    const isEnrolled = await verifyCourseEnrollment(uid, courseId);
    if (!isEnrolled) {
      logger.warn('[Review Submission] User not enrolled in course', { uid, courseId });
      return { error: 'You must be enrolled in this course to leave a review.' };
    }

    // SECURITY: Check for duplicate reviews
    const alreadyReviewed = await hasAlreadyReviewed(uid, courseId);
    if (alreadyReviewed) {
      logger.warn('[Review Submission] Duplicate review attempt', { uid, courseId });
      return { error: 'You have already reviewed this course.' };
    }

    // Get course title for denormalization
    const courseDoc = await adminDb.doc(`courses/${courseId}`).get();
    const courseTitle = courseDoc.exists ? courseDoc.data()?.title : courseId;

    // Create the review
    const reviewRef = adminDb.collection('reviews').doc();
    await reviewRef.set({
      id: reviewRef.id,
      userId: uid,
      course: courseId,
      courseTitle,
      rating,
      text: text.trim(),
      date: new Date().toISOString(),
      reply: null,
      repliedAt: null,
      updatedAt: new Date().toISOString(),
    });

    logger.info('[Review Submission] Review created successfully', {
      reviewId: reviewRef.id,
      courseId,
      rating,
      textLength: text.length,
      submittedBy: uid,
    });

    return { success: true, reviewId: reviewRef.id };
  } catch (error: any) {
    if (error?.code === 'auth/id-token-expired' || error?.code === 'auth/argument-error') {
      return { error: 'Your session has expired. Please sign in again.' };
    }
    logger.error('[Review Submission] Failed to submit review', {
      courseId: input.courseId,
      errorMessage: error.message,
    });
    return { error: 'Failed to submit review. Please try again.' };
  }
}
