'use client';

import { apiFetch } from '@/lib/api-client';
import type { MentorshipBooking } from './db';

/**
 * @fileOverview Data service for Mentorship bookings.
 * Routes through the Python backend REST API.
 */

export const getMentorshipBookings = async (userId: string): Promise<MentorshipBooking[]> => {
    try {
        const res = await apiFetch(`/mentorship?userId=${encodeURIComponent(userId)}`);
        if (!res.ok) return [];
        return (await res.json()).bookings || [];
    } catch { return []; }
};

export const createMentorshipBooking = async (booking: MentorshipBooking): Promise<void> => {
    await apiFetch('/mentorship', {
        method: 'POST',
        body: JSON.stringify(booking),
    });
};
