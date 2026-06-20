
'use server';
/**
 * @fileOverview AI agent for generating social media marketing copy.
 *
 * - generateSocialPromotion: Next.js Server Action wrapping the Genkit flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SocialPromotionInputSchema = z.object({
  courseTitle: z.string().describe('The title of the course to promote.'),
  tutorName: z.string().describe('The name of the course instructor.'),
  platform: z.enum(['LinkedIn', 'WhatsApp', 'Twitter']).describe('Target social platform.'),
  referralLink: z.string().describe('The unique referral link to include.'),
});
export type SocialPromotionInput = z.infer<typeof SocialPromotionInputSchema>;

const SocialPromotionOutputSchema = z.object({
  postContent: z.string().describe('The generated promotional text.'),
});
export type SocialPromotionOutput = z.infer<typeof SocialPromotionOutputSchema>;

/**
 * Genkit Flow for social media promotion generation.
 */
const socialPromotionFlow = ai.defineFlow(
  {
    name: 'socialPromotionFlow',
    inputSchema: SocialPromotionInputSchema,
    outputSchema: SocialPromotionOutputSchema,
  },
  async (input: SocialPromotionInput) => {
    const { output } = await ai.generate({
      prompt: `You are a high-conversion social media marketing expert for Profs Training Solutions, Ghana's leading ICAG & CITG prep platform.
      
      TASK: Generate a viral ${input.platform} post to promote the course "${input.courseTitle}" by ${input.tutorName}.
      
      STRATEGY:
      - TONE: Professional yet highly encouraging. Focus on career advancement.
      - VALUE: Mention how this course helps pass professional exams.
      - PLATFORM SPECIFICS:
        * WhatsApp: Use emojis (🔥, 📚, ✍️) and keep it friendly for Status updates.
        * LinkedIn: Focus on professional standards, CPD, and industry growth.
        * Twitter: Keep it punchy with relevant hashtags like #ICAG #GhanaAccountants.
      
      MANDATORY:
      - Include the link: ${input.referralLink}
      - Clearly state the course is available on Profs Training Solutions.
      
      Output ONLY the post text. No explanations or meta-talk.`,
      output: { schema: SocialPromotionOutputSchema },
    });

    if (!output) {
      throw new Error('AI failed to generate promotional content.');
    }
    return output;
  }
);

/**
 * Server Action wrapper for the dashboard.
 */
export async function generateSocialPromotion(input: SocialPromotionInput): Promise<SocialPromotionOutput> {
  try {
    return await socialPromotionFlow(input);
  } catch (error: any) {
    console.error("[AI Flow Error] SocialPromotion:", error.message);
    throw new Error("Generation failed. Please check your inputs and try again.");
  }
}
