'use client';

import { apiFetch } from '@/lib/api-client';
import type { ClaimedReward } from './db';

/**
 * @fileOverview Data service for claimed rewards.
 * Routes through the Python backend REST API.
 */

export const getClaimedRewards = async (userId: string): Promise<ClaimedReward[]> => {
    try {
        const res = await apiFetch(`/rewards?userId=${encodeURIComponent(userId)}`);
        if (!res.ok) return [];
        return (await res.json()).rewards || [];
    } catch { return []; }
};

export const redeemReward = async (userId: string, reward: any): Promise<void> => {
    await apiFetch('/rewards/redeem', {
        method: 'POST',
        body: JSON.stringify({ userId, reward }),
    });
};
