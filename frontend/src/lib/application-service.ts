'use client';

import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { ContactInquiry, InstructorApplication } from './db';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
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
 */

/**
 * Submits a new contact inquiry to Firestore.
 */
export const submitContactInquiry = async (inquiry: Omit<ContactInquiry, 'id' | 'status' | 'submittedAt'>): Promise<void> => {
  if (!db) return;

  const parsed = ContactInquirySchema.safeParse(inquiry);
  if (!parsed.success) {
    const error = new Error('Invalid contact inquiry payload.');
    (error as any).details = parsed.error.errors;
    throw error;
  }

  const inquiryId = `inq-${Date.now()}`;
  const docRef = doc(db, 'contactInquiries', inquiryId);
  
  const data: ContactInquiry = {
    ...parsed.data,
    id: inquiryId,
    status: 'Pending',
    submittedAt: new Date().toISOString()
  };

  try {
    await setDoc(docRef, data);
  } catch (error) {
    console.error("[ApplicationService] Contact submission failed:", error);
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'create',
      requestResourceData: data,
    } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
};

/**
 * Submits a new instructor application to Firestore.
 */
export const submitInstructorApplication = async (application: Omit<InstructorApplication, 'id' | 'status' | 'submittedAt'>): Promise<void> => {
  if (!db) return;

  const parsed = InstructorApplicationSchema.safeParse(application);
  if (!parsed.success) {
    const error = new Error('Invalid instructor application payload.');
    (error as any).details = parsed.error.errors;
    throw error;
  }

  const appId = `app-${Date.now()}`;
  const docRef = doc(db, 'instructorApplications', appId);
  
  const data: InstructorApplication = {
    ...parsed.data,
    id: appId,
    status: 'Pending',
    submittedAt: new Date().toISOString(),
    reviewerId: undefined,
    reviewedAt: undefined,
    adminFeedback: undefined,
  };

  try {
    await setDoc(docRef, data);
  } catch (error) {
    console.error("[ApplicationService] Instructor submission failed:", error);
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'create',
      requestResourceData: data,
    } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Admin reader functions (require admin role — enforced by Firestore rules)
// ---------------------------------------------------------------------------

export const getContactInquiries = async (): Promise<ContactInquiry[]> => {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, 'contactInquiries'), orderBy('submittedAt', 'desc')));
    return snap.docs.map(d => d.data() as ContactInquiry);
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
  if (!db) return;
  const ref = doc(db, 'contactInquiries', id);
  const updates: Record<string, any> = { status };
  if (adminNotes !== undefined) updates.adminNotes = adminNotes;
  if (status === 'Resolved') updates.resolvedAt = new Date().toISOString();
  await updateDoc(ref, updates);
};

export const getInstructorApplications = async (): Promise<InstructorApplication[]> => {
  if (!db) return [];
  try {
    const snap = await getDocs(query(collection(db, 'instructorApplications'), orderBy('submittedAt', 'desc')));
    return snap.docs.map(d => d.data() as InstructorApplication);
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
  if (!db) return;
  const ref = doc(db, 'instructorApplications', id);

  const applicationSnap = await getDoc(ref);
  const applicationData = applicationSnap.exists() ? (applicationSnap.data() as InstructorApplication) : null;

  await updateDoc(ref, {
    status,
    reviewerId,
    reviewedAt: new Date().toISOString(),
    ...(adminFeedback !== undefined ? { adminFeedback } : {}),
  });

  // Keep tutor verification workflow and application workflow in sync on approval.
  if (status === 'Approved' && applicationData) {
    if (applicationData.applicantId) {
      await updateDoc(doc(db, 'users', applicationData.applicantId), {
        role: 'tutor',
        'tutorDetails.verificationStatus': 'verified',
      });
      return;
    }

    const byEmailSnap = await getDocs(
      query(collection(db, 'users'), where('email', '==', applicationData.email))
    );
    if (!byEmailSnap.empty) {
      await updateDoc(byEmailSnap.docs[0].ref, {
        role: 'tutor',
        'tutorDetails.verificationStatus': 'verified',
      });
    }
  }
};
