'use client';

/**
 * @fileOverview Data service for audit logging.
 * Routes through the Python backend REST API.
 */

import type { AuditLog } from '@/lib/db';
import { apiFetch } from '@/lib/api-client';

export const getAuditLogs = async (count: number = 50): Promise<AuditLog[]> => {
    try {
        const res = await apiFetch(`/admin/audit-logs?count=${count}`);
        if (!res.ok) return [];
        const data = await res.json();
        return data.logs || [];
    } catch (e) {
        console.error('[Audit] getAuditLogs error:', e);
        return [];
    }
};

export const logAdminAction = async (log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> => {
    try {
        await apiFetch(`/admin/audit-logs`, {
            method: 'POST',
            body: JSON.stringify(log),
        });
    } catch (e) {
        console.error('[Audit] logAdminAction error:', e);
    }
};
