import { collection, getDocs, doc, setDoc, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { DiscussionThread } from './db';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * @fileOverview Isomorphic data service for community discussions.
 */

export const getDiscussions = async (): Promise<DiscussionThread[]> => {
    if (!db) return [];
    try {
        const discussionsCollection = collection(db, 'discussionThreads');
        const q = query(discussionsCollection, orderBy("lastActivity", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DiscussionThread));
    } catch (error) {
        return [];
    }
};

export const getDiscussionsByCourse = async (courseTitle: string): Promise<DiscussionThread[]> => {
    if (!db || !courseTitle) return [];
    try {
        const discussionsCollection = collection(db, 'discussionThreads');
        const q = query(
            discussionsCollection,
            where('course', '==', courseTitle),
            orderBy('lastActivity', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DiscussionThread));
    } catch (error) {
        return [];
    }
};

export const addDiscussionThread = async (newThread: DiscussionThread) => {
    if (!db) return;
    const threadRef = doc(db, 'discussionThreads', newThread.id);
    await setDoc(threadRef, newThread)
        .catch(async () => {
            const permissionError = new FirestorePermissionError({
                path: threadRef.path,
                operation: 'create',
                requestResourceData: newThread,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
}

export const updateDiscussionThread = async (thread: DiscussionThread): Promise<void> => {
    if (!db) return;
    const threadRef = doc(db, 'discussionThreads', thread.id);
    await setDoc(threadRef, thread, { merge: true })
        .catch(async () => {
            const permissionError = new FirestorePermissionError({
                path: threadRef.path,
                operation: 'update',
                requestResourceData: thread,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
}
