import {
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    doc,
    updateDoc,
} from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { PayoutRequest, PayoutRequestStatus } from '@/lib/db';

const COLLECTION = 'payoutRequests';

export async function submitPayoutRequest(
    data: Omit<PayoutRequest, 'id' | 'status' | 'submittedAt'>
): Promise<string> {
    if (!db) throw new Error('Firestore not initialized');
    const docRef = await addDoc(collection(db, COLLECTION), {
        ...data,
        status: 'pending' as PayoutRequestStatus,
        submittedAt: new Date().toISOString(),
    });
    return docRef.id;
}

export async function getPayoutRequestsByTutor(tutorId: string): Promise<PayoutRequest[]> {
    if (!db) return [];
    const q = query(
        collection(db, COLLECTION),
        where('tutorId', '==', tutorId),
        orderBy('submittedAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PayoutRequest));
}

export async function getAllPayoutRequests(): Promise<PayoutRequest[]> {
    if (!db) return [];
    const q = query(collection(db, COLLECTION), orderBy('submittedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PayoutRequest));
}

export async function updatePayoutRequestStatus(
    requestId: string,
    status: PayoutRequestStatus,
    adminNote?: string
): Promise<void> {
    if (!db) throw new Error('Firestore not initialized');
    const docRef = doc(db, COLLECTION, requestId);
    await updateDoc(docRef, {
        status,
        reviewedAt: new Date().toISOString(),
        ...(adminNote ? { adminNote } : {}),
    });
}
