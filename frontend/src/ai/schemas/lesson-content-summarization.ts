import { z } from 'genkit';

const VideoContentInputSchema = z.object({
  type: z
    .literal('video')
    .describe('Indicates the content is a video transcript.'),
  transcript: z
    .string()
    .describe('The transcript of the video lesson to be summarized.'),
});

const DocumentContentInputSchema = z.object({
  type: z
    .literal('document')
    .describe('Indicates the content is a text document.'),
  documentText: z
    .string()
    .describe('The text content of the document to be summarized.'),
});

export const LessonContentSummarizationInputSchema = z
  .discriminatedUnion('type', [
    VideoContentInputSchema,
    DocumentContentInputSchema,
  ])
  .describe(
    'Input for the lesson content summarization flow, accepting either a video transcript or a text document.'
  );

export type LessonContentSummarizationInput = z.infer<
  typeof LessonContentSummarizationInputSchema
>;

export const LessonContentSummarizationOutputSchema = z
  .object({
    summary: z
      .string()
      .describe('A concise, AI-generated summary of the provided content.'),
  })
  .describe(
    'Output from the lesson content summarization flow, containing the generated summary.'
  );

export type LessonContentSummarizationOutput = z.infer<
  typeof LessonContentSummarizationOutputSchema
>;
