'use client';

import { apiFetch } from '@/lib/api-client';
import { type Product, type Course } from './db';

/**
 * @fileOverview Data service for managing user carts.
 * Routes through the Python backend REST API.
 */

export const getCart = async (_userId: string) => {
    try {
        const res = await apiFetch('/cart');
        if (!res.ok) return [];
        const data = await res.json();
        return data.items || [];
    } catch (e) {
        console.error('[CartData] fetch error:', e);
        return [];
    }
};

export const addToCart = async (_userId: string, item: Product | Course, quantity: number): Promise<void> => {
    const itemType = 'sections' in item ? 'course' : 'product';
    const res = await apiFetch('/cart/add', {
        method: 'POST',
        body: JSON.stringify({
            productId: item.id,
            quantity,
            itemType,
            title: item.title,
            price: Number((item as any).price || 0),
        }),
    });
    if (!res.ok) throw new Error('Failed to add to cart');
};

export const removeFromCart = async (_userId: string, cartItemId: string): Promise<void> => {
    const res = await apiFetch(`/cart/${cartItemId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to remove from cart');
};

export const updateCartItemQuantity = async (_userId: string, cartItemId: string, quantity: number): Promise<void> => {
    const res = await apiFetch(`/cart/${cartItemId}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity }),
    });
    if (!res.ok) throw new Error('Failed to update cart item');
};

export const clearCart = async (_userId: string): Promise<void> => {
    const res = await apiFetch('/cart', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear cart');
};
