'use client';

/**
 * @fileOverview Data service for affiliate management.
 * Routes through the Python backend REST API.
 */

import type { Affiliate } from './db';

export const saveAffiliateToUser = (userId: string, affiliate: Affiliate): void => {
    console.warn('[Affiliate] saveAffiliateToUser: Not implemented via REST');
};

export const removeAffiliateFromUser = (userId: string): void => {
    console.warn('[Affiliate] removeAffiliateFromUser: Not implemented via REST');
};

export const removeAffiliate = (affiliateId: string): void => {
    console.warn('[Affiliate] removeAffiliate: Not implemented via REST');
};

export const getAffiliates = async (): Promise<Affiliate[]> => {
    return [];
};

export const saveAffiliate = (affiliate: Affiliate): void => {
    console.warn('[Affiliate] saveAffiliate: Not implemented via REST');
};
