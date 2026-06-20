'use server';
/**
 * @fileOverview RAG-powered flashcard generation from uploaded study materials.
 */

import { ai } from '@/ai/genkit';
import {
  FlashcardGenerationInputSchema,
  type FlashcardGenerationInput,
  FlashcardGenerationOutputSchema,
  type FlashcardGenerationOutput,
} from '@/ai/schemas/flashcard-generation';

export async function generateFlashcards(
  input: FlashcardGenerationInput
): Promise<FlashcardGenerationOutput> {
  return flashcardGenerationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'flashcardGenerationPrompt',
  input: { schema: FlashcardGenerationInputSchema },
  output: { schema: FlashcardGenerationOutputSchema },
  prompt: `You are an expert study assistant. Create {{count}} high-quality flashcards for the topic "{{topic}}" using ONLY the source material below.

Rules for cards:
- Front: A clear, single-concept question or term.
- Back: A concise, complete answer or definition.
- Base every card strictly on the provided material — no invented facts.
- Prioritise definitions, formulas, key concepts, and exam-likely topics.

### SOURCE MATERIAL
{{#if retrievedContext}}
{{#each retrievedContext}}
--- [{{docName}}, chunk {{chunkIndex}}] ---
{{{text}}}

{{/each}}
{{else}}
{{{content}}}
{{/if}}

Generate the flashcards in JSON format:
`,
});

const flashcardGenerationFlow = ai.defineFlow(
  {
    name: 'flashcardGenerationFlow',
    inputSchema: FlashcardGenerationInputSchema,
    outputSchema: FlashcardGenerationOutputSchema,
  },
  async (input: FlashcardGenerationInput) => {
    const { output } = await prompt(input);
    return output!;
  }
);
