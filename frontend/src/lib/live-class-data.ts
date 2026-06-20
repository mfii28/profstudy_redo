'use client';

import { collection, doc, setDoc, deleteDoc, query, where, orderBy, getDocs, type Firestore } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import type { LiveClass } from '@/lib/db';

/**
 * @fileOverview Hardened data service for live streaming sessions.
 * Ensures strict adherence to Firestore patterns and schema.
 */

const COLLECTION_NAME = 'liveClasses';

const sortClassesByStartTime = (liveClasses: LiveClass[]) => {
    return [...liveClasses].sort((left, right) => new Date(left.startTime).getTime() - new Date(right.startTime).getTime());
};

export const getLiveClasses = async (db: Firestore): Promise<LiveClass[]> => {
    if (!db) return [];
    try {
        const liveClassesCollection = collection(db, COLLECTION_NAME);
        const q = query(liveClassesCollection, orderBy("startTime", "asc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as LiveClass));
    } catch (error: any) {
        console.warn("[LiveClassData] OrderBy query failed (likely missing index). Falling back to basic fetch.");
        const liveClassesCollection = collection(db, COLLECTION_NAME);
        const snapshot = await getDocs(liveClassesCollection);
        const results = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as LiveClass));
        return sortClassesByStartTime(results);
    }
};

export const getLiveClassesForStudent = async (db: Firestore, enrolledCourseIds: string[]): Promise<LiveClass[]> => {
    if (!db || enrolledCourseIds.length === 0) return [];

    const uniqueCourseIds = Array.from(new Set(enrolledCourseIds.filter(Boolean)));
    const chunks: string[][] = [];
    for (let index = 0; index < uniqueCourseIds.length; index += 10) {
        chunks.push(uniqueCourseIds.slice(index, index + 10));
    }

    try {
        const snapshots = await Promise.all(
            chunks.map((courseIds) => {
                const liveClassesCollection = collection(db, COLLECTION_NAME);
                const scopedQuery = query(liveClassesCollection, where('courseId', 'in', courseIds));
                return getDocs(scopedQuery);
            })
        );

        const classMap = new Map<string, LiveClass>();
        snapshots.forEach((snapshot) => {
            snapshot.docs.forEach((liveClassDoc) => {
                const liveClass = { ...liveClassDoc.data(), id: liveClassDoc.id } as LiveClass;
                classMap.set(liveClass.id, liveClass);
            });
        });

        return sortClassesByStartTime(Array.from(classMap.values()));
    } catch (error: any) {
        if (error.code === 'failed-precondition') {
            console.warn('[LiveClassData] Student live classes query requires an index. Falling back to per-course fetch.');
            const snapshots = await Promise.all(
                uniqueCourseIds.map((courseId) => {
                    const liveClassesCollection = collection(db, COLLECTION_NAME);
                    const scopedQuery = query(liveClassesCollection, where('courseId', '==', courseId));
                    return getDocs(scopedQuery);
                })
            );

            const classMap = new Map<string, LiveClass>();
            snapshots.forEach((snapshot) => {
                snapshot.docs.forEach((liveClassDoc) => {
                    const liveClass = { ...liveClassDoc.data(), id: liveClassDoc.id } as LiveClass;
                    classMap.set(liveClass.id, liveClass);
                });
            });

            return sortClassesByStartTime(Array.from(classMap.values()));
        }

        console.error('[LiveClassData] Failed to fetch student live classes:', error);
        return [];
    }
};

/**
 * Fetches sessions specific to a tutor without relying on a composite index.
 * Sorting is done client-side to avoid the temporary Firestore index warning path.
 */
export const getLiveClassesByTutorId = async (db: Firestore, tutorId: string): Promise<LiveClass[]> => {
    if (!db || !tutorId) return [];
    const liveClassesCollection = collection(db, COLLECTION_NAME);
    try {
        const q = query(liveClassesCollection, where("instructorId", "==", tutorId));
        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as LiveClass));
        return sortClassesByStartTime(results);
    } catch (error: any) {
        console.error('[LiveClassData] Failed to fetch tutor live classes:', error);
        return [];
    }
};

/**
 * ATOMIC CREATE: Writes the session document to Firestore and returns the promise.
 */
export const addLiveClass = (db: Firestore, newClass: LiveClass): Promise<void> => {
    if (!db) return Promise.reject(new Error("Database not initialized"));
    
    const docRef = doc(db, COLLECTION_NAME, newClass.id);
    
    const sessionData = {
        ...newClass,
        createdAt: new Date().toISOString()
    };

    // Write session data to Firestore
    return setDoc(docRef, sessionData)
        .then(() => {
            // Write successful
        })
        .catch(async (serverError) => {
            console.error(`[LiveClassData] WRITE FAILED for ${newClass.id}:`, serverError.message);
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'create',
                requestResourceData: sessionData,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
};

export const deleteLiveClass = (db: Firestore, classId: string): Promise<void> => {
    if (!db) return Promise.reject(new Error("Database not initialized"));
    const docRef = doc(db, COLLECTION_NAME, classId);
    
    return deleteDoc(docRef)
        .catch(async (error) => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'delete',
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            throw error;
        });
};
