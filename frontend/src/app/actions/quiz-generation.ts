'use server';

import { apiFetchServer } from '@/lib/api-client.server';
import { logger } from '@/lib/logging';
import type { QuizQuestion } from '@/lib/db';

export async function generateQuizFromText(
    text: string,
    topic: string = '',
    questionCount: number = 5
): Promise<{ questions?: QuizQuestion[]; error?: string }> {
    if (!text.trim()) return { error: 'No content provided.' };
    
    try {
        const result = await apiFetchServer('/api/v1/ai/quiz', {
            method: 'POST',
            body: JSON.stringify({ text, topic, questionCount }),
        });
        
        return { questions: result.quiz };
    } catch (err: any) {
        logger.error('[Quiz AI] Text generation failed', { error: err.message });
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
        const result = await apiFetchServer('/api/v1/ai/quiz', {
            method: 'POST',
            body: JSON.stringify({ fileBase64: base64, mimeType, topic, questionCount }),
        });
        
        return { questions: result.quiz };
    } catch (err: any) {
        logger.error('[Quiz AI] File generation failed', { error: err.message });
        return { error: err.message || 'AI quiz generation from file failed.' };
    }
}
