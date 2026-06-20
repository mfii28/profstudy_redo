
'use client';

import { collection, getDocs, addDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { Testimonial, TestimonialGroup, TestimonialStatus } from '@/lib/db';

export type TestimonialDocument = Testimonial & { id: string };
export type TestimonialPayload = Omit<Testimonial, 'id'>;

function isApproved(testimonial: Testimonial): boolean {
  return !testimonial.status || testimonial.status === 'approved';
}

function matchesGroup(testimonial: Testimonial, group?: TestimonialGroup): boolean {
  if (!group || group === 'general') return true;
  return (testimonial.group ?? 'general') === group;
}

export const getTestimonials = async (count: number = 6, group?: TestimonialGroup): Promise<TestimonialDocument[]> => {
    if (!db) return [];
    const testimonialsCol = collection(db, 'testimonials');
    const snapshot = await getDocs(testimonialsCol);
    return snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Testimonial) }))
        .filter((t) => isApproved(t) && matchesGroup(t, group))
        .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
        .slice(0, count);
};

export const getAllTestimonials = async (): Promise<TestimonialDocument[]> => {
    if (!db) return [];
    const testimonialsCol = collection(db, 'testimonials');
    const snapshot = await getDocs(testimonialsCol);
    return snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Testimonial) }))
        .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
};

export const getPendingTestimonials = async (): Promise<TestimonialDocument[]> => {
    if (!db) return [];
    const snapshot = await getDocs(collection(db, 'testimonials'));
    return snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Testimonial) }))
        .filter((t) => t.status === 'pending')
        .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
};

export const saveTestimonial = async (testimonial: TestimonialDocument): Promise<void> => {
    if (!db) return;
    const testimonialsCol = collection(db, 'testimonials');
    const now = new Date().toISOString();
    const data: Testimonial = {
        name: testimonial.name,
        role: testimonial.role,
        avatar: testimonial.avatar,
        text: testimonial.text,
        status: testimonial.status ?? 'approved',
        group: testimonial.group ?? 'general',
        submittedBy: testimonial.submittedBy,
        submittedAt: testimonial.submittedAt ?? now,
        reviewedAt: testimonial.reviewedAt,
        reviewedBy: testimonial.reviewedBy,
        source: testimonial.source ?? 'admin',
    };

    if (testimonial.id) {
        await setDoc(doc(testimonialsCol, testimonial.id), { ...data, updatedAt: now }, { merge: true });
        return;
    }

    await addDoc(testimonialsCol, data);
};

export const updateTestimonialStatus = async (
    testimonialId: string,
    status: TestimonialStatus,
    reviewedBy: string,
): Promise<void> => {
    if (!db) return;
    await setDoc(
        doc(db, 'testimonials', testimonialId),
        {
            status,
            reviewedAt: new Date().toISOString(),
            reviewedBy,
        },
        { merge: true },
    );
};

export const deleteTestimonial = async (testimonialId: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, 'testimonials', testimonialId));
};

export const TESTIMONIAL_GROUPS: { value: import('@/lib/db').TestimonialGroup; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'icag', label: 'ICAG' },
  { value: 'citg', label: 'CITG' },
  { value: 'events', label: 'Events' },
];
