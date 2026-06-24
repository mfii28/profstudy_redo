'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase-server';
import type { BlogPost } from '@/lib/db';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Authentication required');
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) {
    throw new Error('User profile not found');
  }
  const role = dbUser.role || 'student';
  const isAdmin = ['admin', 'superadmin', 'subadmin'].includes(role);
  if (!isAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }
  return dbUser;
}

export async function getBlogPostsAction(): Promise<BlogPost[]> {
  try {
    const posts = await prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return posts.map(post => ({
      ...post,
      tags: post.tags || [],
      status: post.status as 'Draft' | 'Published',
      publishedAt: post.publishedAt?.toISOString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt?.toISOString(),
    })) as BlogPost[];
  } catch (err) {
    console.error('[BlogAction] fetch error:', err);
    return [];
  }
}

export async function saveBlogPostAction(
  post: Omit<BlogPost, 'id'> & { id?: string }
): Promise<string> {
  const admin = await requireAdmin();

  const now = new Date();
  const slug = post.slug || post.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  if (post.id) {
    const existing = await prisma.blogPost.findUnique({ where: { id: post.id } });
    if (!existing) {
      throw new Error('Blog post not found');
    }
    await prisma.blogPost.update({
      where: { id: post.id },
      data: {
        title: post.title,
        slug,
        summary: post.summary,
        content: post.content,
        coverUrl: post.coverUrl || null,
        authorId: post.authorId || admin.id,
        authorName: post.authorName || admin.name || admin.email || 'Admin',
        category: post.category,
        tags: post.tags || [],
        status: post.status || 'Draft',
        publishedAt: post.status === 'Published' ? (existing.publishedAt || now) : null,
      },
    });
    return post.id;
  } else {
    const created = await prisma.blogPost.create({
      data: {
        title: post.title,
        slug,
        summary: post.summary,
        content: post.content,
        coverUrl: post.coverUrl || null,
        authorId: post.authorId || admin.id,
        authorName: post.authorName || admin.name || admin.email || 'Admin',
        category: post.category,
        tags: post.tags || [],
        status: post.status || 'Draft',
        publishedAt: post.status === 'Published' ? now : null,
      },
    });
    return created.id;
  }
}

export async function removeBlogPostAction(id: string): Promise<void> {
  await requireAdmin();

  await prisma.blogPost.delete({
    where: { id },
  });
}
