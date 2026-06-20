import { z } from 'zod';

export const ContentReviewInputSchema = z.object({
  content: z.string().describe('The course content to be reviewed.'),
});
export type ContentReviewInput = z.infer<typeof ContentReviewInputSchema>;

export const ContentReviewOutputSchema = z.object({
  issues: z.array(z.string()).describe('A list of detected issues like placeholder text or policy violations.'),
  suggestions: z.array(z.string()).describe('Suggestions for improvement.'),
  isSafe: z.boolean().describe('Whether the content is safe to publish.'),
});
export type ContentReviewOutput = z.infer<typeof ContentReviewOutputSchema>;
