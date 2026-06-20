'use server';
/**
 * @fileOverview AI flow for reviewing course content for quality and safety.
 *
 * - reviewContent - A function that scans content for placeholder text and policy violations.
 */

import { ai } from '@/ai/genkit';
import { ContentReviewInputSchema, ContentReviewOutputSchema, type ContentReviewOutput } from '@/ai/schemas/content-review';

export async function reviewContent(input: { content: string }): Promise<ContentReviewOutput> {
  return reviewContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'contentReviewPrompt',
  input: { schema: ContentReviewInputSchema },
  output: { schema: ContentReviewOutputSchema },
  prompt: `You are an AI content moderator and quality assurance expert for Profs Training Solutions, a professional education platform in Ghana.
    Review the following course content for:
    1. Placeholder text (e.g., "[Insert link here]", "Lorum Ipsum").
    2. Policy violations (hate speech, misleading information, etc.).
    3. Clarity and professional tone suitable for ICAG/CITG students.
    
    Content:
    "{{{content}}}"`,
});

const reviewContentFlow = ai.defineFlow(
  {
    name: 'reviewContentFlow',
    inputSchema: ContentReviewInputSchema,
    outputSchema: ContentReviewOutputSchema,
  },
  async (input: { content: string }) => {
    const { output } = await prompt(input);
    return output!;
  }
);
