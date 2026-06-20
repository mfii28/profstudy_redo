'use client';

import { collection, getDocs, doc, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { AuditLog } from './db';

/**
 * @fileOverview Hardened Audit Logging Service.
 * Implements non-repudiation for high-stakes administrative and tutor actions.
 */

const COLLECTION_NAME = 'auditLogs';

export const getAuditLogs = async (count: number = 50): Promise<AuditLog[]> => {
  if (!db) return [];
  try {
    const logsCollection = collection(db, COLLECTION_NAME);
    const q = query(logsCollection, orderBy('timestamp', 'desc'), limit(count));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));
  } catch (error) {
    console.error('[Security Audit] Ledger Fetch Blocked:', error);
    return [];
  }
};

/**
 * Standardized Logger for all high-impact mutations.
 */
export const logAdminAction = async (log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> => {
  if (!db) return;
  try {
    const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const logRef = doc(db, COLLECTION_NAME, logId);
    
    // Non-blocking background log
    setDoc(logRef, {
      ...log,
      timestamp: new Date().toISOString(),
    }).catch(err => console.warn("[Security Audit] Failed to record action:", err.message));
    
  } catch (error) {
    console.error('[Security Audit] Critical Failure:', error);
  }
};
