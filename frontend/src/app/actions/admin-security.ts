'use server';

import { apiFetchServer } from '@/lib/api-client.server';
import { logger } from '@/lib/logging';

export async function getSecurityTelemetry() {
  try {
    return await apiFetchServer('/api/v1/admin/security/telemetry');
  } catch (error: any) {
    logger.error('[Admin Security] Failed to fetch telemetry', { error: error.message });
    return { users: [], failedOrders: [], blocklist: [], error: 'Failed to load telemetry' };
  }
}

export async function blockIpAddress(ip: string, reason: string) {
  try {
    return await apiFetchServer('/api/v1/admin/security/block-ip', {
      method: 'POST',
      body: JSON.stringify({ ip, reason }),
    });
  } catch (error: any) {
    logger.error('[Admin Security] Failed to block IP', { error: error.message });
    throw new Error('Failed to block IP');
  }
}

export async function unblockIpAddress(blockId: string) {
  try {
    return await apiFetchServer(`/api/v1/admin/security/block-ip/${blockId}`, {
      method: 'DELETE',
    });
  } catch (error: any) {
    logger.error('[Admin Security] Failed to unblock IP', { error: error.message });
    throw new Error('Failed to unblock IP');
  }
}
