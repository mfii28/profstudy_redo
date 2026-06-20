'use server';
/**
 * @fileOverview A Genkit flow for generating a course syllabus from a topic.
 *
 * - generateSyllabus - A function that generates a course syllabus.
 */

import { ai } from '@/ai/genkit';
import {
  SyllabusGenerationInputSchema,
  type SyllabusGenerationInput,
  SyllabusGenerationOutputSchema,
  type SyllabusGenerationOutput,
} from '@/ai/schemas/syllabus-generation';

export async function generateSyllabus(
  input: SyllabusGenerationInput
): Promise<SyllabusGenerationOutput> {
  return syllabusGenerationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'syllabusGenerationPrompt',
  input: { schema: SyllabusGenerationInputSchema },
  output: { schema: SyllabusGenerationOutputSchema },
  prompt: `You are an expert curriculum and instructional designer for an online learning platform.
Your task is to generate a structured and comprehensive syllabus for a course based on a given topic.

Create a syllabus with approximately {{numberOfSections}} sections.
Each section must have a clear, descriptive title.
Within each section, generate a list of 2 to 5 relevant lesson titles.
For each lesson, suggest a suitable type from the available options ('video', 'document', 'resource').

The output MUST be a JSON object that strictly conforms to the provided output schema.

Course Topic: {{{courseTopic}}}

Generate the syllabus now.
`,
});

const syllabusGenerationFlow = ai.defineFlow(
  {
    name: 'syllabusGenerationFlow',
    inputSchema: SyllabusGenerationInputSchema,
    outputSchema: SyllabusGenerationOutputSchema,
  },
  async (input: SyllabusGenerationInput) => {
    const { output } = await prompt(input);
    return output!;
  }
);
