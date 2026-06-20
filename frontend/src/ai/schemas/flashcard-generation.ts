import { z } from 'genkit';

export const FlashcardGenerationInputSchema = z.object({
  topic: z.string().describe('The topic or module to generate flashcards for.'),
  content: z.string().optional().describe('Fallback course content when no RAG context is available.'),
  retrievedContext: z
    .array(z.object({ text: z.string(), docName: z.string(), chunkIndex: z.number() }))
    .optional()
    .describe('Semantically-retrieved document chunks relevant to the topic.'),
  count: z.number().int().min(1).max(20).default(10),
});
export type FlashcardGenerationInput = z.infer<typeof FlashcardGenerationInputSchema>;

export const FlashcardGenerationOutputSchema = z.object({
  flashcards: z.array(z.object({
    front: z.string().describe('The question or term on the front of the card.'),
    back: z.string().describe('The answer or explanation on the back of the card.'),
  })),
});
export type FlashcardGenerationOutput = z.infer<typeof FlashcardGenerationOutputSchema>;
