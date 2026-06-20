import { z } from 'genkit';

export const ExamItemSchema = z.object({
  id: z.string(),
  type: z.enum(['mcq', 'short']),
  question: z.string(),
  options: z.array(z.string()).length(4).optional().describe('Exactly four choices for MCQ items.'),
  correctIndex: z.number().min(0).max(3).optional().describe('Zero-based index of the correct MCQ option.'),
  modelAnswer: z.string().describe('Ideal answer / rubric for short answers; for MCQ, brief explanation of the correct choice.'),
});

export const ExamPracticeInputSchema = z.object({
  topic: z.string().max(500),
  retrievedContext: z
    .array(z.object({ text: z.string(), docName: z.string(), chunkIndex: z.number() }))
    .optional(),
  syllabus: z.string().max(65000).optional(),
  count: z.number().min(3).max(12).default(6),
  mcqShare: z.number().min(0).max(1).default(0.55).describe('Approximate fraction of items that should be MCQ.'),
});

export type ExamPracticeInput = z.infer<typeof ExamPracticeInputSchema>;

export const ExamPracticeOutputSchema = z.object({
  items: z.array(ExamItemSchema),
});

export type ExamPracticeOutput = z.infer<typeof ExamPracticeOutputSchema>;

export const ExamGradeInputSchema = z.object({
  question: z.string(),
  modelAnswer: z.string(),
  studentAnswer: z.string().max(8000),
});

export type ExamGradeInput = z.infer<typeof ExamGradeInputSchema>;

export const ExamGradeOutputSchema = z.object({
  isCorrect: z.boolean(),
  score: z.number().min(0).max(100),
  feedback: z.string(),
});

export type ExamGradeOutput = z.infer<typeof ExamGradeOutputSchema>;
