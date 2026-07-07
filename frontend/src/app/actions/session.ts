'use server';

import { apiFetchServer } from '@/lib/api-client.server';

export async function revokeAllSessions(
  idToken: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    await apiFetchServer('/api/v1/session/revoke-all', {
      method: 'POST',
    });
    return { success: true };
  } catch (error: any) {
    return { error: 'Failed to revoke sessions. Please re-authenticate and try again.' };
  }
}

export async function notifyEnrolledStudents(
  courseId: string,
  title: string,
  message: string,
  idToken: string
): Promise<{ notified: number } | { error: string }> {
  try {
    const res = await apiFetchServer('/api/v1/notifications/broadcast/course', {
      method: 'POST',
      body: JSON.stringify({ courseId, title, message }),
    });
    const data = await res.json();
    return { notified: data.notifiedCount || 0 };
  } catch (error: any) {
    return { error: error.message || 'Failed to send notifications.' };
  }
}
