'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { type Course, type Product, type CartItem as CartItemType, type User as AppUser } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot, collection, getDocs, query, where, documentId } from 'firebase/firestore';
import { addToCart as addToCartAction, removeFromCart as removeFromCartAction, updateCartItemQuantity, clearCart as clearCartAction } from './cart-data';
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
  const firestore = useFirestore();
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

  const chunk = useCallback((values: string[], size: number) => {
    const parts: string[][] = [];
    for (let i = 0; i < values.length; i += size) {
      parts.push(values.slice(i, i + size));
    }
    return parts;
  }, []);

  const fetchMetadataBatch = useCallback(async (
    ids: string[],
    collectionName: 'courses' | 'products',
    itemType: 'course' | 'product',
  ) => {
    if (!firestore || ids.length === 0) return;
    const unique = Array.from(new Set(ids.filter(Boolean)));
    const groups = chunk(unique, 10);
    for (const group of groups) {
      const q = query(collection(firestore, collectionName), where(documentId(), 'in', group));
      const snap = await getDocs(q);
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        itemMetaCacheRef.current.set(getMetaCacheKey(itemType, d.id), {
          title: data.title,
          price: Number(data.price ?? 0),
          listingPrice: typeof data.listingPrice === 'number' ? data.listingPrice : undefined,
          basePrice: typeof data.basePrice === 'number' ? data.basePrice : undefined,
          books: itemType === 'course' && Array.isArray(data.books) ? data.books : undefined,
          imageUrl: data.imageUrl || '',
          description: data.description || '',
        });
      });
    }
  }, [chunk, firestore, getMetaCacheKey]);

  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleCart = useCallback(() => setIsCartOpen((current) => !current), []);

  useEffect(() => {
    if (user && firestore) {
      if (!hasSyncedCartRef.current) {
        setLoading(true);
      }

      const profileUnsubscribe = onSnapshot(doc(firestore, 'users', user.uid), (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as AppUser);
        }
      });

      const cartCollectionRef = collection(firestore, 'users', user.uid, 'cart');
      const cartUnsubscribe = onSnapshot(cartCollectionRef, async (snapshot) => {
        const rawItems = snapshot.docs.map((cartDoc) => {
          const data = cartDoc.data();
          const itemType = data.itemType || ('sections' in data ? 'course' : 'product');
          return {
            id: cartDoc.id,
            productId: data.productId,
            courseId: data.itemType === 'course' ? data.productId : undefined,
            quantity: data.quantity || 1,
            itemType,
            title: data.title || 'Untitled Item',
            price: Number(data.price || 0),
            basePrice: Number(data.basePrice || data.price || 0),
            coursePurchaseOption: data.coursePurchaseOption || 'course_only',
            attachedBookId: data.attachedBookId || '',
            attachedBookTitle: data.attachedBookTitle || '',
            attachedBookPrice: Number(data.attachedBookPrice || 0),
            imageUrl: data.imageUrl || '',
            description: data.description || '',
          } as CartItemType;
        });

        const uncachedCourseIds = rawItems
          .filter(
            (item): item is CartItemType & { productId: string } =>
              item.itemType === 'course' &&
              typeof item.productId === 'string' &&
              item.productId.length > 0 &&
              !itemMetaCacheRef.current.has(getMetaCacheKey('course', item.productId))
          )
          .map((item) => item.productId);
        const uncachedProductIds = rawItems
          .filter(
            (item): item is CartItemType & { productId: string } =>
              item.itemType === 'product' &&
              typeof item.productId === 'string' &&
              item.productId.length > 0 &&
              !itemMetaCacheRef.current.has(getMetaCacheKey('product', item.productId))
          )
          .map((item) => item.productId);

        await Promise.all([
          fetchMetadataBatch(uncachedCourseIds, 'courses', 'course'),
          fetchMetadataBatch(uncachedProductIds, 'products', 'product'),
        ]);

        const nextItems = rawItems.map((item) => {
          if (!item.productId) return item;
          const meta = itemMetaCacheRef.current.get(getMetaCacheKey(item.itemType, item.productId));
          if (!meta) return item;
          if (item.itemType !== 'course') {
            return {
              ...item,
              title: meta.title || item.title,
              price: Number(meta.price ?? item.price),
              basePrice: Number(meta.price ?? item.basePrice ?? item.price),
              imageUrl: meta.imageUrl || item.imageUrl,
              description: meta.description || item.description,
            };
          }
          const listing = getCourseListingPrice({
            price: meta.price,
            listingPrice: meta.listingPrice,
            basePrice: meta.basePrice,
            books: meta.books,
          } as Course);
          const linePrice =
            item.coursePurchaseOption === 'course_with_book'
              ? listing + Number(item.attachedBookPrice || 0)
              : listing;
          return {
            ...item,
            title: meta.title || item.title,
            price: linePrice,
            basePrice: listing,
            imageUrl: meta.imageUrl || item.imageUrl,
            description: meta.description || item.description,
          };
        });

        setCartItems((prev) => {
          const prevSig = prev.map((item) => `${item.id}:${item.productId}:${item.quantity}:${item.price}:${item.title}`).join('|');
          const nextSig = nextItems.map((item) => `${item.id}:${item.productId}:${item.quantity}:${item.price}:${item.title}`).join('|');
          return prevSig === nextSig ? prev : nextItems;
        });
        hasSyncedCartRef.current = true;
        setLoading(false);
      });

      return () => {
        profileUnsubscribe();
        cartUnsubscribe();
      };
    } else {
      setCartItems((prev) => prev.length > 0 ? [] : prev);
      hasSyncedCartRef.current = false;
      setLoading((prev) => prev ? false : prev);
    }
  }, [user, firestore]);

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
        await updateCartItemQuantity(user.uid, existingItem.id, existingItem.quantity + 1);
        openCart();
      } catch (error) {
        console.error('Error updating cart quantity:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update item quantity.' });
      }
    } else {
      try {
        openCart();
        await addToCartAction(user.uid, {
          ...item,
          ...(itemType === 'course'
            ? (() => {
                const courseItem = item as Course;
                const listing = getCourseListingPrice(courseItem);
                const linePrice =
                  (options?.coursePurchaseOption || 'course_only') === 'course_with_book'
                    ? listing + Number(options?.attachedBookPrice || 0)
                    : listing;
                return { price: linePrice, basePrice: listing };
              })()
            : {}),
        } as Course | Product, 1);
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
      await removeFromCartAction(user.uid, cartItemId);
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
      await updateCartItemQuantity(user.uid, cartItemId, quantity);
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update item quantity.' });
    }
  }, [user, toast, removeFromCart, cartItems]);

  const clearCart = useCallback(async () => {
    if (!user) return;
    try {
      await clearCartAction(user.uid);
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
