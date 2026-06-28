'use client';

/**
 * @fileOverview Data service for gallery items.
 * Routes through the Python backend REST API.
 */

import { apiFetch } from '@/lib/api-client';
import type { GalleryGroup } from '@/lib/db';

export type GalleryItemDocument = {
  id: string;
  title: string;
  caption: string;
  imageUrl?: string;
  mediaUrl?: string;
  mediaType?: string;
  status?: string;
  group?: GalleryGroup;
  sortOrder?: number;
  createdAt?: string;
};

export const GALLERY_GROUPS: { value: GalleryGroup; label: string }[] = [];

export const getAllGalleryItems = async (): Promise<GalleryItemDocument[]> => {
  try {
    const res = await apiFetch('/gallery');
    if (!res.ok) return [];
    const data = await res.json();
    return data.items || [];
  } catch {
    return [];
  }
};

export const saveGalleryItem = async (item: GalleryItemDocument): Promise<void> => {
  await apiFetch('/gallery', {
    method: 'POST',
    body: JSON.stringify(item),
  });
};

export const getPublishedGalleryItems = async (group?: GalleryGroup): Promise<GalleryItemDocument[]> => {
  try {
    const params = group ? `?group=${encodeURIComponent(group)}` : '';
    const res = await apiFetch(`/gallery${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).filter((item: GalleryItemDocument) => item.status === 'published');
  } catch {
    return [];
  }
};

export const deleteGalleryItem = async (id: string): Promise<void> => {
  await apiFetch(`/gallery/${id}`, { method: 'DELETE' });
};

