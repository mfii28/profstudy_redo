'use server';
/**
 * @fileOverview AI flow for analyzing student feedback and reviews.
 *
 * - analyzeFeedback - Categorizes reviews into strengths and weaknesses.
 */

import { ai } from '@/ai/genkit';
import { FeedbackAnalysisInputSchema, FeedbackAnalysisOutputSchema, type FeedbackAnalysisOutput } from '@/ai/schemas/feedback-analysis';

export async function analyzeFeedback(input: { reviews: string[] }): Promise<FeedbackAnalysisOutput> {
  return analyzeFeedbackFlow(input);
}

const prompt = ai.definePrompt({
  name: 'feedbackAnalysisPrompt',
  input: { schema: FeedbackAnalysisInputSchema },
  output: { schema: FeedbackAnalysisOutputSchema },
  prompt: `Analyze the following student reviews for a course on Profs Training Solutions. 
    Identify exactly 3-5 key strengths, 3-5 key weaknesses, and the overall sentiment. 
    Provide a professional summary that includes advice for the instructor.
    
    Reviews:
    {{#each reviews}}
    - {{{this}}}
    {{/each}}`,
});

const analyzeFeedbackFlow = ai.defineFlow(
  {
    name: 'analyzeFeedbackFlow',
    inputSchema: FeedbackAnalysisInputSchema,
    outputSchema: FeedbackAnalysisOutputSchema,
  },
  async (input: { reviews: string[] }) => {
    const { output } = await prompt(input);
    return output!;
  }
);
