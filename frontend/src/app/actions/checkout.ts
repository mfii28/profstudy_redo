'use server';

import { adminDb, adminAuth } from '@/firebase/admin';
import { initializeTransaction } from '@/app/actions/payments';
import { type UserAddress } from '@/lib/db';
import { validateCheckout } from '@/lib/validation';
import { logger } from '@/lib/logging';
import { isPublishedCourseStatus } from '@/lib/course-access';
import {
  applyPercentDiscountToSubtotal,
  clampDiscountPercent,
  parseAffiliateRewards,
} from '@/lib/affiliate-discount';
import { getCourseListingPrice } from '@/lib/course-pricing';
import { normalizeServiceError } from '@/lib/service-errors';

/**
 * @fileOverview Server-side checkout command with amount re-validation.
 * SECURITY: Prices are re-fetched from Firestore to prevent client-side tampering.
 * VALIDATION: All inputs validated with Zod schemas before processing.
 */

interface CheckoutResult {
  error?: string;
  authorization_url?: string;
  reference?: string;
}

const CHECKOUT_SHIPPING_FEE = Number(
  process.env.CHECKOUT_SHIPPING_FEE ?? process.env.NEXT_PUBLIC_CHECKOUT_SHIPPING_FEE ?? '15'
);
const CHECKOUT_TAX_RATE = Number(
  process.env.CHECKOUT_TAX_RATE ?? process.env.NEXT_PUBLIC_CHECKOUT_TAX_RATE ?? '0.05'
);

function calculateCheckoutCharges(subtotal: number, hasPhysicalProducts: boolean) {
  const shipping = hasPhysicalProducts ? CHECKOUT_SHIPPING_FEE : 0;
  const tax = subtotal * CHECKOUT_TAX_RATE;
  const total = subtotal + shipping + tax;

  return { shipping, tax, total };
}

