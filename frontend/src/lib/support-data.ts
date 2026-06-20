'use client';

import { collection, getDocs, doc, setDoc, query, orderBy, updateDoc, where } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { SupportTicket } from '@/lib/db';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * @fileOverview Data service for platform support tickets.
 */

export const getSupportTickets = async (userId?: string): Promise<SupportTicket[]> => {
    if (!db) return [];
    try {
        const ticketsCollection = collection(db, 'supportTickets');
        const q = userId
            ? query(ticketsCollection, where('userId', '==', userId))
            : query(ticketsCollection, orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket))
            .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
    } catch (error) {
        console.error('Error fetching support tickets:', error);
        return [];
    }
};

export const updateSupportTicket = async (ticket: SupportTicket): Promise<void> => {
    if (!db) return;
    const docRef = doc(db, 'supportTickets', ticket.id);
    
    await setDoc(docRef, ticket, { merge: true })
        .catch(async () => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: ticket,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            throw new Error('Failed to update support ticket.');
        });
};

export const addSupportTicket = async (ticket: SupportTicket): Promise<void> => {
    if (!db) return;
    const docRef = doc(db, 'supportTickets', ticket.id);
    
    await setDoc(docRef, ticket)
        .catch(async () => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'create',
                requestResourceData: ticket,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            throw new Error('Failed to create support ticket.');
        });
};
