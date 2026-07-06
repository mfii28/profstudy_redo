'use server';

import { z } from 'zod';
import { logger } from '@/lib/logging';
import type { TestimonialGroup } from '@/lib/db';
import { apiFetchServer } from '@/lib/api-client.server';

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

    const res = await apiFetchServer('/testimonials/', {
      method: 'POST',
      body: JSON.stringify({
        ...parsed.data,
        source: 'user',
        status: 'pending',
      }),
      // We pass the idToken just in case the backend requires explicit verification, 
      // but apiFetchServer also passes the __session cookie automatically.
      headers: {
        'Authorization': `Bearer ${idToken}`,
      }
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Backend error: ${res.status} ${errBody}`);
    }

    logger.info('[Testimonials] User submission received');
    return { success: true as const };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    logger.error('[Testimonials] Submit failed', { message: err?.message });
    return { error: 'Could not submit your testimonial. Please try again.' };
  }
}

