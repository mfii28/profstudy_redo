'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase-server';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Authentication required');
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  const role = dbUser?.role || 'student';
  const isAdmin = ['admin', 'superadmin', 'subadmin'].includes(role);
  if (!isAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }
  return dbUser;
}

export async function getTestimonialsAction(count: number = 6, group?: string): Promise<any[]> {
  try {
    const whereClause: any = {
      status: 'approved',
    };
    if (group && group !== 'general') {
      whereClause.group = group;
    }
    const testimonials = await prisma.testimonial.findMany({
      where: whereClause,
      orderBy: { submittedAt: 'desc' },
      take: count,
    });
    return testimonials.map(t => ({
      ...t,
      submittedAt: t.submittedAt.toISOString(),
      reviewedAt: t.reviewedAt?.toISOString(),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  } catch (err) {
    console.error('[ContentActions] getTestimonials error:', err);
    return [];
  }
}

export async function getAllTestimonialsAction(): Promise<any[]> {
  try {
    const testimonials = await prisma.testimonial.findMany({
      orderBy: { submittedAt: 'desc' },
    });
    return testimonials.map(t => ({
      ...t,
      submittedAt: t.submittedAt.toISOString(),
      reviewedAt: t.reviewedAt?.toISOString(),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  } catch (err) {
    console.error('[ContentActions] getAllTestimonials error:', err);
    return [];
  }
}

export async function getPendingTestimonialsAction(): Promise<any[]> {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { status: 'pending' },
      orderBy: { submittedAt: 'desc' },
    });
    return testimonials.map(t => ({
      ...t,
      submittedAt: t.submittedAt.toISOString(),
      reviewedAt: t.reviewedAt?.toISOString(),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  } catch (err) {
    console.error('[ContentActions] getPendingTestimonials error:', err);
    return [];
  }
}

export async function saveTestimonialAction(testimonial: any): Promise<void> {
  await requireAdmin();

  const now = new Date();
  const data = {
    name: testimonial.name,
    role: testimonial.role,
    avatar: testimonial.avatar || '',
    text: testimonial.text,
    status: testimonial.status || 'approved',
    group: testimonial.group || 'general',
    submittedBy: testimonial.submittedBy || null,
    submittedAt: testimonial.submittedAt ? new Date(testimonial.submittedAt) : now,
    reviewedAt: testimonial.reviewedAt ? new Date(testimonial.reviewedAt) : null,
    reviewedBy: testimonial.reviewedBy || null,
    source: testimonial.source || 'admin',
  };

  if (testimonial.id) {
    await prisma.testimonial.update({
      where: { id: testimonial.id },
      data,
    });
  } else {
    await prisma.testimonial.create({
      data,
    });
  }
}

export async function updateTestimonialStatusAction(
  testimonialId: string,
  status: string,
  reviewedBy: string
): Promise<void> {
  await requireAdmin();

  await prisma.testimonial.update({
    where: { id: testimonialId },
    data: {
      status,
      reviewedAt: new Date(),
      reviewedBy,
    },
  });
}

export async function deleteTestimonialAction(testimonialId: string): Promise<void> {
  await requireAdmin();

  await prisma.testimonial.delete({
    where: { id: testimonialId },
  });
}
