import { z } from 'genkit';

export const CourseDescriptionGenerationInputSchema = z.object({
  courseTitle: z.string().describe('The title of the course.'),
  courseSubtitle: z
    .string()
    .optional()
    .describe('The subtitle or a brief one-liner for the course.'),
  existingDescription: z
    .string()
    .optional()
    .describe('An existing draft of the course description to be improved.'),
  keywords: z
    .array(z.string())
    .optional()
    .describe('A list of keywords to include for SEO purposes.'),
});
export type CourseDescriptionGenerationInput = z.infer<
  typeof CourseDescriptionGenerationInputSchema
>;

export const CourseDescriptionGenerationOutputSchema = z.object({
  description: z
    .string()
    .describe('The full, marketing-optimized course description.'),
});
export type CourseDescriptionGenerationOutput = z.infer<
  typeof CourseDescriptionGenerationOutputSchema
>;
