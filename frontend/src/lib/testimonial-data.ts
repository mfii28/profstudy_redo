'use client';

import {
  getTestimonialsAction,
  getAllTestimonialsAction,
  getPendingTestimonialsAction,
  saveTestimonialAction,
  updateTestimonialStatusAction,
  deleteTestimonialAction,
} from '@/app/actions/content-actions';
import type { Testimonial, TestimonialGroup, TestimonialStatus } from '@/lib/db';

export type TestimonialDocument = Testimonial & { id: string };
export type TestimonialPayload = Omit<Testimonial, 'id'>;

export const getTestimonials = async (count: number = 6, group?: TestimonialGroup): Promise<TestimonialDocument[]> => {
  return getTestimonialsAction(count, group);
};

export const getAllTestimonials = async (): Promise<TestimonialDocument[]> => {
  return getAllTestimonialsAction();
};

export const getPendingTestimonials = async (): Promise<TestimonialDocument[]> => {
  return getPendingTestimonialsAction();
};

export const saveTestimonial = async (testimonial: TestimonialDocument): Promise<void> => {
  return saveTestimonialAction(testimonial);
};

export const updateTestimonialStatus = async (
  testimonialId: string,
  status: TestimonialStatus,
  reviewedBy: string,
): Promise<void> => {
  return updateTestimonialStatusAction(testimonialId, status, reviewedBy);
};

export const deleteTestimonial = async (testimonialId: string): Promise<void> => {
  return deleteTestimonialAction(testimonialId);
};

export const TESTIMONIAL_GROUPS: { value: import('@/lib/db').TestimonialGroup; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'icag', label: 'ICAG' },
  { value: 'citg', label: 'CITG' },
  { value: 'events', label: 'Events' },
];

