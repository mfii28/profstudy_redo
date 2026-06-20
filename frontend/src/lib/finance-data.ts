'use client';

import { collection, getDocs, writeBatch, doc, setDoc, query, where, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { Payout, SubscriptionPlan, Order, BillingHistory, OrderStatus } from '@/lib/db';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * @fileOverview Data service for platform financials and commerce.
 */

const getCollectionData = async <T>(collectionName: string): Promise<T[]> => {
    if (!db) return [];
    try {
        const dataCollection = collection(db, collectionName);
        const snapshot = await getDocs(dataCollection);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    } catch (error) {
        console.error(`Error fetching ${collectionName}:`, error);
        return [];
    }
};

const normalizeBillingHistoryRecord = (record: BillingHistory): BillingHistory => {
    const numericAmount = typeof record.amount === 'number'
        ? record.amount
        : parseFloat(String(record.amount).replace(/[^0-9.]/g, ''));

    return {
        ...record,
        amount: Number.isFinite(numericAmount) ? numericAmount : record.amount,
    };
};

export const getPayouts = async (): Promise<Payout[]> => getCollectionData<Payout>('payouts');

export const getPayoutsByTutorId = async (tutorId: string): Promise<Payout[]> => {
    if (!db || !tutorId) return [];
    try {
        const payoutsCollection = collection(db, 'payouts');
        const payoutsQuery = query(payoutsCollection, where('tutorId', '==', tutorId));
        const snapshot = await getDocs(payoutsQuery);
        return snapshot.docs
            .map((payoutDoc) => ({ id: payoutDoc.id, ...payoutDoc.data() } as Payout))
            .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
    } catch (error) {
        console.error('Error fetching tutor payouts:', error);
        return [];
    }
};

export const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
    if (!db) return [];
    try {
        const plans = await getCollectionData<SubscriptionPlan>('subscriptionPlans');
        if (plans.length === 0) {
            // Seed default plans if none exist
            const defaultPlans: SubscriptionPlan[] = [
                { id: 'plan-basic', name: 'Basic AI', price: '0', interval: 'month', activeSubscribers: 1200, features: ['Daily Chat', 'Basic Quizzes'] },
                { id: 'plan-premium', name: 'Premium AI', price: '25', interval: 'month', activeSubscribers: 450, features: ['Unlimited Chat', 'Unlimited Quizzes', 'Study Plans'] }
            ];
            const batch = writeBatch(db);
            defaultPlans.forEach(p => batch.set(doc(db, 'subscriptionPlans', p.id), p));
            await batch.commit();
            return defaultPlans;
        }
        return plans;
    } catch (error) {
        return [];
    }
};

export const saveSubscriptionPlan = (plan: SubscriptionPlan): void => {
    if (!db) return;
    const docRef = doc(db, 'subscriptionPlans', plan.id);
    setDoc(docRef, plan, { merge: true }).catch(async () => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'write',
            requestResourceData: plan,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });
};

export const deleteSubscriptionPlan = (planId: string): void => {
    if (!db) return;
    const docRef = doc(db, 'subscriptionPlans', planId);
    deleteDoc(docRef).catch(async () => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });
};

export const getOrders = async (userId?: string): Promise<Order[]> => {
    if (!db) return [];
    const ordersCollection = collection(db, 'orders');
    
    try {
        if (userId) {
            const q = query(ordersCollection, where("userId", "==", userId));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        }
        return getCollectionData<Order>('orders');
    } catch (error) {
        console.error("Error fetching orders:", error);
        return [];
    }
};

export const updateOrderStatus = (orderId: string, status: OrderStatus): void => {
    if (!db) return;
    const orderRef = doc(db, 'orders', orderId);
    
    updateDoc(orderRef, { status })
        .catch(async () => {
            const permissionError = new FirestorePermissionError({
                path: orderRef.path,
                operation: 'update',
                requestResourceData: { status },
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
}

export const getBillingHistory = async (userId?: string): Promise<BillingHistory[]> => {
    if (!db) return [];

    try {
        const billingCollection = collection(db, 'billingHistory');
        const billingQuery = userId
            ? query(billingCollection, where('userId', '==', userId))
            : query(billingCollection);
        const snapshot = await getDocs(billingQuery);

        return snapshot.docs
            .map(doc => normalizeBillingHistoryRecord({ id: doc.id, ...doc.data() } as BillingHistory))
            .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
    } catch (error) {
        console.error('Error fetching billing history:', error);
        return [];
    }
};

export const updatePayoutStatus = (payoutId: string, status: Payout['status']): void => {
    if (!db) return;
    const docRef = doc(db, 'payouts', payoutId);
    updateDoc(docRef, { status }).catch(async () => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: { status },
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });
};

export const getCommissionSettings = async () => {
    if (!db) return { defaultRate: 20, overrides: [] };
    try {
        const docRef = doc(db, 'platformSettings', 'commission-config');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) return docSnap.data();
        return { defaultRate: 20, overrides: [] };
    } catch (error) {
        return { defaultRate: 20, overrides: [] };
    }
}

export const saveCommissionSettings = (settings: { defaultRate: number, overrides?: any[] }) => {
    if (!db) return;
    const docRef = doc(db, 'platformSettings', 'commission-config');
    setDoc(docRef, settings, { merge: true }).catch(async () => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'write',
            requestResourceData: settings,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });
}
