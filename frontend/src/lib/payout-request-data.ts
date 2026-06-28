import { apiFetch } from '@/lib/api-client';
import type { PayoutRequest, PayoutRequestStatus } from '@/lib/db';

export async function submitPayoutRequest(
    data: Omit<PayoutRequest, 'id' | 'status' | 'submittedAt'>
): Promise<string> {
    const res = await apiFetch('/admin/payouts', {
        method: 'POST',
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to submit payout request');
    const result = await res.json();
    return result.id;
}

export async function getPayoutRequestsByTutor(tutorId: string): Promise<PayoutRequest[]> {
    try {
        const res = await apiFetch(`/admin/payouts?tutorId=${encodeURIComponent(tutorId)}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.requests || [];
    } catch {
        return [];
    }
}

export async function getAllPayoutRequests(): Promise<PayoutRequest[]> {
    try {
        const res = await apiFetch('/admin/payouts');
        if (!res.ok) return [];
        const data = await res.json();
        return data.requests || [];
    } catch {
        return [];
    }
}

export async function updatePayoutRequestStatus(
    requestId: string,
    status: PayoutRequestStatus,
    adminNote?: string
): Promise<void> {
    const res = await apiFetch(`/admin/payouts/${requestId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, adminNote }),
    });
    if (!res.ok) throw new Error('Failed to update payout request status');
}
