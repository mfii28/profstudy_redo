'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { type Course, type Product, type CartItem as CartItemType, type User as AppUser } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import { getCourseListingPrice } from '@/lib/course-pricing';

interface CartContextType {
  cartItems: CartItemType[];
  addToCart: (
    item: Course | Product,
    options?: {
      coursePurchaseOption?: 'course_only' | 'course_with_book';
      attachedBookId?: string;
      attachedBookTitle?: string;
      attachedBookPrice?: number;
    }
  ) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  totalPrice: number;
  loading: boolean;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const hasSyncedCartRef = useRef(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { user } = useUser();
  const [userProfile, setUserProfile] = useState<AppUser | null>(null);
  const { toast } = useToast();
  const itemMetaCacheRef = useRef<
    Map<
      string,
      {
        title?: string;
        price?: number;
        listingPrice?: number;
        basePrice?: number;
        books?: Course['books'];
        imageUrl?: string;
        description?: string;
      }
    >
  >(new Map());

  const getMetaCacheKey = useCallback((itemType: string, productId: string) => `${itemType}:${productId}`, []);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleCart = useCallback(() => setIsCartOpen((current) => !current), []);

  useEffect(() => {
    if (user) {
      if (!hasSyncedCartRef.current) {
        setLoading(true);
      }

      // Fetch user profile
      apiFetch('/users/profile').then(res => res.ok ? res.json() : null).then(data => {
        if (data?.user) setUserProfile(data.user as AppUser);
      }).catch(() => {});

      // Fetch cart from API
      const fetchCart = async () => {
        try {
          const res = await apiFetch('/cart');
          if (res.ok) {
            const data = await res.json();
            const items: CartItemType[] = (data.items || []).map((item: any) => ({
              id: item.id,
              productId: item.productId || item.courseId || item.id,
              courseId: item.itemType === 'course' ? (item.productId || item.courseId || item.id) : undefined,
              quantity: item.quantity || 1,
              itemType: item.itemType || 'course',
              title: item.title || 'Untitled Item',
              price: Number(item.price || 0),
              basePrice: Number(item.basePrice || item.price || 0),
              coursePurchaseOption: item.coursePurchaseOption || 'course_only',
              attachedBookId: item.attachedBookId || '',
              attachedBookTitle: item.attachedBookTitle || '',
              attachedBookPrice: Number(item.attachedBookPrice || 0),
              imageUrl: item.imageUrl || '',
              description: item.description || '',
            }));
            setCartItems(items);
          }
        } catch {
          // ignore
        }
        hasSyncedCartRef.current = true;
        setLoading(false);
      };

      fetchCart();
    } else {
      setCartItems((prev) => prev.length > 0 ? [] : prev);
      hasSyncedCartRef.current = false;
      setLoading((prev) => prev ? false : prev);
    }
  }, [user]);

  const addToCart = useCallback(async (
    item: Course | Product,
    options?: {
      coursePurchaseOption?: 'course_only' | 'course_with_book';
      attachedBookId?: string;
      attachedBookTitle?: string;
      attachedBookPrice?: number;
    }
  ) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Not logged in', description: 'Please log in to add items to your cart.' });
      return;
    }

    const itemType = 'sections' in item ? 'course' : 'product';
    if (itemType === 'course' && userProfile?.enrollments?.some(e => e.courseId === item.id)) {
      toast({ variant: 'destructive', title: 'Already Enrolled', description: `You already own "${item.title}".` });
      return;
    }

    const existingItem = cartItems.find(
      (cartItem) =>
        cartItem.productId === item.id &&
        (itemType !== 'course' || (cartItem.coursePurchaseOption || 'course_only') === (options?.coursePurchaseOption || 'course_only'))
    );
    if (existingItem) {
      if (itemType === 'course') {
        toast({ variant: 'destructive', title: 'Already in Cart', description: `"${item.title}" is already in your cart.` });
        openCart();
        return;
      }
      try {
        await apiFetch('/cart/add', {
          method: 'POST',
          body: JSON.stringify({ productId: item.id, quantity: existingItem.quantity + 1, itemType }),
        });
        openCart();
      } catch (error) {
        console.error('Error updating cart quantity:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update item quantity.' });
      }
    } else {
      try {
        openCart();
        const listing = itemType === 'course' ? getCourseListingPrice(item as Course) : Number((item as Product).price || 0);
        const linePrice = itemType === 'course' && (options?.coursePurchaseOption || 'course_only') === 'course_with_book'
          ? listing + Number(options?.attachedBookPrice || 0)
          : listing;

        await apiFetch('/cart/add', {
          method: 'POST',
          body: JSON.stringify({
            productId: item.id,
            quantity: 1,
            itemType,
            price: linePrice,
            basePrice: listing,
            title: item.title,
            imageUrl: (item as any).imageUrl || '',
            ...(itemType === 'course' ? {
              coursePurchaseOption: options?.coursePurchaseOption || 'course_only',
              attachedBookId: options?.attachedBookId || '',
              attachedBookTitle: options?.attachedBookTitle || '',
              attachedBookPrice: options?.attachedBookPrice || 0,
            } : {}),
          }),
        });
        toast({ title: 'Added to cart!', description: `${item.title} has been added.` });
      } catch (error) {
        console.error('Error adding to cart:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to add item to cart.' });
      }
    }
  }, [user, userProfile, cartItems, toast, openCart]);

  const removeFromCart = useCallback(async (cartItemId: string) => {
    if (!user) return;
    try {
      await apiFetch(`/cart/${cartItemId}`, { method: 'DELETE' });
      toast({ title: 'Item removed', variant: 'destructive' });
    } catch (error) {
      console.error('Error removing from cart:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to remove item from cart.' });
    }
  }, [user, toast]);

  const updateQuantity = useCallback(async (cartItemId: string, quantity: number) => {
    if (!user) return;
    if (quantity < 1) {
      removeFromCart(cartItemId);
      return;
    }
    try {
      const cartItem = cartItems.find((item) => item.id === cartItemId);
      if (cartItem?.itemType === 'course') {
        quantity = 1;
      }
      await apiFetch(`/cart/${cartItemId}`, {
        method: 'PUT',
        body: JSON.stringify({ quantity }),
      });
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update item quantity.' });
    }
  }, [user, toast, removeFromCart, cartItems]);

  const clearCart = useCallback(async () => {
    if (!user) return;
    try {
      await apiFetch('/cart', { method: 'DELETE' });
    } catch (error) {
      console.error('Error clearing cart:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to clear cart.' });
    }
  }, [user, toast]);

  const cartCount = cartItems.reduce((count, item) => count + (item.quantity || 1), 0);

  const totalPrice = cartItems.reduce((total, item) => total + ((item.price || 0) * (item.quantity || 1)), 0);

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, updateQuantity, clearCart, cartCount, totalPrice, loading, isCartOpen, openCart, closeCart, toggleCart }}>
      {children}
    </CartContext.Provider>
  );
}
