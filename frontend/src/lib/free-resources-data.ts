'use client';

import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { FreeResource } from './db';

export const getFreeResources = async (): Promise<FreeResource[]> => {
  if (!db) return [];
  try {
    const q = query(collection(db, 'freeResources'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as FreeResource));
  } catch (err) {
    console.error('[FreeResourcesData] fetch error:', err);
    return [];
  }
};

export const saveFreeResource = async (resource: Omit<FreeResource, 'id'> & { id?: string }): Promise<string> => {
  if (!db) throw new Error('Database unavailable');
  const now = new Date().toISOString();
  if (resource.id) {
    const { id, ...data } = resource;
    await updateDoc(doc(db, 'freeResources', id), { ...data, updatedAt: now });
    return id;
  }
  const ref = await addDoc(collection(db, 'freeResources'), { ...resource, createdAt: now, updatedAt: now });
  return ref.id;
};

export const removeFreeResource = async (id: string): Promise<void> => {
  if (!db) throw new Error('Database unavailable');
  await deleteDoc(doc(db, 'freeResources', id));
};
