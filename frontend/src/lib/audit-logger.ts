/**
 * @fileOverview Audit logging service for sensitive tutor operations.
 * Routes through the Python backend REST API.
 */

import { apiFetch } from '@/lib/api-client';

export type AuditEventType = 
  | 'payout_requested'
  | 'payout_completed'
  | 'payout_failed'
  | 'course_created'
  | 'course_updated'
  | 'course_deleted'
  | 'student_data_access'
  | 'bulk_message'
  | 'security_event';

export interface AuditLog {
  id: string;
  tutorId: string;
  eventType: AuditEventType;
  eventData: Record<string, unknown>;
  severity: 'info' | 'warn' | 'critical';
  ipAddress?: string;
  timestamp: string;
}

export async function logAuditEvent(
  tutorId: string,
  eventType: AuditEventType,
  eventData: Record<string, unknown>,
  severity: 'info' | 'warn' | 'critical' = 'info'
): Promise<void> {
  try {
    await apiFetch('/audit-logs', {
      method: 'POST',
      body: JSON.stringify({ tutorId, eventType, eventData, severity }),
    });
  } catch (error) {
    console.error('[AuditLog] Failed to log event:', error);
  }
}

export async function getAuditLogs(
  tutorId: string,
  limitCount: number = 50,
  eventType?: AuditEventType
): Promise<AuditLog[]> {
  try {
    const params = new URLSearchParams({ tutorId, limit: String(limitCount) });
    if (eventType) params.set('eventType', eventType);
    const res = await apiFetch(`/audit-logs?${params.toString()}`);
    if (!res.ok) return [];
    return (await res.json()).logs || [];
  } catch {
    return [];
  }
}

export async function getCriticalAuditLogs(tutorId: string): Promise<AuditLog[]> {
  return getAuditLogs(tutorId, 50, 'security_event');
}

export async function logPayoutRequest(
  tutorId: string, amount: number, method: string, payoutId: string
): Promise<void> {
  await logAuditEvent(tutorId, 'payout_requested', { amount, method, payoutId }, 'info');
}

export async function logCourseDelete(
  tutorId: string, courseId: string, courseTitle: string, studentCount: number
): Promise<void> {
  await logAuditEvent(tutorId, 'course_deleted', { courseId, courseTitle, studentCount }, 'warn');
}

export async function logBulkMessage(
  tutorId: string, recipientCount: number, messagePreview: string
): Promise<void> {
  await logAuditEvent(tutorId, 'bulk_message', { recipientCount, messagePreview }, 'info');
}

export async function logSecurityEvent(
  tutorId: string, reason: string, details: Record<string, unknown> = {}
): Promise<void> {
  await logAuditEvent(tutorId, 'security_event', { reason, ...details }, 'critical');
}

export function formatAuditLog(log: AuditLog): string {
  return `[${log.severity.toUpperCase()}] ${log.eventType} by ${log.tutorId} at ${log.timestamp}`;
}

export function getClientIp(): string {
  return typeof window !== 'undefined' ? '' : '';
}
