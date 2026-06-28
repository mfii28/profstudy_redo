'use client';

import { apiFetch } from '@/lib/api-client';
import type { Product } from './db';
import { logger } from '@/lib/logging';

export const getProducts = async (): Promise<Product[]> => {
  try {
    const res = await apiFetch('/products');
    if (!res.ok) return [];
    const data = await res.json();
    return data.products || [];
  } catch (error: any) {
    logger.error('[Product Data] Failed to fetch products', {
      errorMessage: error.message,
    });
    return [];
  }
};

export const getProduct = async (id: string): Promise<Product | null> => {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      logger.warn('[Product Data] Invalid product ID provided');
      return null;
    }

    try {
      const res = await apiFetch(`/products/${encodeURIComponent(id)}`);
      if (!res.ok) {
        logger.warn('[Product Data] Product not found', { productId: id });
        return null;
      }
      const data = await res.json();
      logger.info('[Product Data] Product retrieved', { productId: id });
      return data.product as Product;
    } catch (error: any) {
      logger.error('[Product Data] Failed to fetch product', {
        productId: id,
        errorMessage: error.message,
      });
      return null;
    }
};

export const saveProduct = async (productToSave: Product): Promise<void> => {
  if (!productToSave.id || typeof productToSave.id !== 'string' || productToSave.id.trim().length === 0) {
    logger.warn('[Product Data] Cannot save product - missing product ID');
    return;
  }

  try {
    const res = await apiFetch(`/products/${productToSave.id}`, {
      method: 'PUT',
      body: JSON.stringify(productToSave),
    });
    if (!res.ok) throw new Error('Failed to save product');
    logger.info('[Product Data] Product saved successfully', { productId: productToSave.id });
  } catch (error: any) {
    logger.error('[Product Data] Failed to save product', {
      productId: productToSave.id,
      errorMessage: error.message,
    });
    throw error;
  }
};

export const deleteProduct = async (id: string): Promise<void> => {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    logger.warn('[Product Data] Cannot delete product - invalid product ID');
    return;
  }

  try {
    const res = await apiFetch(`/products/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete product');
    logger.info('[Product Data] Product deleted successfully', { productId: id });
  } catch (error: any) {
    logger.error('[Product Data] Failed to delete product', {
      productId: id,
      errorMessage: error.message,
    });
    throw error;
  }
}
