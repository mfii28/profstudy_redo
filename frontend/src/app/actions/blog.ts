'use server';

import type { BlogPost } from '@/lib/db';
import { apiFetchServer } from '@/lib/api-client.server';

export async function getBlogPostsAction(): Promise<BlogPost[]> {
  try {
    const res = await apiFetchServer('/blog/');
    if (!res.ok) return [];
    return (await res.json()) as BlogPost[];
  } catch (err) {
    console.error('[BlogAction] fetch error:', err);
    return [];
  }
}

export async function saveBlogPostAction(
  post: Omit<BlogPost, 'id'> & { id?: string }
): Promise<string> {
  const res = await apiFetchServer('/blog/', {
    method: 'POST',
    body: JSON.stringify(post),
  });
  
  if (!res.ok) {
    throw new Error('Failed to save blog post');
  }
  
  const data = await res.json();
  return data.id;
}

export async function removeBlogPostAction(id: string): Promise<void> {
  const res = await apiFetchServer(`/blog/${id}`, {
    method: 'DELETE',
  });
  
  if (!res.ok) {
    throw new Error('Failed to delete blog post');
  }
}
