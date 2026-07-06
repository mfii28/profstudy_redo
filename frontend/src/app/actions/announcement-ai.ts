'use server';

import { apiFetchServer } from '@/lib/api-client.server';
import { logger } from '@/lib/logging';

export async function refineAnnouncementForAdmin(text: string, tone: string = 'Professional') {
  try {
    if (!text.trim()) {
      return { error: 'Message text is required.' };
    }
    
    const res = await apiFetchServer('/api/v1/ai/announcement/refine', {
      method: 'POST',
      body: JSON.stringify({ text, tone }),
    });
    
    return { result: res.result };
  } catch (error: any) {
    logger.error('[Announcement AI] Failed to refine announcement', { error: error.message });
    return { error: error.message || 'Failed to refine announcement.' };
  }
}

export async function generateSecurityAlertForAdmin(incidentType: string) {
  try {
    const res = await apiFetchServer('/api/v1/ai/announcement/security-alert', {
      method: 'POST',
      body: JSON.stringify({ incidentType: incidentType.trim() || 'suspicious login patterns and potential account sharing' }),
    });
    
    return { result: res.result };
  } catch (error: any) {
    logger.error('[Announcement AI] Failed to generate security alert', { error: error.message });
    return { error: error.message || 'Failed to generate security alert.' };
  }
}