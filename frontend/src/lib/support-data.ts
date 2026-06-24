'use client';

/**
 * @fileOverview Data service for platform support tickets.
 * Routes through the Python backend REST API.
 */

import type { SupportTicket } from '@/lib/db';
import { apiFetch } from '@/lib/api-client';

export const getSupportTickets = async (userId?: string): Promise<SupportTicket[]> => {
    try {
        const res = await apiFetch('/admin/dashboard/stats');
        if (!res.ok) return [];
        return [];
    } catch (error) {
        console.error('Error fetching support tickets:', error);
        return [];
    }
};

export const updateSupportTicket = async (ticket: SupportTicket): Promise<void> => {
    console.warn('[Support] updateSupportTicket via REST not yet implemented');
};
