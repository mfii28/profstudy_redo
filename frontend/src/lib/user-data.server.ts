/**
 * Server-safe user data stubs.
 * These do NOT import any client-only modules.
 */

import type { User } from './db';

export const getUsersForBulkEmail = async (_lastVisible: any, _batchSize: number): Promise<{ users: User[], nextCursor: any | null }> => {
    return { users: [], nextCursor: null };
};
