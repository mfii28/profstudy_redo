'use client';

import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { BlogPost } from './db';

export const getBlogPosts = async (): Promise<BlogPost[]> => {
  if (!db) return [];
  try {
    const q = query(collection(db, 'blogPosts'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as BlogPost));
  } catch (err) {
    console.error('[BlogData] fetch error:', err);
    return [];
  }
};

export const saveBlogPost = async (post: Omit<BlogPost, 'id'> & { id?: string }): Promise<string> => {
  if (!db) throw new Error('Database unavailable');
  const now = new Date().toISOString();
  const stripUndefined = <T extends Record<string, any>>(value: T): Partial<T> => {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
  };
  if (post.id) {
    const { id, ...data } = post;
    await updateDoc(doc(db, 'blogPosts', id), stripUndefined({ ...data, updatedAt: now }));
    return id;
  }
  const ref = await addDoc(collection(db, 'blogPosts'), stripUndefined({ ...post, createdAt: now, updatedAt: now }));
  return ref.id;
};

export const removeBlogPost = async (id: string): Promise<void> => {
  if (!db) throw new Error('Database unavailable');
  await deleteDoc(doc(db, 'blogPosts', id));
};
