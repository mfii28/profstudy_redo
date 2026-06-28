'use client';

import { apiFetch } from '@/lib/api-client';
import type { LibraryAsset } from './db';

/**
 * @fileOverview Data service for Tutor Content Library assets.
 * Routes through the Python backend REST API.
 */

export const getLibraryAssets = async (tutorId: string): Promise<LibraryAsset[]> => {
    try {
        const res = await apiFetch(`/library?tutorId=${encodeURIComponent(tutorId)}`);
        if (!res.ok) return [];
        return (await res.json()).assets || [];
    } catch { return []; }
};

export const saveLibraryAsset = async (asset: LibraryAsset): Promise<void> => {
    await apiFetch('/library', {
        method: 'POST',
        body: JSON.stringify(asset),
    });
};

export const deleteLibraryAsset = async (assetId: string): Promise<void> => {
    await apiFetch(`/library/${assetId}`, { method: 'DELETE' });
};
