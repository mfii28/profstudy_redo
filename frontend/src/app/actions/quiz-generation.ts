'use server';

import { generateQuiz } from '@/ai/flows/dynamic-quiz-generation-flow';
import { ai } from '@/ai/genkit';
import type { QuizQuestion } from '@/lib/db';
import { z } from 'genkit';

export async function generateQuizFromText(
    text: string,
    topic: string = '',
    questionCount: number = 5
): Promise<{ questions?: QuizQuestion[]; error?: string }> {
    if (!text.trim()) return { error: 'No content provided.' };
    try {
        const result = await generateQuiz({
            topic: topic || 'General',
            lessonContent: text,
            numberOfQuestions: Math.min(Math.max(1, questionCount), 20),
            difficulty: 'Medium',
        });
        return { questions: result.quiz };
    } catch (err: any) {
        return { error: err.message || 'AI quiz generation failed.' };
    }
}

export async function generateQuizFromFile(
    base64: string,
    mimeType: 'application/pdf' | 'text/plain',
    topic: string = '',
    questionCount: number = 5
): Promise<{ questions?: QuizQuestion[]; error?: string }> {
    if (!base64) return { error: 'No file content provided.' };

    try {
        if (mimeType === 'text/plain') {
            const text = Buffer.from(base64, 'base64').toString('utf-8');
            return generateQuizFromText(text, topic, questionCount);
        }

        const count = Math.min(Math.max(1, questionCount), 20);
        const { output } = await ai.generate({
            prompt: [
                {
                    media: {
                        url: `data:${mimeType};base64,${base64}`,
                    },
                },
                {
                    text: `You are an expert quiz creator. Extract information from this document and generate ${count} multiple-choice quiz questions${topic ? ` about "${topic}"` : ''}.
Each question must have 2 to 5 answer options and exactly one correct answer.
Return valid JSON matching this schema:
{
  "quiz": [
    {
      "questionText": "string",
      "options": ["string", "string", ...],
      "correctAnswerIndex": number,
      "explanation": "string"
    }
  ]
}`,
                },
            ],
            output: {
                schema: z.object({
                    quiz: z.array(
                        z.object({
                            questionText: z.string(),
                            options: z.array(z.string()).min(2).max(5),
                            correctAnswerIndex: z.number().int(),
                            explanation: z.string().optional(),
                        })
                    ),
                }),
            },
        });

        if (!output?.quiz) return { error: 'AI returned an empty quiz.' };
        return { questions: output.quiz };
    } catch (err: any) {
        return { error: err.message || 'AI quiz generation from file failed.' };
    }
}
