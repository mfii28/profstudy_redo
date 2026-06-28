'use client';

/**
 * @fileOverview Data service for platform support tickets.
 * Routes through the Python backend REST API.
 */

import type { SupportTicket } from '@/lib/db';
import { apiFetch } from '@/lib/api-client';

export const getSupportTickets = async (userId?: string): Promise<SupportTicket[]> => {
    try {
        const params = userId ? `?userId=${encodeURIComponent(userId)}` : '';
        const res = await apiFetch(`/admin/support-tickets${params}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.tickets || [];
    } catch (error) {
        console.error('Error fetching support tickets:', error);
        return [];
    }
};

export const addSupportTicket = async (ticket: Partial<SupportTicket>): Promise<void> => {
    await apiFetch('/admin/support-tickets', {
        method: 'POST',
        body: JSON.stringify(ticket),
    });
};

export const updateSupportTicket = async (ticket: SupportTicket): Promise<void> => {
    await apiFetch(`/admin/support-tickets/${ticket.id}`, {
        method: 'PUT',
        body: JSON.stringify(ticket),
    });
};
