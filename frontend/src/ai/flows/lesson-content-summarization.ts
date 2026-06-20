'use server';
/**
 * @fileOverview A Genkit flow for generating concise summaries of lesson content.
 *
 * - summarizeLessonContent - A function that generates an AI-powered summary for a video transcript or text document.
 */

import { ai } from '@/ai/genkit';
import {
  LessonContentSummarizationInputSchema,
  type LessonContentSummarizationInput,
  LessonContentSummarizationOutputSchema,
  type LessonContentSummarizationOutput,
} from '@/ai/schemas/lesson-content-summarization';

export async function summarizeLessonContent(
  input: LessonContentSummarizationInput,
  options?: { requesterUid?: string }
): Promise<LessonContentSummarizationOutput> {
  const requesterUid = options?.requesterUid;
  if (!requesterUid) {
    throw new Error('Authentication required.');
  }

  return lessonContentSummarizationFlow(input);
}

const summarizationPrompt = ai.definePrompt({
  name: 'lessonContentSummarizationPrompt',
  input: { schema: LessonContentSummarizationInputSchema },
  output: { schema: LessonContentSummarizationOutputSchema },
  prompt: `You are an expert summarizer. Your task is to generate a concise summary of the provided content. Focus on the main points, key takeaways, and critical information.

Summary should be 3-5 sentences long.

Content Type: {{type}}

Content to Summarize:
{{#if transcript}}
{{{transcript}}}
{{/if}}
{{#if documentText}}
{{{documentText}}}
{{/if}}
`,
});

const lessonContentSummarizationFlow = ai.defineFlow(
  {
    name: 'lessonContentSummarizationFlow',
    inputSchema: LessonContentSummarizationInputSchema,
    outputSchema: LessonContentSummarizationOutputSchema,
  },
  async (input: LessonContentSummarizationInput) => {
    const { output } = await summarizationPrompt(input);
    return output!;
  }
);
