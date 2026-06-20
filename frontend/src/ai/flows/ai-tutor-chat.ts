'use server';
/**
 * @fileOverview AI Tutor Chat — RAG-powered (Genkit).
 * Prompt text is built via `@/lib/ai-tutor-gemini` so it stays aligned with the streaming tutor API.
 */

import { z } from 'genkit';
import { ai } from '@/ai/genkit';
import {
  AiTutorChatInputSchema,
  type AiTutorChatInput,
  AiTutorChatOutputSchema,
  type AiTutorChatOutput,
} from '@/ai/schemas/ai-tutor-chat';
import {
  buildTutorSystemInstruction,
  buildTutorUserContent,
  deriveSourceDocNames,
  type TutorPersona,
} from '@/lib/ai-tutor-gemini';

export async function aiTutorChat(input: AiTutorChatInput): Promise<AiTutorChatOutput> {
  return aiTutorChatFlow(input);
}

/** Single user turn: system rules + source material + question (matches streaming route semantics). */
const TutorChatRenderedSchema = z.object({
  combinedUserPrompt: z.string(),
});

const prompt = ai.definePrompt({
  name: 'aiTutorChatPrompt',
  input: { schema: TutorChatRenderedSchema },
  output: { schema: AiTutorChatOutputSchema },
  prompt: `{{{combinedUserPrompt}}}`,
});

const aiTutorChatFlow = ai.defineFlow(
  {
    name: 'aiTutorChatFlow',
    inputSchema: AiTutorChatInputSchema,
    outputSchema: AiTutorChatOutputSchema,
  },
  async (input: AiTutorChatInput) => {
    const persona = input.persona as TutorPersona;
    const system = buildTutorSystemInstruction(persona);
    const userBlock = buildTutorUserContent(
      input.question,
      input.retrievedContext,
      input.courseMaterial,
    );
    const combinedUserPrompt = `${system}\n\n${userBlock}`;

    const { output } = await prompt({ combinedUserPrompt });
    const sourceDocs =
      deriveSourceDocNames(input.retrievedContext) ?? output?.sourceDocs;
    return { ...output!, sourceDocs };
  },
);
