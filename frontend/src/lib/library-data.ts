
'use client';

import { collection, getDocs, doc, setDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { LibraryAsset } from './db';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * @fileOverview Data service for Tutor Content Library assets.
 */

const COLLECTION_NAME = 'libraryAssets';

export const getLibraryAssets = async (tutorId: string): Promise<LibraryAsset[]> => {
  if (!db || !tutorId) return [];
  try {
    const assetsCollection = collection(db, COLLECTION_NAME);
    const q = query(
      assetsCollection,
      where('tutorId', '==', tutorId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LibraryAsset));
  } catch (error) {
    console.error('[LibraryData] Fetch Error:', error);
    return [];
  }
};

export const saveLibraryAsset = async (asset: LibraryAsset): Promise<void> => {
  if (!db) {
    throw new Error('Firestore not initialized');
  }
  const docRef = doc(db, COLLECTION_NAME, asset.id);

  try {
    await setDoc(docRef, asset, { merge: true });
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'write',
      requestResourceData: asset,
    } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
};

export const deleteLibraryAsset = async (assetId: string): Promise<void> => {
  if (!db) {
    throw new Error('Firestore not initialized');
  }
  const docRef = doc(db, COLLECTION_NAME, assetId);

  try {
    await deleteDoc(docRef);
  } catch (error) {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'delete',
    } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw error;
  }
};
