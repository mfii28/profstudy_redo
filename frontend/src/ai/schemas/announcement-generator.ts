import { z } from 'genkit';

export const RefineAnnouncementInputSchema = z.object({
  text: z.string().describe('The draft announcement text to be refined.'),
  tone: z.enum(['Professional', 'Urgent', 'Friendly', 'Exciting']).default('Professional'),
});
export type RefineAnnouncementInput = z.infer<typeof RefineAnnouncementInputSchema>;

export const GenerateSecurityAlertInputSchema = z.object({
  incidentType: z.string().describe('The type of suspicious activity noticed (e.g., card testing, account sharing).'),
});
export type GenerateSecurityAlertInput = z.infer<typeof GenerateSecurityAlertInputSchema>;

export const AnnouncementOutputSchema = z.object({
  subject: z.string().optional().describe('A catchy subject line for email campaigns.'),
  message: z.string().describe('The final announcement content.'),
});
export type AnnouncementOutput = z.infer<typeof AnnouncementOutputSchema>;
