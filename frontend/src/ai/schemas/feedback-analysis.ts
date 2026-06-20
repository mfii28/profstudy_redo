import { z } from 'zod';

export const FeedbackAnalysisInputSchema = z.object({
  reviews: z.array(z.string()).describe('An array of student review texts.'),
});
export type FeedbackAnalysisInput = z.infer<typeof FeedbackAnalysisInputSchema>;

export const FeedbackAnalysisOutputSchema = z.object({
  strengths: z.array(z.string()).describe('Main strengths identified in the feedback.'),
  weaknesses: z.array(z.string()).describe('Main weaknesses identified in the feedback.'),
  overallSentiment: z.enum(['Positive', 'Neutral', 'Negative']).describe('The general mood of the reviews.'),
  summary: z.string().describe('A concise summary of the feedback analysis.'),
});
export type FeedbackAnalysisOutput = z.infer<typeof FeedbackAnalysisOutputSchema>;
