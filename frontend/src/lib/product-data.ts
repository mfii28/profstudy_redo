'use client';

import { collection, getDocs, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { Product } from './db';
import { logger } from '@/lib/logging';

export const getProducts = async (): Promise<Product[]> => {
  if (!db) {
    logger.warn('[Product Data] Firestore not initialized');
    return [];
  }

  try {
    const productsCollection = collection(db, 'products');
    const snapshot = await getDocs(productsCollection);
    const products = snapshot.docs.map(doc => doc.data() as Product);
    logger.info('[Product Data] Products fetched', { count: products.length });
    return products;
  } catch (error: any) {
    logger.error('[Product Data] Failed to fetch products', {
      errorMessage: error.message,
      errorCode: error.code,
    });
    return [];
  }
};

export const getProduct = async (id: string): Promise<Product | null> => {
    if (!db) {
      logger.warn('[Product Data] Firestore not initialized');
      return null;
    }

    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      logger.warn('[Product Data] Invalid product ID provided');
      return null;
    }

    try {
      const docRef = doc(db, 'products', id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        logger.warn('[Product Data] Product not found', { productId: id });
        return null;
      }

      logger.info('[Product Data] Product retrieved', { productId: id });
      return docSnap.data() as Product;
    } catch (error: any) {
      logger.error('[Product Data] Failed to fetch product', {
        productId: id,
        errorMessage: error.message,
        errorCode: error.code,
      });
      return null;
    }
};

export const saveProduct = async (productToSave: Product): Promise<void> => {
  if (!db) {
    logger.warn('[Product Data] Cannot save product - Firestore not initialized');
    return;
  }

  if (!productToSave.id || typeof productToSave.id !== 'string' || productToSave.id.trim().length === 0) {
    logger.warn('[Product Data] Cannot save product - missing product ID');
    return;
  }

  try {
    const docRef = doc(db, 'products', productToSave.id);
    await setDoc(docRef, productToSave, { merge: true });
    logger.info('[Product Data] Product saved successfully', { productId: productToSave.id });
  } catch (error: any) {
    logger.error('[Product Data] Failed to save product', {
      productId: productToSave.id,
      errorMessage: error.message,
      errorCode: error.code,
    });
    throw error;
  }
};

export const deleteProduct = async (id: string): Promise<void> => {
  if (!db) {
    logger.warn('[Product Data] Cannot delete product - Firestore not initialized');
    return;
  }

  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    logger.warn('[Product Data] Cannot delete product - invalid product ID');
    return;
  }

  try {
    const docRef = doc(db, 'products', id);
    await deleteDoc(docRef);
    logger.info('[Product Data] Product deleted successfully', { productId: id });
  } catch (error: any) {
    logger.error('[Product Data] Failed to delete product', {
      productId: id,
      errorMessage: error.message,
      errorCode: error.code,
    });
    throw error;
  }
}
