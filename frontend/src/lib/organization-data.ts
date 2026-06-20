'use client';

import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { Organization } from './db';

/**
 * @fileOverview Data service for Institutional/B2B Partners.
 */

const COLLECTION_NAME = 'organizations';

export const getOrganizations = async (): Promise<Organization[]> => {
    if (!db) return [];
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));
};

export const saveOrganization = async (org: Organization): Promise<void> => {
    if (!db) return;
    await setDoc(doc(db, COLLECTION_NAME, org.id), org, { merge: true });
};

export const deleteOrganization = async (id: string): Promise<void> => {
    if (!db) return;
    await deleteDoc(doc(db, COLLECTION_NAME, id));
};

export const updateOrganizationStatus = async (id: string, status: Organization['status']): Promise<void> => {
    if (!db) return;
    await updateDoc(doc(db, COLLECTION_NAME, id), { status });
};
