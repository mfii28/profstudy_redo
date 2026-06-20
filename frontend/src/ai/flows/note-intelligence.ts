'use server';
/**
 * @fileOverview AI flow for enhancing and simplifying student study notes.
 *
 * - processNoteIntelligence: A function that refines student notes.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const NoteIntelligenceInputSchema = z.object({
  noteContent: z.string().describe('The content of the note to enhance.'),
  action: z.enum(['simplify', 'elaborate']).describe('The AI action to perform on the note.'),
});

const NoteIntelligenceOutputSchema = z.object({
  refinedContent: z.string().describe('The AI-refined version of the note.'),
});

/**
 * AI logic to refine or expand student notes for better study outcomes.
 */
export async function processNoteIntelligence(input: z.infer<typeof NoteIntelligenceInputSchema>) {
  const { output } = await ai.generate({
    prompt: `You are a professional academic study assistant specialized in professional accounting (ICAG) and taxation (CITG).
    
    Take the following student note and perform the requested action: ${input.action}.
    
    ACTION RULES:
    - If 'simplify': Rewrite the note using plain, easy-to-understand language. Use analogies if applicable.
    - If 'elaborate': Add technical context, industry standards, or exam-focused details to make the note more comprehensive.
    
    Student Note:
    "${input.noteContent}"
    
    Output ONLY the refined content. Maintain a professional yet encouraging tone.`,
    output: { schema: NoteIntelligenceOutputSchema },
  });

  return output!;
}
