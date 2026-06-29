'use client';

/**
 * @fileOverview Data service for affiliate management.
 * Routes through the Python backend REST API.
 */

import type { Affiliate } from './db';
import { apiFetch } from '@/lib/api-client';

export const saveAffiliateToUser = async (userId: string, affiliate: Affiliate): Promise<void> => {
    try {
        await apiFetch(`/admin/affiliates/user/${userId}`, {
            method: 'POST',
            body: JSON.stringify(affiliate),
        });
    } catch (e) {
        console.error('[Affiliate] saveAffiliateToUser error:', e);
    }
};

export const removeAffiliateFromUser = async (userId: string): Promise<void> => {
    try {
        await apiFetch(`/admin/affiliates/user/${userId}`, {
            method: 'DELETE',
        });
    } catch (e) {
        console.error('[Affiliate] removeAffiliateFromUser error:', e);
    }
};

export const removeAffiliate = async (affiliateId: string): Promise<void> => {
    try {
        await apiFetch(`/admin/affiliates/${affiliateId}`, {
            method: 'DELETE',
        });
    } catch (e) {
        console.error('[Affiliate] removeAffiliate error:', e);
    }
};

export const getAffiliates = async (): Promise<Affiliate[]> => {
    try {
        const res = await apiFetch(`/admin/affiliates`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.affiliates || [];
    } catch (e) {
        console.error('[Affiliate] getAffiliates error:', e);
        return [];
    }
};

export const saveAffiliate = async (affiliate: Affiliate): Promise<void> => {
    try {
        await apiFetch(`/admin/affiliates`, {
            method: 'POST',
            body: JSON.stringify(affiliate),
        });
    } catch (e) {
        console.error('[Affiliate] saveAffiliate error:', e);
    }
};
