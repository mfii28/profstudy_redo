'use server';
/**
 * @fileOverview A Genkit flow for generating marketing-optimized course descriptions.
 *
 * - generateCourseDescription - A function that generates a course description.
 */

import { ai } from '@/ai/genkit';
import {
  CourseDescriptionGenerationInputSchema,
  type CourseDescriptionGenerationInput,
  CourseDescriptionGenerationOutputSchema,
  type CourseDescriptionGenerationOutput,
} from '@/ai/schemas/course-description-generation';

export async function generateCourseDescription(
  input: CourseDescriptionGenerationInput
): Promise<CourseDescriptionGenerationOutput> {
  return courseDescriptionGenerationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'courseDescriptionGenerationPrompt',
  input: { schema: CourseDescriptionGenerationInputSchema },
  output: { schema: CourseDescriptionGenerationOutputSchema },
  prompt: `You are an expert copywriter and course marketer. Your task is to improve a course description.

{{#if existingDescription}}
Take the following course description and improve it. Make it more engaging, detailed, and optimized for marketing and SEO.
If the existing description is very short or just a few keywords, treat it as a topic and generate a full description from it.
Existing Description:
"{{{existingDescription}}}"
{{else}}
The description is empty. Generate a new course description from scratch based on the provided title and subtitle.
{{/if}}

The final description should be compelling and clearly outline what students will learn, who the course is for, and any prerequisites.

Use this information for context:
Course Title: {{{courseTitle}}}
{{#if courseSubtitle}}Course Subtitle: {{{courseSubtitle}}}{{/if}}
{{#if keywords}}
Keywords to include: {{#each keywords}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
{{/if}}

Provide only the full, final description in your output.
`,
});

const courseDescriptionGenerationFlow = ai.defineFlow(
  {
    name: 'courseDescriptionGenerationFlow',
    inputSchema: CourseDescriptionGenerationInputSchema,
    outputSchema: CourseDescriptionGenerationOutputSchema,
  },
  async (input: CourseDescriptionGenerationInput) => {
    const { output } = await prompt(input);
    return output!;
  }
);
