'use server';
/**
 * @fileOverview A Genkit flow for generating personalized study plans for students.
 *
 * - personalizedStudyPlanGeneration - A function that generates a personalized study plan.
 */

import { ai } from '@/ai/genkit';
import {
  PersonalizedStudyPlanInputSchema,
  type PersonalizedStudyPlanInput,
  PersonalizedStudyPlanOutputSchema,
  type PersonalizedStudyPlanOutput,
} from '@/ai/schemas/personalized-study-plan-generation';

const personalizedStudyPlanPrompt = ai.definePrompt({
  name: 'personalizedStudyPlanPrompt',
  input: { schema: PersonalizedStudyPlanInputSchema },
  output: { schema: PersonalizedStudyPlanOutputSchema },
  prompt: `You are an expert academic advisor and study planner. Your goal is to create a highly personalized and realistic daily study plan for a student based on their courses, progress, desired completion date, and available study time.\n\nThe student's name is: {{{studentName}}}\n\nHere are the courses the student is enrolled in, including their modules and estimated total hours:\n{{#each courses}}\n- Course: {{{courseTitle}}} (Total Estimated Hours: {{{totalEstimatedHours}}})\n  Modules: {{#each moduleTitles}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}\n{{/each}}\n\nHere is the student's current progress:\n{{#each currentProgress}}\n- Course: {{{courseTitle}}}\n  Completed Modules: {{#each completedModuleTitles}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}\n{{/each}}\n\nThe student wants to complete all enrolled courses by: {{{desiredCompletionDate}}}\nThe student can commit approximately {{{dailyStudyHours}}} hours to studying per day.\n\nGenerate a detailed, day-by-day study plan. For each day, include the date and a list of specific tasks. Each task should specify the course, the module to work on, the estimated hours for that task (ensure it aligns with the daily study hour limit), and a brief description of what to focus on.\n\nMake sure the plan is realistic given the daily study hours and the desired completion date. Prioritize modules that have not yet been completed. If a module is large, break it down into smaller, manageable tasks across multiple days.\n\nFinally, provide a brief summary of the plan and any important notes or recommendations for the student.\n\nThe output MUST be a JSON object matching the provided output schema.`,
});

const personalizedStudyPlanGenerationFlow = ai.defineFlow(
  {
    name: 'personalizedStudyPlanGenerationFlow',
    inputSchema: PersonalizedStudyPlanInputSchema,
    outputSchema: PersonalizedStudyPlanOutputSchema,
  },
  async (input: PersonalizedStudyPlanInput) => {
    const { output } = await personalizedStudyPlanPrompt(input);
    return output!;
  }
);

export async function personalizedStudyPlanGeneration(
  input: PersonalizedStudyPlanInput
): Promise<PersonalizedStudyPlanOutput> {
  return personalizedStudyPlanGenerationFlow(input);
}
