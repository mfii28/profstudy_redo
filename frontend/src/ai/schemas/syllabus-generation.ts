import { z } from 'genkit';

export const SyllabusGenerationInputSchema = z.object({
  courseTopic: z
    .string()
    .describe('The main topic or title of the course.'),
  numberOfSections: z
    .number()
    .int()
    .min(1)
    .max(15)
    .optional()
    .default(5)
    .describe('The desired number of sections in the syllabus.'),
});
export type SyllabusGenerationInput = z.infer<
  typeof SyllabusGenerationInputSchema
>;

const SuggestedLessonTypeEnum = z.enum(['video', 'document', 'resource', 'text', 'pdf']);

export const SyllabusGenerationOutputSchema = z.object({
  sections: z
    .array(
      z.object({
        title: z.string().describe('The title of the course section.'),
        lessons: z
          .array(
            z.object({
              title: z.string().describe('The title of the lesson.'),
              type: SuggestedLessonTypeEnum.describe(
                "The suggested type for the lesson, e.g., 'video', 'document', or 'resource'."
              ),
            })
          )
          .describe('A list of lessons within this section.'),
      })
    )
    .describe('The array of generated course sections.'),
});
export type SyllabusGenerationOutput = z.infer<
  typeof SyllabusGenerationOutputSchema
>;
