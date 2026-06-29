import { adminDb, FieldValue } from '@/firebase/admin';
import { sendTransactionalEmail } from '@/app/actions/email';
import { logger } from '@/lib/logging';
import { getPaymentCircuitBreaker } from '@/lib/distributed-rate-limit';
import type { Enrollment } from '@/lib/db';
import {
  getOrderDocumentId,
  parsePaystackMetadata,
  type RawCheckoutItem,
} from '@/lib/paystack-webhook';
import { enrollUserInCourses } from '@/lib/enrollment-manager';
import { v4 as uuidv4 } from 'uuid';
import { dispatchCommunication, logDispatchFailure } from '@/lib/communications';
import {
  DEFAULT_REFERRAL_REWARD_PERCENT,
  MAX_AFFILIATE_DISCOUNT_PERCENT,
  parseAffiliateRewards,
} from '@/lib/affiliate-discount';

function generateRequestId(): string {
  return `req-${Date.now()}-${uuidv4().slice(0, 8)}`;
}

export class PaymentFulfillmentError extends Error {
  code: 'INVALID_PAYMENT' | 'NOT_FOUND' | 'IN_PROGRESS' | 'VALIDATION_FAILED';

  constructor(message: string, code: 'INVALID_PAYMENT' | 'NOT_FOUND' | 'IN_PROGRESS' | 'VALIDATION_FAILED') {
    super(message);
    this.code = code;
  }
}

type FulfillmentSource = 'webhook' | 'verify';

type FulfillPaystackPaymentArgs = {
  reference: string;
  amountKobo: number;
  currency?: string;
  channel?: string;
  metadata: Record<string, unknown> | string | null | undefined;
  source: FulfillmentSource;
  requestId?: string;
};

type FulfillPaystackPaymentResult = {
  orderId: string;
  userId: string;
  courseIds: string[];
  alreadyFulfilled: boolean;
  requestId: string;
};

type CourseBookEntitlement = {
  courseId: string;
  bookId: string;
};

function uniqueCourseIds(items: RawCheckoutItem[]): string[] {
  return Array.from(
    new Set(items.filter((item) => item.type === 'course' && item.id).map((item) => String(item.id)))
  );
}

async function markIntent(reference: string, patch: Record<string, unknown>) {
  await adminDb.doc(`paymentIntents/${reference}`).set(patch, { merge: true });
}

async function markFulfillment(reference: string, patch: Record<string, unknown>) {
  await adminDb.doc(`paymentFulfillments/${reference}`).set(patch, { merge: true });
}

async function validatePaymentIntent(
  intentRef: FirebaseFirestore.DocumentReference,
  paymentReference: string,
  userId: string,
  amountKobo: number,
  normalizedCurrency: string,
  requestId: string
): Promise<void> {
  const intentSnap = await intentRef.get();
  
  if (!intentSnap.exists) {
    logger.warn('[Checkout Fulfillment] Payment intent not found - may be replay attack', {
      requestId,
      reference: paymentReference,
      userId,
    });
    throw new PaymentFulfillmentError(
      'Payment intent not found. Please complete payment from the checkout page.',
      'VALIDATION_FAILED'
    );
  }

  const intent = intentSnap.data() as {
    userId?: string;
    expectedAmountKobo?: number;
    currency?: string;
    status?: string;
  } | undefined;
  
  if (intent?.status === 'fulfilled' || intent?.status === 'failed') {
    logger.info('[Checkout Fulfillment] Payment intent already processed', {
      requestId,
      reference: paymentReference,
      status: intent.status,
    });
    throw new PaymentFulfillmentError(
      'This payment has already been processed.',
      'IN_PROGRESS'
    );
  }

  const expectedAmountKobo = Number(intent?.expectedAmountKobo || 0);
  const expectedCurrency = String(intent?.currency || 'GHS').toUpperCase();

  if (intent?.userId && intent.userId !== userId) {
    logger.error('[Checkout Fulfillment] User ID mismatch', {
      requestId,
      reference: paymentReference,
      expectedUserId: intent.userId,
      actualUserId: userId,
    });
    throw new PaymentFulfillmentError('Payment intent belongs to a different user.', 'INVALID_PAYMENT');
  }
  
  if (expectedAmountKobo > 0 && expectedAmountKobo !== amountKobo) {
    logger.error('[Checkout Fulfillment] Amount mismatch', {
      requestId,
      reference: paymentReference,
      expectedAmountKobo,
      actualAmountKobo: amountKobo,
    });
    throw new PaymentFulfillmentError('Payment amount does not match the initialized checkout.', 'INVALID_PAYMENT');
  }
  
  if (expectedCurrency !== normalizedCurrency) {
    logger.error('[Checkout Fulfillment] Currency mismatch', {
      requestId,
      reference: paymentReference,
      expectedCurrency,
      actualCurrency: normalizedCurrency,
    });
    throw new PaymentFulfillmentError('Payment currency does not match the initialized checkout.', 'INVALID_PAYMENT');
  }
}

