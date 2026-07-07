'use server';

import { apiFetchServer } from '@/lib/api-client.server';
import { logger } from '@/lib/logging';

export async function getSecurityTelemetry() {
  try {
    const res = await apiFetchServer('/api/v1/admin/security/telemetry');
    return res.json();
  } catch (error: any) {
    logger.error('[Admin Security] Failed to fetch telemetry', { error: error.message });
    return { users: [], failedOrders: [], blocklist: [], error: 'Failed to load telemetry' };
  }
}

export async function blockIpAddress(ip: string, reason: string) {
  try {
    const res = await apiFetchServer('/api/v1/admin/security/block-ip', {
      method: 'POST',
      body: JSON.stringify({ ip, reason }),
    });
    return res.json();
  } catch (error: any) {
    logger.error('[Admin Security] Failed to block IP', { error: error.message });
    throw new Error('Failed to block IP');
  }
}

export async function unblockIpAddress(blockId: string) {
  try {
    const res = await apiFetchServer(`/api/v1/admin/security/block-ip/${blockId}`, {
      method: 'DELETE',
    });
    return res.json();
  } catch (error: any) {
    logger.error('[Admin Security] Failed to unblock IP', { error: error.message });
    throw new Error('Failed to unblock IP');
  }
}

export async function unblockIpAdmin(...args: any[]) { return { error: 'Not implemented' }; }
export async function getAdminSecurityTelemetry(...args: any[]) { return { telemetry: null, error: 'Not implemented' }; }
export async function blockIpAdmin(...args: any[]) { return { error: 'Not implemented' }; }