function normalizeCheckoutError(error: unknown): string {
  const normalized = normalizeServiceError(error, { feature: 'Checkout' });
  if (normalized.kind === 'quota') {
    return 'Checkout is temporarily unavailable because the service is busy. Please wait a few minutes and try again.';
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();

  // Return specific error messages for common issues to aid debugging
  if (lowered.includes('insufficient stock')) {
    return message; // Pass through stock errors
  }
  if (lowered.includes('not available for purchase')) {
    return message; // Pass through availability errors
  }
  if (lowered.includes('invalid price')) {
    return message; // Pass through pricing errors
  }
  if (lowered.includes('already purchased')) {
    return message; // Pass through repurchase errors
  }
  if (lowered.includes('cart total mismatch')) {
    return message; // Pass through amount mismatch errors
  }
  if (lowered.includes('cart exceeds maximum')) {
    return message; // Pass through cart size errors
  }
  if (lowered.includes('invalid quantity')) {
    return message; // Pass through quantity errors
  }
  if (lowered.includes('shipping address is required')) {
    return message; // Pass through address errors
  }
  if (lowered.includes('checkout already in progress')) {
    return message; // Pass through idempotency errors
  }

  // Log the actual error for debugging but return to user
  console.error('[Checkout] Detailed error:', error);
  return `Checkout failed: ${message}`;
}

/**
 * Re-calculates cart total by fetching current prices from Firestore.
 * This prevents price tampering on the client side.
 * OPTIMIZATION: Parallel fetching of courses and products via document-ID lookup.
 *
 * NOTE: We deliberately use adminDb.getAll() with explicit document refs rather
 * than a field query like where('id', 'in', ids).  The 'id' field is NOT stored
 * inside Firestore documents — it is only the document ID, surfaced client-side
 * via doc.id.  A field query would always return zero results.
 */
async function recalculateCartTotal(
  items: Array<{ id: string; quantity: number; itemType: 'course' | 'product'; coursePurchaseOption?: 'course_only' | 'course_with_book'; attachedBookId?: string }>
): Promise<{ total: number; itemDetails: any[]; error?: string }> {
  try {
    const courseIds = items.filter(i => i.itemType === 'course').map(i => i.id);
    const productIds = items.filter(i => i.itemType === 'product').map(i => i.id);

    logger.debug('[Checkout] recalculateCartTotal start', {
      itemCount: items.length,
      courseIds,
      productIds,
    });

    const itemDetails: any[] = [];
    let total = 0;

    // OPTIMIZATION: Fetch courses and products in parallel using document-ID refs.
    // adminDb.getAll() is equivalent to a batch get and avoids the field-query bug above.
    const [courseSnaps, productSnaps] = await Promise.all([
      courseIds.length > 0
        ? adminDb.getAll(...courseIds.map(id => adminDb.doc(`courses/${id}`)))
        : Promise.resolve([] as FirebaseFirestore.DocumentSnapshot[]),
      productIds.length > 0
        ? adminDb.getAll(...productIds.map(id => adminDb.doc(`products/${id}`)))
        : Promise.resolve([] as FirebaseFirestore.DocumentSnapshot[]),
    ]);

    // Build maps for quick lookups (doc.id → data)
    const courseMap = new Map<string, any>(
      courseSnaps.filter(d => d.exists).map(d => [d.id, d.data()])
    );
    const productMap = new Map<string, any>(
      productSnaps.filter(d => d.exists).map(d => [d.id, d.data()])
    );

    logger.debug('[Checkout] Firestore fetch results', {
      coursesFetched: courseSnaps.length,
      coursesFound: courseMap.size,
      coursesMissing: courseSnaps.filter(d => !d.exists).map(d => d.id),
      productsFetched: productSnaps.length,
      productsFound: productMap.size,
      productsMissing: productSnaps.filter(d => !d.exists).map(d => d.id),
    });

    // Process items with validated prices
    for (const item of items) {
      if (item.itemType === 'course') {
        const course = courseMap.get(item.id);

        logger.debug('[Checkout] Course lookup result', {
          courseId: item.id,
          found: !!course,
          status: course?.status,
          isPublishedStatus: course ? isPublishedCourseStatus(course.status) : false,
          isFree: course?.isFree,
          price: course?.price,
          priceType: course ? typeof course.price : 'N/A',
          title: course?.title,
          visibility: course?.visibility,
        });

        if (!course) {
          logger.warn('[Checkout] Course not found in Firestore', { courseId: item.id, path: `courses/${item.id}` });
          return { total: 0, itemDetails: [], error: `Course ${item.id} not found` };
        }
        // SECURITY: Validate course is published using the canonical status check.
        // Courses are published by setting status='Published' — there is no boolean
        // isPublished field in Firestore. isPublishedCourseStatus() handles all
        // case variants ('Published', 'published', 'PUBLISHED').
        if (!isPublishedCourseStatus(course.status)) {
          logger.warn('[Checkout] Course not available for purchase', {
            courseId: item.id,
            title: course.title,
            status: course.status,
            statusLower: String(course.status || '').toLowerCase(),
          });
          return { total: 0, itemDetails: [], error: `Course "${course.title || item.id}" is not available for purchase` };
        }
        if (typeof course.price !== 'number' && !course.isFree) {
          logger.warn('[Checkout] Course has invalid price', {
            courseId: item.id,
            title: course.title,
            price: course.price,
            priceType: typeof course.price,
            isFree: course.isFree,
          });
          return { total: 0, itemDetails: [], error: `Invalid price for course "${course.title || item.id}"` };
        }
        const normalizedQuantity = 1;
        const attachedBooks = Array.isArray(course.books) ? course.books : [];
        const selectedBook = item.coursePurchaseOption === 'course_with_book'
          ? attachedBooks.find((book: any) => book?.id === item.attachedBookId) || attachedBooks[0]
          : null;
        const selectedBookPrice = Number(selectedBook?.price || 0);
        const listingPrice = getCourseListingPrice(course);
        const effectiveCoursePrice =
          item.coursePurchaseOption === 'course_with_book'
            ? listingPrice + selectedBookPrice
            : listingPrice;
        if (course.isFree) {
          itemDetails.push({ ...course, id: item.id, quantity: normalizedQuantity, type: 'course', coursePurchaseOption: 'course_only' });
        } else {
          const itemPrice = effectiveCoursePrice * normalizedQuantity;
          total += itemPrice;
          itemDetails.push({
            ...course,
            id: item.id,
            quantity: normalizedQuantity,
            type: 'course',
            coursePurchaseOption: item.coursePurchaseOption || 'course_only',
            attachedBookId: selectedBook?.id || '',
            attachedBookTitle: selectedBook?.title || '',
            attachedBookPrice: selectedBookPrice,
            basePrice: listingPrice,
            price: effectiveCoursePrice,
          });
        }
      } else if (item.itemType === 'product') {
        const product = productMap.get(item.id);
        if (!product) {
          return { total: 0, itemDetails: [], error: `Product ${item.id} not found` };
        }
        // SECURITY: Validate product is active, has valid price, and has sufficient stock
        if (product.isActive === false) {
          return { total: 0, itemDetails: [], error: `Product "${product.name || item.id}" is not available for purchase` };
        }
        if (typeof product.price !== 'number') {
          return { total: 0, itemDetails: [], error: `Invalid price for product "${product.name || item.id}"` };
        }
        // STOCK VALIDATION: Check sufficient inventory for physical products
        if (product.stock !== undefined && product.stock !== null) {
          if (product.stock < item.quantity) {
            return {
              total: 0,
              itemDetails: [],
              error: `Insufficient stock for "${product.name || item.id}". Available: ${product.stock}, Requested: ${item.quantity}`
            };
          }
        }
        const itemPrice = product.price * item.quantity;
        total += itemPrice;
        itemDetails.push({ ...product, id: item.id, quantity: item.quantity, type: 'product', price: product.price });
      }
    }

    logger.debug('[Checkout] recalculateCartTotal complete', {
      total,
      itemCount: itemDetails.length,
      itemSummary: itemDetails.map(i => ({ id: i.id, type: i.type, price: i.price, title: i.title })),
    });

    return { total, itemDetails };
  } catch (error: any) {
    logger.error('[Checkout] Price recalculation failed', { error: error.message, stack: error.stack });
    return { total: 0, itemDetails: [], error: normalizeCheckoutError(error) };
  }
}

const MAX_CART_ITEMS = 50;
const MAX_QUANTITY_PER_ITEM = 99;

export async function initiateCartCheckout(
  idToken: string,
  email: string,
  clientProvidedAmount: number,
  items: any[],
  address: UserAddress | null,
  checkoutSessionId?: string
): Promise<CheckoutResult> {
  const checkoutStart = Date.now();
  try {
    // 1. AUTHENTICATION: Verify Firebase ID token
    if (!idToken) {
      return { error: 'Authentication required. Please sign in to continue.' };
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return { error: 'Session expired. Please sign in again.' };
    }

    const userId = decodedToken.uid;

    logger.info('[Checkout] initiateCartCheckout start', {
      userId,
      email,
      clientProvidedAmount,
      itemCount: items.length,
      checkoutSessionId,
      rawItems: items.map(i => ({
        id: i.id,
        productId: i.productId,
        courseId: i.courseId,
        itemType: i.itemType,
        quantity: i.quantity,
      })),
    });

    // 2. INPUT VALIDATION
    // 2.1 CART SIZE LIMIT: Prevent abuse and Firestore batch limits
    if (items.length > MAX_CART_ITEMS) {
      return { error: `Cart exceeds maximum of ${MAX_CART_ITEMS} items. Please remove some items.` };
    }

    // 2.2 QUANTITY VALIDATION: Ensure positive integers within limits
    for (const item of items) {
      const qty = item.quantity || 1;
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QUANTITY_PER_ITEM) {
        return { error: `Invalid quantity for item. Must be between 1 and ${MAX_QUANTITY_PER_ITEM}.` };
      }
    }

    // Backward compatibility: some carts store catalog IDs only in cart doc payload (`productId`),
    // while the client may send cart-row IDs as `id`. Resolve missing catalog IDs from server cart docs.
    const idsNeedingLookup = Array.from(new Set(
      items
        .filter((i) => !i?.productId && !i?.courseId && typeof i?.id === 'string' && i.id.trim().length > 0)
        .map((i) => String(i.id).trim())
    ));

    logger.debug('[Checkout] Cart ID resolution', {
      userId,
      idsNeedingLookup,
      itemsWithProductId: items.filter(i => i.productId).map(i => ({ id: i.id, productId: i.productId })),
      itemsWithCourseId: items.filter(i => i.courseId).map(i => ({ id: i.id, courseId: i.courseId })),
    });

    const serverResolvedCatalogIds = new Map<string, string>();
    if (idsNeedingLookup.length > 0) {
      const cartDocRefs = idsNeedingLookup.map((cartDocId) => adminDb.doc(`users/${userId}/cart/${cartDocId}`));
      const cartDocSnaps = await adminDb.getAll(...cartDocRefs);
      for (const snap of cartDocSnaps) {
        if (!snap.exists) {
          logger.warn('[Checkout] Cart doc not found during ID resolution', { cartDocId: snap.id, userId });
          continue;
        }
        const data = snap.data() as { productId?: string; courseId?: string } | undefined;
        const resolved = (data?.productId || data?.courseId || '').trim();
        if (resolved) {
          serverResolvedCatalogIds.set(snap.id, resolved);
          logger.debug('[Checkout] Resolved cart doc ID', { cartDocId: snap.id, resolvedCatalogId: resolved });
        } else {
          logger.warn('[Checkout] Cart doc has no productId or courseId', { cartDocId: snap.id, data });
        }
      }
    }

    const payload = {
      userId,
      email,
      items: items.map(i => ({
        // Prefer canonical catalog IDs and fall back to server-resolved cart payload IDs.
        id: i.productId || i.courseId || serverResolvedCatalogIds.get(String(i.id || '').trim()) || i.id,
        quantity: Math.min(Math.max(Math.floor(Number(i.quantity)) || 1, 1), MAX_QUANTITY_PER_ITEM),
        itemType: i.itemType,
        coursePurchaseOption: i.coursePurchaseOption,
        attachedBookId: i.attachedBookId,
      })),
      amount: clientProvidedAmount,
      address,
    };

    const validatedPayload = validateCheckout(payload);

    logger.debug('[Checkout] Validated payload items', {
      userId,
      validatedItemCount: validatedPayload.items.length,
      validatedItems: validatedPayload.items,
    });

    // 3. VALIDATE ITEMS NOT EMPTY
    if (validatedPayload.items.length === 0) {
      logger.warn('[Checkout] Empty cart after validation', { userId, rawItemCount: items.length });
      return { error: 'Your cart is empty.' };
    }

    // 3.1 IDEMPOTENCY: Check for existing checkout session to prevent duplicate transactions.
    // Only block if payment was actually sent to Paystack (status === 'payment_initiated').
    // A status of 'initiated' means a previous attempt failed before reaching the payment
    // gateway, so retrying should be allowed.
    let sessionRef: FirebaseFirestore.DocumentReference | null = null;
    if (checkoutSessionId) {
      sessionRef = adminDb.doc(`checkoutSessions/${checkoutSessionId}`);
      const sessionSnap = await sessionRef.get();
      if (sessionSnap.exists) {
        const sessionData = sessionSnap.data();
        const sessionStatus = sessionData?.status;
        const sessionTime = sessionData?.createdAt?.toMillis?.() || 0;
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        // Only block if we already redirected to Paystack in this session window
        if (sessionStatus === 'payment_initiated' && sessionTime > fiveMinutesAgo) {
          logger.warn('[Checkout] Duplicate session detected', { userId, checkoutSessionId });
          return { error: 'Checkout already in progress. Please wait or refresh to try again.' };
        }
      }
      // Mark session as initiated (allows retry if something fails before payment)
      await sessionRef.set({
        userId,
        status: 'initiated',
        createdAt: new Date(),
        itemCount: validatedPayload.items.length,
      }, { merge: true });
    }

    // 4. RE-CALCULATE TOTAL SERVER-SIDE
    const hasPhysicalProducts = validatedPayload.items.some(i => i.itemType === 'product');
    const { total: cartSubtotal, itemDetails, error: calcError } = 
      await recalculateCartTotal(validatedPayload.items);

    if (calcError) {
      logger.warn('[Checkout] Price recalculation error', { userId, calcError, validatedItems: validatedPayload.items });
      return { error: calcError };
    }

    // 4.1 PREVENT REPURCHASE OF COURSES ALREADY OWNED
    const userDoc = await adminDb.doc(`users/${validatedPayload.userId}`).get();
    if (!userDoc.exists) {
      return { error: 'User profile not found.' };
    }
    const userData = userDoc.data()!;
    const enrolledCourseIds = new Set((userData.enrollments || []).map((e: any) => e.courseId));
    const alreadyOwnedCourses = itemDetails
      .filter((i) => i.type === 'course' && enrolledCourseIds.has(i.id))
      .map((i) => i.title);

    if (alreadyOwnedCourses.length > 0) {
      return {
        error: `You already purchased: ${alreadyOwnedCourses.join(', ')}. Remove them from cart to continue.`,
      };
    }

    // 5. APPLY REFERRAL DISCOUNT (percent off subtotal before tax/shipping) then validate total
    const rewards = parseAffiliateRewards(
      (userData as { affiliateDiscountRewards?: unknown }).affiliateDiscountRewards
    );
    const affiliateDiscountPercentApplied = clampDiscountPercent(rewards?.discountPercentAvailable ?? 0);
    const discountedCartSubtotal = applyPercentDiscountToSubtotal(cartSubtotal, affiliateDiscountPercentApplied);

    // Allow up to 1% variance for currency conversion/rounding
    const { shipping, tax, total: serverCalculatedTotal } = calculateCheckoutCharges(
      discountedCartSubtotal,
      hasPhysicalProducts
    );
    const tolerance = serverCalculatedTotal * 0.01;
    if (Math.abs(serverCalculatedTotal - clientProvidedAmount) > tolerance) {
      logger.warn('[Checkout Security] Amount mismatch detected', {
        userId,
        clientAmount: clientProvidedAmount,
        serverAmount: serverCalculatedTotal,
        cartSubtotal,
        shipping,
        tax,
      });
      return { error: 'Cart total mismatch. Please refresh and try again.' };
    }

    // 6. VALIDATE PHYSICAL PRODUCT REQUIREMENTS
    if (hasPhysicalProducts) {
      if (!validatedPayload.address?.line1 || !validatedPayload.address?.city || !validatedPayload.address?.phone) {
        return { error: 'Shipping address is required for physical products.' };
      }
    }

    // 7. BUILD METADATA
    const metadata = {
      userId: validatedPayload.userId,
      checkoutType: 'cart_purchase',
      items: itemDetails.map(item => ({
        id: item.id,
        title: item.title,
        type: item.type,
        price: item.price,
        quantity: item.quantity,
      })),
      cartSubtotal,
      cartSubtotalAfterAffiliateDiscount: discountedCartSubtotal,
      affiliateDiscountPercentApplied,
      tax,
      shipping,
      serverVerifiedTotal: serverCalculatedTotal,
      shippingAddress: hasPhysicalProducts ? validatedPayload.address : null,
      checkoutTimestamp: new Date().toISOString(),
    };

    // 8. INITIATE PAYMENT (already authenticated via idToken above)
    logger.info('[Checkout] Calling initializeTransaction', {
      userId,
      email: validatedPayload.email,
      serverCalculatedTotal,
      cartSubtotal,
      shipping,
      tax,
      itemCount: validatedPayload.items.length,
      itemTypes: validatedPayload.items.map(i => i.itemType),
    });

    const result = await initializeTransaction(idToken, validatedPayload.email, serverCalculatedTotal, metadata);

    if (result.error) {
      logger.error('[Checkout Action] Transaction initialization failed', { userId, error: result.error });
      return { error: result.error };
    }

    // Mark session as payment_initiated now that we have a Paystack URL.
    // This is the gate that prevents true duplicate payment submissions.
    if (sessionRef) {
      await sessionRef.set({ status: 'payment_initiated' }, { merge: true });
    }

    logger.info('[Checkout] Transaction initiated successfully', {
      userId,
      amount: serverCalculatedTotal,
      itemCount: validatedPayload.items.length,
      hasAuthorizationUrl: !!result.authorization_url,
      reference: result.reference,
      duration: Date.now() - checkoutStart,
    });

    return result;

  } catch (error: any) {
    logger.error('[Checkout Action] Critical error', { error: error.message, stack: error.stack, duration: Date.now() - checkoutStart });
    return { error: normalizeCheckoutError(error) };
  }
}
