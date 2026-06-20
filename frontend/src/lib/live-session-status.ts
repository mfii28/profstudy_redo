import type { LiveClass } from '@/lib/db';

export type LiveSessionUiStatus = 'scheduled' | 'live' | 'ended';

/**
 * Derives UI state from stored `status` and the session time window.
 * DB may use `upcoming` | `past` | optional `scheduled` | `live` | `ended`.
 */
export function resolveLiveSessionUiStatus(cls: LiveClass, nowMs: number = Date.now()): LiveSessionUiStatus {
  const raw = (cls.status || '').toLowerCase();
  if (raw === 'past' || raw === 'ended') return 'ended';

  const start = new Date(cls.startTime).getTime();
  if (Number.isNaN(start)) return 'ended';

  const durationMinutes = cls.durationMinutes ?? 60;
  const end = start + durationMinutes * 60 * 1000;

  if (nowMs > end) return 'ended';
  if (raw === 'live') return 'live';
  if (nowMs >= start && nowMs <= end) return 'live';
  return 'scheduled';
}

export function isLiveSessionJoinable(cls: LiveClass, nowMs?: number): boolean {
  return resolveLiveSessionUiStatus(cls, nowMs) === 'live';
}
