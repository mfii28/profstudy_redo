'use client';

import { collection, getDocs, query, orderBy, limit, where, doc, setDoc, increment } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { WeeklyStudyData, SubjectMasteryData, FunnelDataPoint, ForecastDataPoint } from '@/lib/db';
import { getUsers } from './user-data';
import { getOrders } from './finance-data';

/**
 * @fileOverview Data service for platform and student analytics.
 */

export const getWeeklyStudyData = async (userId: string): Promise<WeeklyStudyData[]> => {
    if (!db || !userId) return [];
    try {
        const collectionRef = collection(db, 'users', userId, 'weeklyStudyData');
        const snapshot = await getDocs(collectionRef);
        return snapshot.docs.map(doc => doc.data() as WeeklyStudyData);
    } catch (e) {
        console.error("Error fetching weekly study data:", e);
        return [];
    }
};

export const getSubjectMasteryData = async (userId: string): Promise<SubjectMasteryData[]> => {
    if (!db || !userId) return [];
    try {
        const collectionRef = collection(db, 'users', userId, 'subjectMasteryData');
        const snapshot = await getDocs(collectionRef);
        return snapshot.docs.map(doc => doc.data() as SubjectMasteryData);
    } catch (e) {
        console.error("Error fetching subject mastery data:", e);
        return [];
    }
};

/**
 * Calculates funnel data points by analyzing the real users and orders collections.
 */
export const getFunnelData = async (): Promise<FunnelDataPoint[]> => {
    if (!db) return [];
    try {
        // 1. Fetch real data
        const [{ users }, orders] = await Promise.all([
            getUsers(),
            getOrders()
        ]);

        const totalUsers = users.length;
        const totalOrders = orders.length;
        
        // 2. Derive metrics
        // Step 1: Measured signups (not simulated traffic)
        const signups = totalUsers;
        
        // Step 3: Discovery (Users who have a wishlist or viewed courses)
        const discovery = users.filter(u => (u.wishlistCourseIds?.length || 0) > 0 || u.enrollments.length > 0).length;
        
        // Step 4: Enrollments (Unique users who purchased)
        const uniqueEnrolledUsers = new Set(orders.map(o => o.userId)).size;
        
        // Step 5: Completions (Users who have completed some lessons)
        const completions = users.filter(u => u.enrollments.some(e => e.completedLessons.length > 0)).length;

        // 3. Construct funnel
        return [
            { name: 'Account Signups', value: signups, fill: 'hsl(var(--primary))' },
            { name: 'Course Discovery', value: discovery, fill: 'hsl(var(--accent))' },
            { name: 'Enrollments', value: uniqueEnrolledUsers, fill: 'hsl(var(--success))' },
            { name: 'Retention (Active)', value: completions, fill: 'hsl(var(--warning))' },
        ];
    } catch (e) {
        console.error("Error calculating funnel data:", e);
        return [];
    }
}

export const getForecastData = async (): Promise<ForecastDataPoint[]> => {
    if (!db) return [];
    try {
        const collectionRef = collection(db, 'forecastData');
        const q = query(collectionRef, orderBy('month', 'asc'), limit(12));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return [];
        }
        return snapshot.docs.map(doc => doc.data() as ForecastDataPoint);
    } catch (e) {
        console.error("Error fetching forecast data:", e);
        return [];
    }
}

/**
 * Records a study session by accumulating hours studied per day.
 * Each lesson completion adds to that day's total in users/{uid}/weeklyStudyData.
 */
export const recordStudySession = async (
    userId: string,
    courseTitle: string,
    minutesStudied: number,
): Promise<void> => {
    if (!db || !userId) return;
    try {
        const today = new Date();
        const dayKey = today.toISOString().split('T')[0]; // YYYY-MM-DD
        const dayName = today.toLocaleDateString('en-US', { weekday: 'short' }); // Mon, Tue…
        const docRef = doc(db, 'users', userId, 'weeklyStudyData', dayKey);
        await setDoc(docRef, {
            day: dayName,
            date: dayKey,
            hours: increment(minutesStudied / 60),
        }, { merge: true });
    } catch (e) {
        console.error('[Analytics] Failed to record study session:', e);
    }
};

/**
 * Upserts a subject mastery score for a user after a quiz or assessment.
 */
export const updateSubjectMastery = async (
    userId: string,
    subject: string,
    score: number,
): Promise<void> => {
    if (!db || !userId) return;
    try {
        const key = subject.toLowerCase().replace(/\s+/g, '-');
        const docRef = doc(db, 'users', userId, 'subjectMasteryData', key);
        await setDoc(docRef, { subject, mastery: score }, { merge: true });
    } catch (e) {
        console.error('[Analytics] Failed to update subject mastery:', e);
    }
};
