import { z } from 'genkit';

export const PersonalizedStudyPlanInputSchema = z.object({
  studentName: z
    .string()
    .describe('The name of the student for whom the plan is being generated.'),
  courses: z
    .array(
      z.object({
        courseTitle: z.string().describe('The title of the course.'),
        moduleTitles: z
          .array(z.string())
          .describe('A list of module titles in the course.'),
        totalEstimatedHours: z
          .number()
          .describe('The total estimated hours required to complete this course.'),
      })
    )
    .describe('A list of courses the student is enrolled in.'),
  currentProgress: z
    .array(
      z.object({
        courseTitle: z.string().describe('The title of the course.'),
        completedModuleTitles: z
          .array(z.string())
          .describe(
            'A list of module titles that the student has already completed in this course.'
          ),
      })
    )
    .describe('The current progress of the student across their enrolled courses.'),
  desiredCompletionDate: z
    .string()
    .datetime({ offset: true })
    .describe(
      'The target date by which the student wishes to complete all enrolled courses.'
    ),
  dailyStudyHours: z
    .number()
    .min(0.5)
    .max(16)
    .describe(
      'The average number of hours the student can commit to studying daily.'
    ),
});
export type PersonalizedStudyPlanInput = z.infer<
  typeof PersonalizedStudyPlanInputSchema
>;

export const PersonalizedStudyPlanOutputSchema = z.object({
  studyPlan: z
    .array(
      z.object({
        date: z
          .string()
          .datetime({ offset: true })
          .describe('The date for this study day.'),
        tasks: z
          .array(
            z.object({
              courseTitle: z
                .string()
                .describe('The title of the course for this task.'),
              moduleTitle: z
                .string()
                .describe('The specific module to work on.'),
              estimatedHours: z
                .number()
                .describe(
                  'The estimated hours recommended for completing this task.'
                ),
              description: z
                .string()
                .describe('A detailed description of the study task.'),
            })
          )
          .describe('A list of study tasks for this day.'),
      })
    )
    .describe('A day-by-day personalized study plan.'),
  summary: z.string().describe('A summary of the generated study plan.'),
  notes: z
    .string()
    .optional()
    .describe('Any additional notes or recommendations from the AI.'),
});
export type PersonalizedStudyPlanOutput = z.infer<
  typeof PersonalizedStudyPlanOutputSchema
>;
