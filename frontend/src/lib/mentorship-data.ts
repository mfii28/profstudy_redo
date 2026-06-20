'use client';

import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { MentorshipBooking } from './db';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * @fileOverview Data service for Mentorship bookings.
 */

export const getMentorshipBookings = async (userId: string): Promise<MentorshipBooking[]> => {
    if (!db || !userId) return [];
    const bookingsCollection = collection(db, 'mentorshipBookings');
    const q = query(bookingsCollection, where("userId", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as MentorshipBooking);
};

export const createMentorshipBooking = async (booking: Omit<MentorshipBooking, 'id' | 'status'>): Promise<void> => {
    if (!db) return;
    
    const bookingId = `book-${Date.now()}`;
    const bookingRef = doc(db, 'mentorshipBookings', bookingId);
    
    const data: MentorshipBooking = {
        ...booking,
        id: bookingId,
        status: 'Pending'
    };

    await setDoc(bookingRef, data)
        .catch(async () => {
            const permissionError = new FirestorePermissionError({
                path: bookingRef.path,
                operation: 'create',
                requestResourceData: data,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
};
