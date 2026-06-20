
'use client';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { GalleryGroup, GalleryItem, GalleryItemStatus } from '@/lib/db';

export type GalleryItemDocument = GalleryItem & { id: string };

function isPublished(item: GalleryItem): boolean {
  return item.status === 'published';
}

function matchesGroup(item: GalleryItem, group?: GalleryGroup): boolean {
  if (!group || group === 'general') return true;
  return item.group === group;
}

export const getPublishedGalleryItems = async (group?: GalleryGroup): Promise<GalleryItemDocument[]> => {
  if (!db) return [];
  const q = query(collection(db, 'galleryItems'), orderBy('sortOrder', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...(d.data() as GalleryItem) }))
    .filter((item) => isPublished(item) && matchesGroup(item, group))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
};

export const getAllGalleryItems = async (): Promise<GalleryItemDocument[]> => {
  if (!db) return [];
  const q = query(collection(db, 'galleryItems'), orderBy('sortOrder', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...(d.data() as GalleryItem) }))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
};

export const saveGalleryItem = async (item: GalleryItemDocument): Promise<void> => {
  if (!db) return;
  const now = new Date().toISOString();
  const data: GalleryItem = {
    title: item.title,
    caption: item.caption,
    mediaUrl: item.mediaUrl,
    mediaType: item.mediaType,
    group: item.group,
    status: item.status,
    sortOrder: item.sortOrder ?? 0,
    createdAt: item.createdAt || now,
    updatedAt: now,
  };

  if (item.id) {
    await setDoc(doc(db, 'galleryItems', item.id), data, { merge: true });
    return;
  }

  await addDoc(collection(db, 'galleryItems'), data);
};

export const deleteGalleryItem = async (itemId: string): Promise<void> => {
  if (!db) return;
  await deleteDoc(doc(db, 'galleryItems', itemId));
};

export const GALLERY_GROUPS: { value: GalleryGroup; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'icag', label: 'ICAG' },
  { value: 'citg', label: 'CITG' },
  { value: 'events', label: 'Events' },
  { value: 'graduation', label: 'Graduation' },
];
