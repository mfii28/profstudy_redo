
'use client';

import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { Course, Review } from '@/lib/db';

/**
 * @fileOverview Data service for course reviews.
 * SCRUBBED: Removed all hardcoded mock data.
 */

export const getReviews = async (): Promise<Review[]> => {
    if (!db) return [];
    const reviewsCollection = collection(db, 'reviews');
    const q = query(reviewsCollection, orderBy("date", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
};

const sortReviewsByDate = (reviews: Review[]) => {
    return [...reviews].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const getUniqueCourseReviewTokens = (courses: Array<Pick<Course, 'id' | 'title'>>) => {
    return Array.from(
        new Set(
            courses
                .flatMap((course) => [course.id, course.title?.trim()])
                .filter((value): value is string => typeof value === 'string' && value.length > 0)
        )
    );
};

const getReviewsByCourseTokens = async (courseTokens: string[]): Promise<Review[]> => {
    if (!db || courseTokens.length === 0) return [];

    const chunks: string[][] = [];

    for (let index = 0; index < courseTokens.length; index += 10) {
        chunks.push(courseTokens.slice(index, index + 10));
    }

    try {
        const snapshots = await Promise.all(
            chunks.map(async (courseChunk) => {
                const reviewsCollection = collection(db, 'reviews');

                try {
                    const orderedQuery = query(
                        reviewsCollection,
                        where('course', 'in', courseChunk),
                        orderBy('date', 'desc')
                    );
                    return await getDocs(orderedQuery);
                } catch (error: any) {
                    if (error?.code !== 'failed-precondition') {
                        throw error;
                    }

                    const fallbackQuery = query(reviewsCollection, where('course', 'in', courseChunk));
                    return getDocs(fallbackQuery);
                }
            })
        );

        const reviewMap = new Map<string, Review>();

        snapshots.forEach((snapshot) => {
            snapshot.docs.forEach((reviewDoc) => {
                reviewMap.set(reviewDoc.id, { id: reviewDoc.id, ...reviewDoc.data() } as Review);
            });
        });

        return sortReviewsByDate(Array.from(reviewMap.values()));
    } catch (error) {
        console.error('[ReviewData] Failed to fetch reviews for course tokens:', error);
        return [];
    }
};

export const getReviewsByUser = async (userId: string): Promise<Review[]> => {
    if (!db || !userId) return [];

    try {
        const reviewsCollection = collection(db, 'reviews');
        const q = query(
            reviewsCollection,
            where('userId', '==', userId),
            orderBy('date', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
    } catch (error) {
        console.error('[ReviewData] Failed to fetch reviews for user:', error);
        return [];
    }
};

export const getReviewsByCourse = async (courseId: string): Promise<Review[]> => {
    return getReviewsByCourseTokens(courseId ? [courseId] : []);
};

export const getReviewsByCourseReference = async (courseId: string, legacyCourseTitle?: string): Promise<Review[]> => {
    const courseTokens = Array.from(new Set([courseId, legacyCourseTitle?.trim()].filter(Boolean) as string[]));
    return getReviewsByCourseTokens(courseTokens);
};

export const getReviewsForCourses = async (courses: Array<Pick<Course, 'id' | 'title'>>): Promise<Review[]> => {
    return getReviewsByCourseTokens(getUniqueCourseReviewTokens(courses));
};
