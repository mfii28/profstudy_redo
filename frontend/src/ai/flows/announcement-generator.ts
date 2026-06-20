'use server';
/**
 * @fileOverview AI flows for generating and refining platform announcements.
 * 
 * - refineAnnouncement: Improves the tone and clarity of draft messages.
 * - generateSecurityAlert: Creates urgent alerts for suspicious activities.
 */

import { ai } from '@/ai/genkit';
import {
  RefineAnnouncementInputSchema,
  type RefineAnnouncementInput,
  GenerateSecurityAlertInputSchema,
  type GenerateSecurityAlertInput,
  AnnouncementOutputSchema,
  type AnnouncementOutput,
} from '@/ai/schemas/announcement-generator';

export async function refineAnnouncement(input: RefineAnnouncementInput): Promise<AnnouncementOutput> {
  const { output } = await ai.generate({
    prompt: `You are a platform communication expert for Profs Training Solutions. 
    Refine the following announcement to be more effective.
    Tone: ${input.tone}
    
    Original Text:
    "${input.text}"
    
    Provide a professional subject line and the refined body text.`,
    output: { schema: AnnouncementOutputSchema },
  });
  return output!;
}

export async function generateSecurityAlert(input: GenerateSecurityAlertInput): Promise<AnnouncementOutput> {
  const { output } = await ai.generate({
    prompt: `Generate an urgent but calm security alert for all Profs Training Solutions users regarding: ${input.incidentType}.
    Advise users to be vigilant and remind them that we never ask for passwords. 
    Maintain a tone of authority and protection.`,
    output: { schema: AnnouncementOutputSchema },
  });
  return output!;
}
