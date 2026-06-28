'use client';

import { apiFetch } from '@/lib/api-client';
import type { Tag } from './db';

export const getTags = async (): Promise<Tag[]> => {
  try {
    const res = await apiFetch('/admin/tags');
    if (!res.ok) return [];
    const data = await res.json();
    return data.tags || [];
  } catch (err) {
    console.error('[TagsData] fetch error:', err);
    return [];
  }
};

export const saveTag = async (tag: Omit<Tag, 'id'> & { id?: string }): Promise<string> => {
  if (tag.id) {
    const res = await apiFetch(`/admin/tags/${tag.id}`, {
      method: 'PUT',
      body: JSON.stringify(tag),
    });
    if (!res.ok) throw new Error('Failed to update tag');
    return tag.id;
  }
  const res = await apiFetch('/admin/tags', {
    method: 'POST',
    body: JSON.stringify(tag),
  });
  if (!res.ok) throw new Error('Failed to create tag');
  const data = await res.json();
  return data.id;
};

export const removeTag = async (id: string): Promise<void> => {
  const res = await apiFetch(`/admin/tags/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete tag');
};

export const toSlug = (name: string): string =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
