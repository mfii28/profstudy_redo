import { z } from 'genkit';

export const DynamicQuizGenerationInputSchema = z.object({
  topic: z
    .string()
    .describe('The specific topic or module for which to generate the quiz.'),
  lessonContent: z
    .string()
    .describe(
      'The full content of the lesson or module from which to generate quiz questions.'
    ),
  numberOfQuestions: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe('The desired number of quiz questions.'),
  difficulty: z
    .enum(['Easy', 'Medium', 'Hard', 'Expert'])
    .optional()
    .default('Medium')
    .describe('The difficulty level of the quiz questions.'),
});
export type DynamicQuizGenerationInput = z.infer<
  typeof DynamicQuizGenerationInputSchema
>;

export const DynamicQuizGenerationOutputSchema = z.object({
  quiz: z.array(
    z.object({
      questionText: z.string().describe('The text of the quiz question.'),
      options: z
        .array(z.string())
        .min(2)
        .max(5)
        .describe('An array of possible answer options for the question.'),
      correctAnswerIndex: z
        .number()
        .int()
        .describe('The zero-based index of the correct answer within the options array.'),
      explanation: z
        .string()
        .optional()
        .describe('An optional explanation for the correct answer.'),
    })
  ),
});
export type DynamicQuizGenerationOutput = z.infer<
  typeof DynamicQuizGenerationOutputSchema
>;
