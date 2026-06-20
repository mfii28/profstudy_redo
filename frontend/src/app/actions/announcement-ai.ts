'use server';

import { generateSecurityAlert, refineAnnouncement } from '@/ai/flows/announcement-generator';
import type { RefineAnnouncementInput } from '@/ai/schemas/announcement-generator';

export async function refineAnnouncementForAdmin(
  text: string,
  tone: RefineAnnouncementInput['tone'] = 'Professional'
) {
  try {
    if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
      return { error: 'AI is not configured. Set GOOGLE_API_KEY or GEMINI_API_KEY.' };
    }

    if (!String(text || '').trim()) {
      return { error: 'Message text is required.' };
    }

    const result = await refineAnnouncement({ text, tone });
    if (!result?.message) {
      return { error: 'AI did not return a refined message.' };
    }

    return { result };
  } catch (error: any) {
    return { error: error?.message || 'Failed to refine announcement.' };
  }
}

export async function generateSecurityAlertForAdmin(incidentType: string) {
  try {
    if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
      return { error: 'AI is not configured. Set GOOGLE_API_KEY or GEMINI_API_KEY.' };
    }

    const result = await generateSecurityAlert({
      incidentType: String(incidentType || '').trim() || 'suspicious login patterns and potential account sharing',
    });

    if (!result?.message) {
      return { error: 'AI did not return a security alert.' };
    }

    return { result };
  } catch (error: any) {
    return { error: error?.message || 'Failed to generate security alert.' };
  }
}