'use server';

import { collection, getDocs, query, where, doc, setDoc } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { Assignment } from '@/lib/db';

/**
 * @fileOverview Data service for course assignments.
 */

export async function getAssignments(): Promise<Assignment[]> {
    if (!db) return [];
    try {
        const assignmentsCollection = collection(db, 'assignments');
        const snapshot = await getDocs(assignmentsCollection);
        return snapshot.docs.map(doc => ({ ...doc.data() as Assignment, id: doc.id }));
    } catch (error) {
        console.error("Error fetching assignments:", error);
        return [];
    }
}

export async function getAssignmentsByUserId(userId: string): Promise<Assignment[]> {
    if (!db || !userId) return [];
    try {
        const assignmentsCollection = collection(db, 'assignments');
        const q = query(assignmentsCollection, where("userId", "==", userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data() as Assignment, id: doc.id }));
    } catch (error) {
        console.error("Error fetching user assignments:", error);
        return [];
    }
}

export async function saveAssignment(assignment: Assignment): Promise<void> {
  if (!db) return;
  const docRef = doc(db, 'assignments', assignment.id);
  await setDoc(docRef, assignment, { merge: true });
}
