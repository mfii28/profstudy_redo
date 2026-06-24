'use client';

/**
 * @fileOverview Data service for audit logging.
 * Routes through the Python backend REST API.
 */

import type { AuditLog } from '@/lib/db';
import { apiFetch } from '@/lib/api-client';

export const getAuditLogs = async (count: number = 50): Promise<AuditLog[]> => {
    return [];
};

export const logAdminAction = async (log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> => {
    console.warn('[Audit] logAdminAction via REST not yet implemented');
};
