'use server';

import { apiFetchServer } from '@/lib/api-client.server';

export async function getTestimonialsAction(count: number = 6, group?: string): Promise<any[]> {
  try {
    const url = new URLSearchParams();
    url.append('limit', count.toString());
    if (group) url.append('group', group);
    
    const res = await apiFetchServer(`/testimonials/?${url.toString()}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('[ContentActions] getTestimonials error:', err);
    return [];
  }
}

export async function getAllTestimonialsAction(): Promise<any[]> {
  try {
    const res = await apiFetchServer(`/testimonials/all`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('[ContentActions] getAllTestimonials error:', err);
    return [];
  }
}

export async function getPendingTestimonialsAction(): Promise<any[]> {
  try {
    const res = await apiFetchServer(`/testimonials/pending`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('[ContentActions] getPendingTestimonials error:', err);
    return [];
  }
}

export async function saveTestimonialAction(testimonial: any): Promise<void> {
  const res = await apiFetchServer(`/testimonials/`, {
    method: 'POST',
    body: JSON.stringify({
      ...testimonial,
      source: 'admin',
    }),
  });
  
  if (!res.ok) {
    throw new Error('Failed to save testimonial');
  }
}

export async function updateTestimonialStatusAction(
  testimonialId: string,
  status: string,
  reviewedBy: string
): Promise<void> {
  const res = await apiFetchServer(`/testimonials/${testimonialId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  
  if (!res.ok) {
    throw new Error('Failed to update testimonial status');
  }
}

export async function deleteTestimonialAction(testimonialId: string): Promise<void> {
  const res = await apiFetchServer(`/testimonials/${testimonialId}`, {
    method: 'DELETE',
  });
  
  if (!res.ok) {
    throw new Error('Failed to delete testimonial');
  }
}
