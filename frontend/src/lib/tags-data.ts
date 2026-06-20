'use client';

import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { Tag } from './db';

export const getTags = async (): Promise<Tag[]> => {
  if (!db) return [];
  try {
    const q = query(collection(db, 'tags'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Tag));
  } catch (err) {
    console.error('[TagsData] fetch error:', err);
    return [];
  }
};

export const saveTag = async (tag: Omit<Tag, 'id'> & { id?: string }): Promise<string> => {
  if (!db) throw new Error('Database unavailable');
  const now = new Date().toISOString();
  if (tag.id) {
    const { id, ...data } = tag;
    await updateDoc(doc(db, 'tags', id), data);
    return id;
  }
  const ref = await addDoc(collection(db, 'tags'), { ...tag, createdAt: now });
  return ref.id;
};

export const removeTag = async (id: string): Promise<void> => {
  if (!db) throw new Error('Database unavailable');
  await deleteDoc(doc(db, 'tags', id));
};

export const toSlug = (name: string): string =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
