
'use client';

import { apiFetch } from '@/lib/api-client';
import type { Subscription } from '@/lib/db';

/**
 * @fileOverview Data service for student billing subscriptions.
 * Routes through the Python backend REST API.
 */

export const getSubscriptions = async (userId: string): Promise<Subscription[]> => {
    if (!userId) return [];
    try {
        const res = await apiFetch(`/subscriptions?userId=${encodeURIComponent(userId)}`);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.subscriptions || []).sort(
            (left: Subscription, right: Subscription) =>
                new Date(right.nextPaymentDate).getTime() - new Date(left.nextPaymentDate).getTime()
        );
    } catch {
        return [];
    }
};
