'use client';

import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { IpBlock } from './db';

/**
 * @fileOverview Data service for IP restrictions and Firewall rules.
 */

const COLLECTION_NAME = 'ip_blocklist';

export const getIpBlocklist = async (): Promise<IpBlock[]> => {
    if (!db) return [];
    try {
        const q = query(collection(db, COLLECTION_NAME), orderBy('timestamp', 'desc'), limit(100));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IpBlock));
    } catch (error) {
        console.error('[SecurityData] Failed to fetch IP blocklist:', error);
        return [];
    }
};

export const blockIp = async (ip: string, reason: string, adminId: string): Promise<void> => {
    if (!db) return;
    const id = `block-${Date.now()}`;
    await setDoc(doc(db, COLLECTION_NAME, id), {
        ip,
        reason,
        blockedBy: adminId,
        timestamp: new Date().toISOString()
    });
};

export const unblockIp = async (id: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, COLLECTION_NAME, id));
};
