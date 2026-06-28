
'use client';

import { apiFetch } from '@/lib/api-client';
import type { Course, Review } from '@/lib/db';

/**
 * @fileOverview Data service for course reviews.
 * Routes through the Python backend REST API.
 */

export const getReviews = async (): Promise<Review[]> => {
    try {
        const res = await apiFetch('/reviews');
        if (!res.ok) return [];
        const data = await res.json();
        return data.reviews || [];
    } catch {
        return [];
    }
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
    if (courseTokens.length === 0) return [];

    const chunks: string[][] = [];

    for (let index = 0; index < courseTokens.length; index += 10) {
        chunks.push(courseTokens.slice(index, index + 10));
    }

    try {
        const snapshots = await Promise.all(
            chunks.map(async (courseChunk) => {
                try {
                    const res = await apiFetch('/reviews/course/' + encodeURIComponent(courseChunk[0]));
                    if (!res.ok) return [];
                    const data = await res.json();
                    return data.reviews || [];
                } catch {
                    return [];
                }
            })
        );

        const reviewMap = new Map<string, Review>();

        snapshots.flat().forEach((review: Review) => {
            if (review.id) reviewMap.set(review.id, review);
        });

        return sortReviewsByDate(Array.from(reviewMap.values()));
    } catch (error) {
        console.error('[ReviewData] Failed to fetch reviews for course tokens:', error);
        return [];
    }
};

export const getReviewsByUser = async (userId: string): Promise<Review[]> => {
    if (!userId) return [];
    try {
        const res = await apiFetch(`/reviews?userId=${encodeURIComponent(userId)}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.reviews || [];
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
