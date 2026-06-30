'use client';

/**
 * @fileOverview Data service for persisting AI tutoring history.
 * Routes through the Python backend REST API.
 */

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const AI_HISTORY_URL = `${API_URL}/ai-history`;

import type { AiInteraction } from './db';

export const saveAiInteraction = async (interaction: Omit<AiInteraction, 'id' | 'timestamp'>): Promise<void> => {
    try {
        await fetch(AI_HISTORY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...interaction,
                timestamp: new Date().toISOString()
            }),
        });
    } catch (error) {
        console.error('[AiHistory] Failed to save interaction:', error);
    }
};

export const getAiHistory = async (userId: string, type?: AiInteraction['type']): Promise<AiInteraction[]> => {
    if (!userId) return [];
    try {
        const res = await fetch(AI_HISTORY_URL, {
            headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return (data.interactions || []).filter((i: AiInteraction) => {
            if (i.userId !== userId) return false;
            if (type && i.type !== type) return false;
            return true;
        });
    } catch (error) {
        console.error('[AiHistory] Failed to fetch history:', error);
        return [];
    }
};

export const deleteAiInteraction = async (id: string): Promise<void> => {
    try {
        await fetch(`${AI_HISTORY_URL}/${id}`, { method: 'DELETE' });
    } catch (error) {
        console.error('[AiHistory] Failed to delete interaction:', error);
    }
};
