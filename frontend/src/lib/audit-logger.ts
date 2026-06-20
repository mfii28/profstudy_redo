/**
 * @fileOverview Audit logging service for sensitive tutor operations.
 * Tracks: payouts, course deletions, student data access, bulk operations.
 */

import { db } from '@/firebase/firestore';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';

export type AuditEventType = 
  | 'payout_requested'
  | 'payout_completed'
  | 'payout_failed'
  | 'course_created'
  | 'course_updated'
  | 'course_deleted'
  | 'course_published'
  | 'student_enrolled'
  | 'student_removed'
  | 'message_sent_bulk'
  | 'discussion_moderated'
  | 'review_response'
  | 'verification_submitted'
  | 'settings_updated';

export interface AuditLog {
  id?: string;
  tutorId: string;
  eventType: AuditEventType;
  eventData: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: string;
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Log an audit event
 * @param tutorId - ID of the tutor performing the action
 * @param eventType - Type of event
 * @param eventData - Details about the event
 * @param severity - Event severity level
 */
export async function logAuditEvent(
  tutorId: string,
  eventType: AuditEventType,
  eventData: Record<string, unknown>,
  severity: 'info' | 'warning' | 'critical' = 'info'
): Promise<void> {
  if (!db) {
    console.warn('[AuditLogger] Firestore not available');
    return;
  }

  try {
    const ipAddress = typeof window !== 'undefined' ? getClientIp() : undefined;
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : undefined;

    const auditLog: AuditLog = {
      tutorId,
      eventType,
      eventData,
      ipAddress,
      userAgent,
      severity,
    };

    await addDoc(collection(db, 'auditLogs'), {
      ...auditLog,
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString(),
    });

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[AuditLog] ${eventType}:`, eventData);
    }
  } catch (error) {
    console.error('[AuditLogger] Failed to log event:', error);
    // Don't throw - logging failures shouldn't break the app
  }
}

/**
 * Get audit logs for a specific tutor
 */
export async function getAuditLogs(
  tutorId: string,
  limit: number = 100,
  eventType?: AuditEventType
): Promise<AuditLog[]> {
  if (!db) return [];

  try {
    let q;
    if (eventType) {
      q = query(
        collection(db, 'auditLogs'),
        where('tutorId', '==', tutorId),
        where('eventType', '==', eventType)
      );
    } else {
      q = query(
        collection(db, 'auditLogs'),
        where('tutorId', '==', tutorId)
      );
    }

    const snapshot = await getDocs(q);
    const logs = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as AuditLog))
      .slice(0, limit);

    return logs;
  } catch (error) {
    console.error('[AuditLogger] Failed to fetch logs:', error);
    return [];
  }
}

/**
 * Get critical events (security violations, failed operations, etc.)
 */
export async function getCriticalAuditLogs(tutorId: string): Promise<AuditLog[]> {
  if (!db) return [];

  try {
    const q = query(
      collection(db, 'auditLogs'),
      where('tutorId', '==', tutorId),
      where('severity', '==', 'critical')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));
  } catch (error) {
    console.error('[AuditLogger] Failed to fetch critical logs:', error);
    return [];
  }
}

/**
 * Log a payout request (important for compliance)
 */
export async function logPayoutRequest(
  tutorId: string,
  amount: number,
  method: string,
  payoutId: string
): Promise<void> {
  await logAuditEvent(
    tutorId,
    'payout_requested',
    {
      amount,
      method,
      payoutId,
      timestamp: new Date().toISOString(),
    },
    'warning' // Payouts are important events
  );
}

/**
 * Log a course deletion (important for compliance)
 */
export async function logCourseDelete(
  tutorId: string,
  courseId: string,
  courseTitle: string,
  studentCount: number
): Promise<void> {
  await logAuditEvent(
    tutorId,
    'course_deleted',
    {
      courseId,
      courseTitle,
      studentCount,
      timestamp: new Date().toISOString(),
    },
    'warning' // Course deletion affects many students
  );
}

/**
 * Log bulk messaging operation
 */
export async function logBulkMessage(
  tutorId: string,
  recipientCount: number,
  messagePreview: string
): Promise<void> {
  await logAuditEvent(
    tutorId,
    'message_sent_bulk',
    {
      recipientCount,
      messagePreview: messagePreview.substring(0, 100), // First 100 chars only
      timestamp: new Date().toISOString(),
    },
    'info'
  );
}

/**
 * Log a security-related event
 */
export async function logSecurityEvent(
  tutorId: string,
  reason: string,
  details: Record<string, unknown>
): Promise<void> {
  await logAuditEvent(
    tutorId,
    'settings_updated',
    {
      securityEvent: true,
      reason,
      ...details,
    },
    'critical'
  );
}

/**
 * Helper to get client IP (for audit purposes)
 * Note: This is a client-side approximation only
 * Real IP should be captured on the server side
 */
function getClientIp(): string | undefined {
  // This is a placeholder - real IP should come from server headers
  return undefined;
}

/**
 * Format audit log for display
 */
export function formatAuditLog(log: AuditLog): string {
  const timestamp = new Date(log.timestamp || '').toLocaleString();
  return `[${log.eventType}] ${timestamp} - ${JSON.stringify(log.eventData)}`;
}
