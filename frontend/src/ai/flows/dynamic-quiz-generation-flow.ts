'use server';
/**
 * @fileOverview A Genkit flow for dynamically generating multiple-choice quizzes.
 *
 * - generateQuiz - A function that generates a quiz based on provided lesson content and topic.
 */

import { ai } from '@/ai/genkit';
import {
  DynamicQuizGenerationInputSchema,
  type DynamicQuizGenerationInput,
  DynamicQuizGenerationOutputSchema,
  type DynamicQuizGenerationOutput,
} from '@/ai/schemas/dynamic-quiz-generation-flow';

export async function generateQuiz(
  input: DynamicQuizGenerationInput
): Promise<DynamicQuizGenerationOutput> {
  return dynamicQuizGenerationFlow(input);
}

const quizGenerationPrompt = ai.definePrompt({
  name: 'quizGenerationPrompt',
  input: { schema: DynamicQuizGenerationInputSchema },
  output: { schema: DynamicQuizGenerationOutputSchema },
  prompt: `You are an expert quiz master. Your task is to generate a multiple-choice quiz based on the provided lesson content and topic.
The quiz should have {{numberOfQuestions}} questions at {{difficulty}} difficulty level. Each question must have 2 to 5 options, and exactly one correct answer.
Provide a brief explanation for the correct answer.

Difficulty guidelines:
- Easy: Basic recall and comprehension questions.
- Medium: Application and analysis questions requiring understanding of concepts.
- Hard: Complex scenario-based questions requiring deep analysis and synthesis.
- Expert: Advanced professional-level questions with tricky distractors and nuanced reasoning.

Here is the lesson content:
{{{lessonContent}}}

Here is the topic:
{{{topic}}}

Generate the quiz in JSON format conforming to the following schema:
`,
});

const dynamicQuizGenerationFlow = ai.defineFlow(
  {
    name: 'dynamicQuizGenerationFlow',
    inputSchema: DynamicQuizGenerationInputSchema,
    outputSchema: DynamicQuizGenerationOutputSchema,
  },
  async (input: DynamicQuizGenerationInput) => {
    const { output } = await quizGenerationPrompt(input);
    return output!;
  }
);
