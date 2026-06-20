
'use client';

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { Subscription } from '@/lib/db';

/**
 * @fileOverview Data service for student billing subscriptions.
 * SCRUBBED: Removed all hardcoded mock data.
 */

export const getSubscriptions = async (userId: string): Promise<Subscription[]> => {
    if (!db || !userId) return [];
    const subscriptionsCollection = collection(db, 'subscriptions');
    const q = query(subscriptionsCollection, where("userId", "==", userId));
    const snapshot = await getDocs(q);

    return snapshot.docs
        .map((doc) => {
            const data = doc.data() as Record<string, unknown>;
            const rawStatus = String(data.status ?? 'Active').toLowerCase();
            const status: Subscription['status'] = rawStatus === 'cancelled'
                ? 'Cancelled'
                : rawStatus === 'expired'
                    ? 'Expired'
                    : 'Active';

            const rawPrice = data.price ?? data.amount ?? 0;
            const price = typeof rawPrice === 'number' ? rawPrice.toFixed(2) : String(rawPrice);
            const inferredPlanName = data.planName
                ?? (String(data.planId ?? '').includes('premium') ? 'Premium AI Plan' : 'AI Subscription');
            const nextPaymentDate = String(data.nextPaymentDate ?? data.endDate ?? data.renewalDate ?? new Date().toISOString());

            return {
                id: doc.id,
                userId,
                planName: String(inferredPlanName),
                price,
                status,
                nextPaymentDate,
            } satisfies Subscription;
        })
        .sort((left, right) => new Date(right.nextPaymentDate).getTime() - new Date(left.nextPaymentDate).getTime());
};
