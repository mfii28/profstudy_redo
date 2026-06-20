
'use client';

import { collection, doc, getDocs, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { Affiliate } from './db';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * @fileOverview Atomic data service for affiliate management.
 * USES: Write Batches to ensure data consistency across user and global collections.
 */

/**
 * Saves affiliate profile data using an atomic batch write.
 */
export const saveAffiliateToUser = (userId: string, affiliate: Affiliate): void => {
    if (!db || !userId) return;
    
    const batch = writeBatch(db);
    const userRef = doc(db, 'users', userId);
    const globalRef = doc(db, 'affiliates', affiliate.id);

    // 1. Update the user's primary document with the embedded profile
    batch.set(userRef, { 
        affiliateProfile: {
            ...affiliate,
            updatedAt: new Date().toISOString()
        }
    }, { merge: true });

    // 2. Mirror to the global affiliates collection for indexing
    batch.set(globalRef, {
        ...affiliate,
        tutorId: userId, // Ensure reverse mapping
        updatedAt: serverTimestamp()
    }, { merge: true });

    batch.commit()
        .then(() => {
            // Affiliate records synchronized
        })
        .catch(async (serverError) => {
            console.error(`[Affiliate] BATCH FAILED:`, serverError.message);
            const permissionError = new FirestorePermissionError({
                path: `users/${userId} AND affiliates/${affiliate.id}`,
                operation: 'write',
                requestResourceData: affiliate,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
};

/**
 * Removes affiliate data from the user document.
 */
export const removeAffiliateFromUser = (userId: string): void => {
    if (!db || !userId) return;
    const userRef = doc(db, 'users', userId);
    
    setDoc(userRef, { 
        affiliateProfile: null 
    }, { merge: true }).catch(async () => {
        const permissionError = new FirestorePermissionError({
            path: userRef.path,
            operation: 'update',
            requestResourceData: { affiliateProfile: null },
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });
};

/**
 * Global collection cleanup (Admin utility).
 */
export const removeAffiliate = (affiliateId: string): void => {
    if (!db) return;
    const globalRef = doc(db, 'affiliates', affiliateId);
    setDoc(globalRef, { status: 'inactive', updatedAt: serverTimestamp() }, { merge: true });
};

/**
 * Global collection fetch (Admin utility).
 */
export const getAffiliates = async (): Promise<Affiliate[]> => {
    if (!db) return [];
    try {
        const snapshot = await getDocs(collection(db, 'affiliates'));
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Affiliate));
    } catch (err) {
        console.error('[Affiliate] Failed to fetch affiliates:', err);
        return [];
    }
};

/**
 * Global collection save (Admin utility).
 */
export const saveAffiliate = (affiliate: Affiliate): void => {
    if (!db) return;
    const globalRef = doc(db, 'affiliates', affiliate.id);
    setDoc(globalRef, affiliate, { merge: true });
};
