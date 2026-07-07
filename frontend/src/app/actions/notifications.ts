'use server';

import { apiFetchServer } from '@/lib/api-client.server';
import { logger } from '@/lib/logging';

type BroadcastAnnouncementInput = {
  idToken: string;
  title: string;
  message: string;
  type?: 'Info' | 'Warning' | 'Promotion';
  audience?: 'all' | 'students' | 'tutors' | 'specific';
  targetUserId?: string;
};

export async function broadcastAnnouncementNotification(input: BroadcastAnnouncementInput) {
  try {
    const res = await apiFetchServer('/api/v1/notifications/broadcast', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        message: input.message,
        audience: input.audience === 'all' ? undefined : (input.audience === 'students' ? 'student' : (input.audience === 'tutors' ? 'tutor' : undefined)),
        targetUserId: input.targetUserId,
      }),
    });
    const data = await res.json();
    return { success: true, notifiedCount: data.notifiedCount || 0 };
  } catch (error: any) {
    logger.error('[Announcement Notification] Broadcast failed', { error: error.message });
    return { error: error.message || 'Failed to broadcast notifications.' };
  }
}
