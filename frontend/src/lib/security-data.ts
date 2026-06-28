'use client';

import { apiFetch } from '@/lib/api-client';
import type { IpBlock } from './db';

/**
 * @fileOverview Data service for IP blocklist management.
 * Routes through the Python backend REST API.
 */

export const getIpBlocklist = async (): Promise<IpBlock[]> => {
    try {
        const res = await apiFetch('/admin/ip-blocklist');
        if (!res.ok) return [];
        return (await res.json()).blocks || [];
    } catch { return []; }
};

export const blockIp = async (ip: string, reason: string, adminId: string): Promise<void> => {
    await apiFetch('/admin/ip-blocklist', {
        method: 'POST',
        body: JSON.stringify({ ip, reason, adminId }),
    });
};

export const unblockIp = async (id: string): Promise<void> => {
    await apiFetch(`/admin/ip-blocklist/${id}`, { method: 'DELETE' });
};
