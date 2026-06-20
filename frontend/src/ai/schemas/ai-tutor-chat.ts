import { z } from 'genkit';

export const AiTutorChatInputSchema = z.object({
  question: z.string().max(2000).describe("The student's question."),
  courseMaterial: z.string().max(65000).optional().describe('Fallback course material when no RAG context is available.'),
  retrievedContext: z
    .array(z.object({ text: z.string(), docName: z.string(), chunkIndex: z.number() }))
    .optional()
    .describe('Semantically-retrieved document chunks relevant to the question.'),
  persona: z
    .enum(['Friendly', 'Strict', 'Beginner', 'Expert', 'Exam Coach'])
    .default('Friendly')
    .describe('The personality and teaching style of the AI tutor.'),
});
export type AiTutorChatInput = z.infer<typeof AiTutorChatInputSchema>;

export const AiTutorChatOutputSchema = z.object({
  answer: z.string().describe("The AI tutor's detailed and helpful answer."),
  sourceDocs: z
    .array(z.string())
    .optional()
    .describe('Document names the answer was drawn from.'),
});
export type AiTutorChatOutput = z.infer<typeof AiTutorChatOutputSchema>;
