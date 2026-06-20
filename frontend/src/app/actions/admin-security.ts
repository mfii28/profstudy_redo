'use server';

import { adminDb } from '@/firebase/admin';
import { logger } from '@/lib/logging';
import { requireAdminContextFromIdToken } from '@/lib/trusted-server-context';
import type { IpBlock, Order, User } from '@/lib/db';

type AdminSecurityTelemetryResult = {
  users: User[];
  failedOrders: Order[];
  blocklist: IpBlock[];
  error?: string;
};

function sortByTimestampDesc<T extends { timestamp?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.timestamp || '');
    const bTime = Date.parse(b.timestamp || '');
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
}

export async function getAdminSecurityTelemetry(idToken: string): Promise<AdminSecurityTelemetryResult> {
  try {
    if (!idToken) {
      return { users: [], failedOrders: [], blocklist: [], error: 'Authentication required.' };
    }

    const adminCtx = await requireAdminContextFromIdToken(idToken);
    if (!adminCtx.ok) {
      return { users: [], failedOrders: [], blocklist: [], error: adminCtx.error };
    }

    const [usersSnap, ordersSnap, blocklistSnap] = await Promise.all([
      adminDb.collection('users').limit(1000).get(),
      adminDb.collection('orders').get(),
      adminDb.collection('ip_blocklist').limit(100).get(),
    ]);

    const users = usersSnap.docs.map((userDoc) => userDoc.data() as User);
    const allOrders = ordersSnap.docs.map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() } as Order));
    const failedOrders = allOrders.filter((order) => order.status === 'Cancelled').slice(0, 5);
    const blocklist = sortByTimestampDesc(
      blocklistSnap.docs.map((blockDoc) => ({ id: blockDoc.id, ...blockDoc.data() } as IpBlock))
    ).slice(0, 100);

    return { users, failedOrders, blocklist };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Admin Security] Failed to load security telemetry', { errorMessage: message });
    return {
      users: [],
      failedOrders: [],
      blocklist: [],
      error: 'Failed to load security telemetry.',
    };
  }
}

export async function blockIpAdmin(
  idToken: string,
  ip: string,
  reason: string,
  adminId: string
): Promise<{ ok: true; block: IpBlock } | { ok: false; error: string }> {
  try {
    if (!idToken || !ip.trim()) {
      return { ok: false, error: 'IP address is required.' };
    }

    const adminCtx = await requireAdminContextFromIdToken(idToken);
    if (!adminCtx.ok) {
      return { ok: false, error: adminCtx.error };
    }

    const id = `block-${Date.now()}`;
    const block: IpBlock = {
      id,
      ip: ip.trim(),
      reason: reason.trim(),
      blockedBy: adminId,
      timestamp: new Date().toISOString(),
    };

    await adminDb.collection('ip_blocklist').doc(id).set(block);
    return { ok: true, block };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to block IP.';
    logger.error('[Admin Security] blockIpAdmin failed', { errorMessage: message });
    return { ok: false, error: message };
  }
}

export async function unblockIpAdmin(
  idToken: string,
  blockId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!idToken || !blockId) {
      return { ok: false, error: 'Block id is required.' };
    }

    const adminCtx = await requireAdminContextFromIdToken(idToken);
    if (!adminCtx.ok) {
      return { ok: false, error: adminCtx.error };
    }

    await adminDb.collection('ip_blocklist').doc(blockId).delete();
    return { ok: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to unblock IP.';
    logger.error('[Admin Security] unblockIpAdmin failed', { errorMessage: message });
    return { ok: false, error: message };
  }
}
