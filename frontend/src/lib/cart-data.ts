'use client';

import { 
  collection, 
  getDocs, 
  doc, 
  query, 
  where, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import { getProduct } from './product-data';
import { type Product, type Course } from './db';
import { getCourseListingPrice } from '@/lib/course-pricing';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

/**
 * @fileOverview Data service for managing user carts in Firestore.
 * Converted to 'use client' to ensure operations carry the user's auth context.
 */

const emitError = (path: string, operation: SecurityRuleContext['operation'], data?: any) => {
  const error = new FirestorePermissionError({
    path,
    operation,
    requestResourceData: data
  });
  errorEmitter.emit('permission-error', error);
};

export const getCart = async (userId: string) => {
    if (!db || !userId) return [];
    try {
        const cartCollection = collection(db, 'users', userId, 'cart');
        const snapshot = await getDocs(cartCollection);
        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (e) {
        emitError(`users/${userId}/cart`, 'list');
        return [];
    }
};

export const addToCart = async (userId: string, item: Product | Course, quantity: number): Promise<void> => {
    if (!db) {
        throw new Error('Firestore not initialized');
    }
    if (!userId) {
        throw new Error('Missing user ID');
    }

    const productId = item.id;
    const itemType = 'sections' in item ? 'course' : 'product';
    const cartCollection = collection(db, 'users', userId, 'cart');
    const q = query(cartCollection, where('productId', '==', productId));

    try {
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const docRef = snapshot.docs[0].ref;
            const newQuantity = (snapshot.docs[0].data().quantity || 0) + quantity;
            await updateDoc(docRef, { quantity: newQuantity });
        } else {
            const firstBook = itemType === 'course' && Array.isArray((item as Course).books) ? (item as Course).books?.[0] : undefined;
            const selectedBookId = (item as any).attachedBookId || firstBook?.id || '';
            const selectedBookTitle = (item as any).attachedBookTitle || firstBook?.title || '';
            const selectedBookPrice = Number((item as any).attachedBookPrice ?? firstBook?.price ?? 0);
            const payload = {
                productId,
                quantity,
                itemType,
                title: item.title || '',
                price: Number(item.price || 0),
                basePrice: itemType === 'course' ? getCourseListingPrice(item as Course) : Number(item.price || 0),
                coursePurchaseOption: itemType === 'course' ? (item as any).coursePurchaseOption || 'course_only' : undefined,
                attachedBookId: itemType === 'course' ? selectedBookId : undefined,
                attachedBookTitle: itemType === 'course' ? selectedBookTitle : undefined,
                attachedBookPrice: itemType === 'course' ? selectedBookPrice : undefined,
                imageUrl: item.imageUrl || '',
                description: item.description || '',
            };
            await addDoc(cartCollection, payload);
        }
    } catch (error) {
        emitError(cartCollection.path, 'list');
        throw error;
    }
};

export const removeFromCart = async (userId: string, cartItemId: string): Promise<void> => {
    if (!db) {
        throw new Error('Firestore not initialized');
    }
    if (!userId) {
        throw new Error('Missing user ID');
    }
    const docRef = doc(db, 'users', userId, 'cart', cartItemId);
    try {
        await deleteDoc(docRef);
    } catch (error) {
        emitError(docRef.path, 'delete');
        throw error;
    }
};

export const updateCartItemQuantity = async (userId: string, cartItemId: string, quantity: number): Promise<void> => {
    if (!db) {
        throw new Error('Firestore not initialized');
    }
    if (!userId) {
        throw new Error('Missing user ID');
    }
    if (quantity < 1) {
        await removeFromCart(userId, cartItemId);
        return;
    }
    const docRef = doc(db, 'users', userId, 'cart', cartItemId);
    try {
        await updateDoc(docRef, { quantity });
    } catch (error) {
        emitError(docRef.path, 'update', { quantity });
        throw error;
    }
};

export const clearCart = async (userId: string) => {
    if (!db || !userId) return;
    const cartCollection = collection(db, 'users', userId, 'cart');
    
    try {
        const snapshot = await getDocs(cartCollection);
        if (snapshot.empty) return;
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    } catch (error) {
        console.error('Clear cart error:', error);
        emitError(cartCollection.path, 'delete');
    }
};

export const getCartWithDetails = async (userId: string) => {
    if (!db || !userId) return [];
    try {
        const cartItems = await getCart(userId);
        
        if (cartItems.length === 0) return [];
        
        // Fetch all products in parallel instead of sequentially
        const detailedCart = await Promise.all(
            (cartItems as any[]).map(async (item) => {
                const product = await getProduct(item.productId);
                if (product) {
                    return {
                        ...product,
                        quantity: item.quantity,
                        itemType: item.itemType,
                        cartItemId: item.id,
                    };
                }
                return null;
            })
        );
        
        return detailedCart.filter(item => item !== null);
    } catch (e) {
        console.error('Error fetching cart details:', e);
        return [];
    }
};