export async function fulfillPaystackPayment({
  reference,
  amountKobo,
  currency,
  channel,
  metadata,
  source,
}: FulfillPaystackPaymentArgs): Promise<FulfillPaystackPaymentResult> {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  logger.info('[Checkout Fulfillment] Starting payment fulfillment', {
    requestId,
    reference,
    source,
  });

  const paymentReference = String(reference || '').trim();
  if (!paymentReference) {
    throw new PaymentFulfillmentError('Missing payment reference.', 'INVALID_PAYMENT');
  }

  const parsedMetadata = parsePaystackMetadata(metadata);
  const userId = typeof parsedMetadata.userId === 'string' ? parsedMetadata.userId : '';
  if (!userId) {
    throw new PaymentFulfillmentError('Missing userId in payment metadata.', 'INVALID_PAYMENT');
  }

  const normalizedCurrency = String(currency || 'GHS').toUpperCase();
  const orderId = getOrderDocumentId(paymentReference);
  const orderRef = adminDb.doc(`orders/${orderId}`);
  const intentRef = adminDb.doc(`paymentIntents/${paymentReference}`);
  const lockRef = adminDb.doc(`paymentFulfillments/${paymentReference}`);

  try {
    const circuitBreaker = await getPaymentCircuitBreaker();
    return await circuitBreaker.execute(async () => {
      const existingOrder = await orderRef.get();
      if (existingOrder.exists) {
        const existingData = existingOrder.data() as { userId?: string; courseIds?: string[] } | undefined;
        await markFulfillment(paymentReference, {
          status: 'completed',
          completedAt: new Date().toISOString(),
          orderId,
          userId: existingData?.userId || userId,
          source,
          requestId,
        });
        await markIntent(paymentReference, {
          status: 'fulfilled',
          fulfilledAt: new Date().toISOString(),
          orderId,
          source,
          requestId,
        });
        
        const duration = Date.now() - startTime;
        logger.info('[Checkout Fulfillment] Order already exists (idempotency skip)', {
          requestId,
          reference: paymentReference,
          orderId,
          duration,
        });
        
        return {
          orderId,
          userId: existingData?.userId || userId,
          courseIds: Array.isArray(existingData?.courseIds) ? existingData.courseIds : [],
          alreadyFulfilled: true,
          requestId,
        };
      }

      await validatePaymentIntent(
        intentRef,
        paymentReference,
        userId,
        amountKobo,
        normalizedCurrency,
        requestId
      );

      let lockAcquired = false;

      try {
        try {
          await lockRef.create({
            reference: paymentReference,
            source,
            status: 'processing',
            startedAt: new Date().toISOString(),
            requestId,
          });
          lockAcquired = true;
        } catch (lockError: any) {
          const existingLock = await lockRef.get();
          const lockStatus = existingLock.data()?.status;
          
          if (lockStatus === 'completed') {
            const completedOrder = await orderRef.get();
            const completedData = completedOrder.data() as { userId?: string; courseIds?: string[] } | undefined;
            
            logger.info('[Checkout Fulfillment] Lock shows completed, returning existing order', {
              requestId,
              reference: paymentReference,
              lockStatus,
            });
            
            return {
              orderId,
              userId: completedData?.userId || userId,
              courseIds: Array.isArray(completedData?.courseIds) ? completedData.courseIds : [],
              alreadyFulfilled: true,
              requestId,
            };
          }
          
          logger.warn('[Checkout Fulfillment] Payment already in progress', {
            requestId,
            reference: paymentReference,
            lockStatus,
          });
          throw new PaymentFulfillmentError('Payment fulfillment is already in progress.', 'IN_PROGRESS');
        }

        const userRef = adminDb.doc(`users/${userId}`);
        const userSnap = await userRef.get();
        const userData = userSnap.data() as {
          email?: string;
          name?: string;
          phone_number?: string;
          enrollments?: Enrollment[];
          referredBy?: string;
        } | undefined;

        if (!userData) {
          throw new PaymentFulfillmentError('User profile not found for payment fulfillment.', 'NOT_FOUND');
        }

        const items: RawCheckoutItem[] = Array.isArray(parsedMetadata.items) ? parsedMetadata.items : [];
        const itemNamesFromMetadata = items.map((item) => item.title).filter(Boolean).join(', ');
        const paymentAmount = amountKobo / 100;
        const purchasedCourseIds = uniqueCourseIds(items);
        const courseBookEntitlements: CourseBookEntitlement[] = items
          .filter((item) => item.type === 'course' && (item as any).coursePurchaseOption === 'course_with_book')
          .map((item) => ({
            courseId: String(item.id || ''),
            bookId: String((item as any).attachedBookId || ''),
          }))
          .filter((entry) => entry.courseId && entry.bookId);
        let orderStatus: 'Delivered' | 'Preparing to Ship' = 'Delivered';
        let orderItemLabel = itemNamesFromMetadata || 'Marketplace Item';

        if (parsedMetadata.checkoutType === 'cart_purchase') {
          const courseItems = items.filter((item) => item.type === 'course');
          const hasPhysicalProducts = items.some((item) => item.type === 'product');

          if (hasPhysicalProducts) {
            orderStatus = 'Preparing to Ship';
          }

          if (courseItems.length > 0) {
            const nowIso = new Date().toISOString();
            const courseIds = courseItems.map((item) => item.id).filter(Boolean) as string[];

            const { enrolledCount, failedCount, results } = await enrollUserInCourses(
              userId,
              courseIds,
              { source: 'paystack', requestId }
            );

            if (enrolledCount > 0) {
              await userRef.update({ lastPurchaseDate: nowIso });
            }

            if (failedCount > 0) {
              logger.warn('[Checkout Fulfillment] Partial enrollment failure', {
                requestId,
                userId,
                failed: results.filter((r) => !r.success),
              });
            }
          }

          const courseItemsForReferral = items.filter((item) => item.type === 'course');
          const affiliatePercentApplied = Math.min(
            MAX_AFFILIATE_DISCOUNT_PERCENT,
            Math.max(0, Number(parsedMetadata.affiliateDiscountPercentApplied) || 0)
          );

          if (affiliatePercentApplied > 0) {
            const useRef = adminDb.doc(`affiliateDiscountUses/${paymentReference}`);
            let discountDebitRecorded = false;
            try {
              await useRef.create({
                userId,
                percent: affiliatePercentApplied,
                createdAt: new Date().toISOString(),
              });
              discountDebitRecorded = true;
            } catch {
              logger.info('[Checkout Fulfillment] Affiliate discount use already recorded', {
                requestId,
                reference: paymentReference,
              });
            }
            if (discountDebitRecorded) {
              const parsedRewards = parseAffiliateRewards(
                (userSnap.data() as { affiliateDiscountRewards?: unknown } | undefined)?.affiliateDiscountRewards
              );
              const currentAvail = parsedRewards?.discountPercentAvailable ?? 0;
              const nextAvail = Math.max(0, currentAvail - affiliatePercentApplied);
              const priorHistory = parsedRewards?.history ?? [];
              try {
                await userRef.update({
                  affiliateDiscountRewards: {
                    totalReferrals: parsedRewards?.totalReferrals ?? 0,
                    discountPercentAvailable: nextAvail,
                    history: [
                      ...priorHistory,
                      {
                        id: `use-${paymentReference}`,
                        at: new Date().toISOString(),
                        kind: 'discount_applied',
                        percentDelta: -affiliatePercentApplied,
                        paymentReference,
                        note: 'Checkout discount applied',
                      },
                    ].slice(-80),
                  },
                });
              } catch (err: unknown) {
                logger.warn('[Checkout Fulfillment] Failed to persist discount debit on user', {
                  requestId,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            }
          }

          if (userData.referredBy && paymentAmount > 0 && courseItemsForReferral.length > 0) {
            const rewardRef = adminDb.doc(`affiliateReferralRewards/${paymentReference}`);
            let referralGrantRecorded = false;
            try {
              await rewardRef.create({
                referrerId: userData.referredBy,
                refereeId: userId,
                reference: paymentReference,
                createdAt: new Date().toISOString(),
                percentGranted: DEFAULT_REFERRAL_REWARD_PERCENT,
              });
              referralGrantRecorded = true;
            } catch {
              logger.info('[Checkout Fulfillment] Referral reward already granted', {
                requestId,
                reference: paymentReference,
              });
            }
            if (referralGrantRecorded) {
              try {
                const referrerRef = adminDb.doc(`users/${userData.referredBy}`);
                await adminDb.runTransaction(async (tx) => {
                  const refSnap = await tx.get(referrerRef);
                  if (!refSnap.exists) return;
                  const rd = refSnap.data() as { affiliateDiscountRewards?: unknown } | undefined;
                  const rewards = parseAffiliateRewards(rd?.affiliateDiscountRewards) ?? {
                    totalReferrals: 0,
                    discountPercentAvailable: 0,
                    history: [],
                  };
                  const nextPercent = Math.min(
                    MAX_AFFILIATE_DISCOUNT_PERCENT,
                    rewards.discountPercentAvailable + DEFAULT_REFERRAL_REWARD_PERCENT
                  );
                  const history = [
                    ...rewards.history,
                    {
                      id: `earn-${paymentReference}`,
                      at: new Date().toISOString(),
                      kind: 'referral_purchase' as const,
                      percentDelta: DEFAULT_REFERRAL_REWARD_PERCENT,
                      paymentReference,
                      refereeUserId: userId,
                      note: `Referral purchased courses (+${DEFAULT_REFERRAL_REWARD_PERCENT}% toward next purchase)`,
                    },
                  ].slice(-80);
                  tx.update(referrerRef, {
                    affiliateDiscountRewards: {
                      totalReferrals: rewards.totalReferrals + 1,
                      discountPercentAvailable: nextPercent,
                      history,
                    },
                  });
                });
              } catch (err: unknown) {
                logger.warn('[Checkout Fulfillment] Referrer discount credit failed', {
                  requestId,
                  error: err instanceof Error ? err.message : String(err),
                });
              }
            }
          }
        }

        if (parsedMetadata.checkoutType === 'book_purchase') {
          const bookId = typeof parsedMetadata.bookId === 'string' ? parsedMetadata.bookId : undefined;
          const bookTitle = typeof parsedMetadata.bookTitle === 'string' ? parsedMetadata.bookTitle : undefined;
          const bookType = parsedMetadata.bookType === 'digital' || parsedMetadata.bookType === 'physical'
            ? parsedMetadata.bookType
            : undefined;

          if (bookId && bookType) {
            const nowIso = new Date().toISOString();
            const datePart = nowIso.slice(0, 10).replace(/-/g, '');
            const refSuffix = paymentReference.slice(-6).toUpperCase();
            const orderReference = `BKO-${datePart}-${refSuffix}`;
            const receiptCode = `REC-${paymentReference.slice(-8).toUpperCase()}`;
            const trackingReference = bookType === 'physical'
              ? `TRK-${paymentReference.slice(-8).toUpperCase()}`
              : undefined;

            await adminDb.doc(`bookPurchases/bp-${paymentReference}`).set({
              id: `bp-${paymentReference}`,
              userId,
              bookId,
              bookTitle: bookTitle || 'Book',
              bookType,
              amount: paymentAmount,
              purchasedAt: nowIso,
              paymentReference,
              orderReference,
              receiptCode,
              ...(bookType === 'physical' && {
                deliveryStatus: 'Processing',
                shippingAddress: parsedMetadata.shippingAddress || null,
                trackingReference,
              }),
              createdAt: FieldValue.serverTimestamp(),
            }, { merge: true });

            if (bookType === 'physical') {
              orderStatus = 'Preparing to Ship';
            }

            orderItemLabel = bookTitle || 'Book Purchase';
          }
        }

        await orderRef.set({
          userId,
          orderId: paymentReference,
          date: new Date().toISOString(),
          total: paymentAmount,
          status: orderStatus,
          items: orderItemLabel,
          paymentMethod: channel || 'Card',
          paymentReference,
          shippingAddress: parsedMetadata.shippingAddress || null,
          courseIds: purchasedCourseIds,
          courseBookEntitlements,
          requestId,
          createdAt: FieldValue.serverTimestamp(),
        });

        await markFulfillment(paymentReference, {
          status: 'completed',
          completedAt: new Date().toISOString(),
          orderId,
          userId,
          source,
          requestId,
        });
        await markIntent(paymentReference, {
          status: 'fulfilled',
          fulfilledAt: new Date().toISOString(),
          orderId,
          source,
          requestId,
        });

        if (parsedMetadata.checkoutType === 'cart_purchase') {
          try {
            const cartRef = adminDb.collection(`users/${userId}/cart`);
            const cartSnapshot = await cartRef.get();
            if (!cartSnapshot.empty) {
              const batch = adminDb.batch();
              cartSnapshot.docs.forEach((cartDoc) => batch.delete(cartDoc.ref));
              await batch.commit();
              logger.info('[Checkout Fulfillment] Cart cleared successfully', {
                requestId,
                userId,
                itemCount: cartSnapshot.docs.length,
              });
            }
          } catch (cartError: any) {
            logger.error('[Checkout Fulfillment] Cart clearing failed after successful payment', {
              requestId,
              userId,
              orderId,
              error: cartError?.message,
              code: cartError?.code,
            });
            const auditLogId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            await adminDb.doc(`auditLogs/${auditLogId}`).set({
              actorId: 'system',
              actorName: 'Payment Fulfillment',
              action: 'CART_CLEAR_FAILED',
              targetId: userId,
              targetType: 'user',
              severity: 'warn',
              details: JSON.stringify({
                orderId,
                error: cartError?.message,
                manualActionRequired: 'User may still have items in cart after successful payment',
              }),
              timestamp: new Date().toISOString(),
            }).catch(() => {});
          }
        }

        // Collect notification promises so they complete before returning
        const notificationPromises: Promise<any>[] = [];

        if (userData.email) {
          const emailPromise = sendTransactionalEmail({
            type: 'enrollment',
            to: userData.email,
            recipientName: userData.name || 'Student',
            items: orderItemLabel,
            orderId: paymentReference,
            amount: paymentAmount,
            internalSecret: process.env.INTERNAL_EMAIL_SECRET,
          }).then((result) => {
            if (result.error) {
              logger.warn('[Checkout Fulfillment] Enrollment email failed', { 
                requestId, 
                userId, 
                error: result.error 
              });
            }
          }).catch((error) => {
            logger.warn('[Checkout Fulfillment] Enrollment email threw', { 
              requestId, 
              userId, 
              error: error?.message 
            });
          });
          notificationPromises.push(emailPromise);
        }

        if (userData.phone_number) {
          const sms1Promise = dispatchCommunication({
            eventKey: 'course_purchase',
            userId,
            phoneNumber: userData.phone_number,
            email: userData.email,
            title: 'Course purchase confirmed',
            message: `Purchase confirmed for ${orderItemLabel}. Order: ${paymentReference}.`,
            metadata: {
              order_id: paymentReference,
              course_name: orderItemLabel,
              payment_amount: `GHS ${paymentAmount.toFixed(2)}`,
              user_name: userData.name || 'Student',
            },
          }).catch(() => undefined);
          notificationPromises.push(sms1Promise);

          const sms2Promise = dispatchCommunication({
            eventKey: 'payment_confirmation',
            userId,
            phoneNumber: userData.phone_number,
            email: userData.email,
            title: 'Payment confirmation',
            message: `Payment successful. Amount: GHS ${paymentAmount.toFixed(2)}. Ref: ${paymentReference}.`,
            metadata: {
              order_id: paymentReference,
              payment_amount: `GHS ${paymentAmount.toFixed(2)}`,
              course_name: orderItemLabel,
              user_name: userData.name || 'Student',
              checkoutType: parsedMetadata.checkoutType || 'unknown',
            },
          }).catch((error) =>
            logDispatchFailure('payment-confirmation', error, { userId, eventKey: 'payment_confirmation' })
          );
          notificationPromises.push(sms2Promise);
        }

        const duration = Date.now() - startTime;
        logger.info('[Checkout Fulfillment] Order processed successfully', {
          requestId,
          source,
          orderId,
          userId,
          amount: paymentAmount,
          itemCount: items.length,
          duration,
        });

        // Await notifications so serverless function doesn't terminate early
        await Promise.all(notificationPromises);

        return {
          orderId,
          userId,
          courseIds: purchasedCourseIds,
          alreadyFulfilled: false,
          requestId,
        };
      } catch (error) {
        if (lockAcquired) {
          await lockRef.delete().catch(() => undefined);
        }
        await markIntent(paymentReference, {
          status: 'failed',
          lastError: error instanceof Error ? error.message : String(error),
          failedAt: new Date().toISOString(),
          source,
          requestId,
        }).catch(() => undefined);
        throw error;
      }
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('[Checkout Fulfillment] Critical error', {
      requestId,
      reference: paymentReference,
      error: error instanceof Error ? error.message : String(error),
      duration,
    });
    throw error;
  }
}