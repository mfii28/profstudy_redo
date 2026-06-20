'use server';

import { ai } from '@/ai/genkit';
import {
  ExamPracticeInputSchema,
  type ExamPracticeInput,
  ExamPracticeOutputSchema,
  type ExamPracticeOutput,
  ExamGradeInputSchema,
  type ExamGradeInput,
  ExamGradeOutputSchema,
  type ExamGradeOutput,
} from '@/ai/schemas/exam-practice';

export async function generateExamPractice(input: ExamPracticeInput): Promise<ExamPracticeOutput> {
  return examPracticeFlow(input);
}

export async function gradeShortAnswer(input: ExamGradeInput): Promise<ExamGradeOutput> {
  return examGradeFlow(input);
}

const examPrompt = ai.definePrompt({
  name: 'examPracticePrompt',
  input: { schema: ExamPracticeInputSchema },
  output: { schema: ExamPracticeOutputSchema },
  prompt: `You are an ICAG/CITG exam author. Build {{count}} practice questions for the topic "{{topic}}".

Rules:
- Use ONLY the source material and syllabus below — do not invent facts.
- Mix item types: about half of the items should be type "mcq" and the rest type "short".
- MCQ: exactly 4 options in "options", set "correctIndex" 0–3, and "modelAnswer" as a one-line explanation of why that option is correct.
- Short: omit options and correctIndex; "modelAnswer" must be a concise ideal answer (2–5 sentences) suitable for automated grading hints.
- Each item needs a unique string "id" (e.g. q1, q2, …).

### SOURCE MATERIAL
{{#if retrievedContext}}
{{#each retrievedContext}}
--- [{{docName}}, chunk {{chunkIndex}}] ---
{{{text}}}

{{/each}}
{{else}}
{{{syllabus}}}
{{/if}}

Return JSON matching the schema.
`,
});

const examPracticeFlow = ai.defineFlow(
  {
    name: 'examPracticeFlow',
    inputSchema: ExamPracticeInputSchema,
    outputSchema: ExamPracticeOutputSchema,
  },
  async (input: ExamPracticeInput) => {
    const { output } = await examPrompt(input);
    return output!;
  },
);

const gradePrompt = ai.definePrompt({
  name: 'examGradePrompt',
  input: { schema: ExamGradeInputSchema },
  output: { schema: ExamGradeOutputSchema },
  prompt: `You grade a student's free-text answer against a model answer for a professional course.

Question:
{{{question}}}

Model answer (rubric):
{{{modelAnswer}}}

Student answer:
{{{studentAnswer}}}

Decide if the student is substantially correct (may use different wording but same ideas).
- isCorrect: true if you would accept it on an exam; false otherwise.
- score: 0–100 numeric score.
- feedback: 2–4 sentences: what was right/wrong, and one concrete improvement tip.
`,
});

const examGradeFlow = ai.defineFlow(
  {
    name: 'examGradeFlow',
    inputSchema: ExamGradeInputSchema,
    outputSchema: ExamGradeOutputSchema,
  },
  async (input: ExamGradeInput) => {
    const { output } = await gradePrompt(input);
    return output!;
  },
);
