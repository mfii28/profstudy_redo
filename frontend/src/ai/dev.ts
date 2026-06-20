'use server';
import { config } from 'dotenv';
config();

import '@/ai/flows/ai-tutor-chat.ts';
import '@/ai/flows/customer-support-chat.ts';
import '@/ai/flows/dynamic-quiz-generation-flow.ts';
import '@/ai/flows/lesson-content-summarization.ts';
import '@/ai/flows/personalized-study-plan-generation.ts';
import '@/ai/flows/course-description-generation.ts';
import '@/ai/flows/syllabus-generation.ts';
import '@/ai/flows/flashcard-generation.ts';
import '@/ai/flows/financial-analysis.ts';
import '@/ai/flows/announcement-generator.ts';
import '@/ai/flows/social-promotion-generation.ts';
import '@/ai/flows/note-intelligence.ts';
