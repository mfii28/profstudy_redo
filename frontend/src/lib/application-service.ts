'use client';

import type { ContactInquiry, InstructorApplication } from './db';
import { apiFetch } from '@/lib/api-client';
import { z } from 'zod';

const ContactInquirySchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  subject: z.string().min(3),
  message: z.string().min(10),
});

const InstructorApplicationSchema = z.object({
  fullName: z.string().min(3),
  email: z.string().email(),
  phoneNumber: z.string().min(7).optional(),
  linkedinProfileUrl: z.string().url().optional(),
  portfolioUrl: z.string().url().optional(),
  teachingExperienceDescription: z.string().min(20),
  proposedCourseTopics: z.array(z.string()).min(1),
  motivationStatement: z.string().min(10),
});

/**
 * @fileOverview Standardized service for public form applications.
 * Routes through the Python backend REST API.
 */

/**
 * Submits a new contact inquiry.
 */
export const submitContactInquiry = async (inquiry: Omit<ContactInquiry, 'id' | 'status' | 'submittedAt'>): Promise<void> => {
  const parsed = ContactInquirySchema.safeParse(inquiry);
  if (!parsed.success) {
    const error = new Error('Invalid contact inquiry payload.');
    (error as any).details = parsed.error.errors;
    throw error;
  }

  const res = await apiFetch('/contact-inquiries', {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) throw new Error('Failed to submit contact inquiry');
};

/**
 * Submits a new instructor application.
 */
export const submitInstructorApplication = async (application: Omit<InstructorApplication, 'id' | 'status' | 'submittedAt'>): Promise<void> => {
  const parsed = InstructorApplicationSchema.safeParse(application);
  if (!parsed.success) {
    const error = new Error('Invalid instructor application payload.');
    (error as any).details = parsed.error.errors;
    throw error;
  }

  const res = await apiFetch('/instructor-applications', {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  if (!res.ok) throw new Error('Failed to submit instructor application');
};

// ---------------------------------------------------------------------------
// Admin reader functions
// ---------------------------------------------------------------------------

export const getContactInquiries = async (): Promise<ContactInquiry[]> => {
  try {
    const res = await apiFetch('/admin/contact-inquiries');
    if (!res.ok) return [];
    const data = await res.json();
    return data.inquiries || [];
  } catch (error) {
    console.error('[ApplicationService] Failed to fetch contact inquiries:', error);
    return [];
  }
};

export const updateContactInquiryStatus = async (
  id: string,
  status: ContactInquiry['status'],
  adminNotes?: string
): Promise<void> => {
  const res = await apiFetch(`/admin/contact-inquiries/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, adminNotes }),
  });
  if (!res.ok) throw new Error('Failed to update contact inquiry status');
};

export const getInstructorApplications = async (): Promise<InstructorApplication[]> => {
  try {
    const res = await apiFetch('/admin/instructor-applications');
    if (!res.ok) return [];
    const data = await res.json();
    return data.applications || [];
  } catch (error) {
    console.error('[ApplicationService] Failed to fetch instructor applications:', error);
    return [];
  }
};

export const updateInstructorApplicationStatus = async (
  id: string,
  status: InstructorApplication['status'],
  reviewerId: string,
  adminFeedback?: string
): Promise<void> => {
  const res = await apiFetch(`/admin/instructor-applications/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, reviewerId, adminFeedback }),
  });
  if (!res.ok) throw new Error('Failed to update application status');
};
