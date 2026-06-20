'use server';

import { adminAuth, adminDb } from '@/firebase/admin';
import { z } from 'zod';
import { logger } from '@/lib/logging';
import type { TestimonialGroup } from '@/lib/db';

const submitSchema = z.object({
  name: z.string().min(2).max(120),
  role: z.string().min(2).max(120),
  text: z.string().min(20).max(2000),
  group: z.enum(['general', 'icag', 'citg', 'events']).optional(),
});

export async function submitUserTestimonial(
  payload: {
    name: string;
    role: string;
    text: string;
    group?: TestimonialGroup;
  },
  idToken: string,
) {
  try {
    const parsed = submitSchema.safeParse(payload);
    if (!parsed.success) {
      return { error: 'Please fill in all fields. Your story should be at least 20 characters.' };
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const now = new Date().toISOString();

    await adminDb.collection('testimonials').add({
      name: parsed.data.name,
      role: parsed.data.role,
      text: parsed.data.text,
      avatar: '',
      status: 'pending',
      group: parsed.data.group ?? 'general',
      source: 'user',
      submittedBy: decoded.uid,
      submittedAt: now,
    });

    logger.info('[Testimonials] User submission received', { uid: decoded.uid });
    return { success: true as const };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err?.code === 'auth/id-token-expired' || err?.code === 'auth/argument-error') {
      return { error: 'Your session has expired. Please sign in again.' };
    }
    logger.error('[Testimonials] Submit failed', { message: err?.message });
    return { error: 'Could not submit your testimonial. Please try again.' };
  }
}
