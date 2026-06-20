import crypto from 'crypto';
import { logger } from '@/lib/logging';
import {
  parsePaystackMetadata,
  shouldProcessPaystackEvent,
} from '@/lib/paystack-webhook';
import { fulfillPaystackPayment, PaymentFulfillmentError } from '@/lib/payment-fulfillment';
import { getPaystackSecretKey } from '@/app/actions/payments';
import { adminDb } from '@/firebase/admin';

/**
 * @fileOverview Paystack Webhook Handler with Idempotency
 * SECURITY: Verifies signatures with proper authentication
 * IDEMPOTENCY: Uses reference as key to prevent duplicate enrollments
 * TRANSACTION: Atomic state transitions for payment fulfillment
 */

export async function POST(req: Request) {
  let reference: string = 'unknown';
  const webhookStart = Date.now();
  
  try {
    const paystackSecretKey = await getPaystackSecretKey();
    if (!paystackSecretKey) {
      logger.error('[Paystack Webhook] Secret key not configured');
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await req.text();
    const signature = req.headers.get('x-paystack-signature');
    const contentType = req.headers.get('content-type');
    const userAgent = req.headers.get('user-agent');

    logger.info('[Paystack Webhook] Request received', {
      bodyLength: body.length,
      hasSignature: !!signature,
      contentType,
      userAgent,
      url: req.url,
    });

    if (!signature || !body) {
      logger.warn('[Paystack Webhook] Missing signature or body', {
        hasSignature: !!signature,
        hasBody: !!body,
        bodyLength: body?.length,
      });
      return new Response('Unauthorized', { status: 401 });
    }

    // SECURITY: Verify webhook signature
    const hash = crypto.createHmac('sha512', paystackSecretKey).update(body).digest('hex');
    const expectedSig = Buffer.from(hash, 'hex');
    const receivedSig = /^[a-fA-F0-9]+$/.test(signature) ? Buffer.from(signature, 'hex') : Buffer.alloc(0);
    const sigValid =
      expectedSig.length > 0 &&
      receivedSig.length > 0 &&
      expectedSig.length === receivedSig.length &&
      crypto.timingSafeEqual(expectedSig, receivedSig);

    logger.debug('[Paystack Webhook] Signature verification', {
      signatureLength: signature.length,
      expectedLength: expectedSig.length,
      receivedLength: receivedSig.length,
      valid: sigValid,
    });

    if (!sigValid) {
      logger.warn('[Paystack Webhook] Invalid signature — possible replay or misconfigured secret');
      return new Response('Unauthorized', { status: 401 });
    }

    let event: any;
    try {
      event = JSON.parse(body);
    } catch (parseErr: any) {
      logger.error('[Paystack Webhook] Failed to parse JSON body', { error: parseErr.message, body: body.slice(0, 500) });
      return new Response('Bad Request', { status: 400 });
    }

    reference = event.data?.reference || 'unknown';
    const eventType = event.event;

    logger.info('[Paystack Webhook] Event parsed', {
      eventType,
      reference,
      dataStatus: event.data?.status,
      dataAmount: event.data?.amount,
      dataCurrency: event.data?.currency,
      dataChannel: event.data?.channel,
      dataPaidAt: event.data?.paid_at,
      metadataUserId: event.data?.metadata?.userId,
      metadataCheckoutType: event.data?.metadata?.checkoutType,
      metadataItemCount: Array.isArray(event.data?.metadata?.items) ? event.data.metadata.items.length : 'N/A',
    });

    // Only process successful charges
    if (!shouldProcessPaystackEvent(eventType)) {
      logger.info('[Paystack Webhook] Ignoring non-charge.success event', {
        eventType,
        reference,
        expected: 'charge.success',
      });
      return new Response('OK', { status: 200 });
    }

    const data = event.data;
    if (data?.status !== 'success') {
      logger.warn('[Paystack Webhook] Ignoring non-success charge payload', {
        reference,
        status: data?.status,
        gatewayResponse: data?.gateway_response,
      });
      return new Response('OK', { status: 200 });
    }
    const metadata = parsePaystackMetadata(data.metadata);
    const userId = metadata?.userId;
    const paymentReference = String(data?.reference || '').trim();
    if (!paymentReference) {
      logger.warn('[Paystack Webhook] Missing payment reference in event data');
      return new Response('Bad Request', { status: 400 });
    }
    reference = paymentReference;

    if (!userId) {
      logger.warn('[Paystack Webhook] Missing userId in metadata', {
        reference,
        metadataKeys: Object.keys(metadata || {}),
      });
      return new Response('OK', { status: 200 });
    }

    logger.info('[Paystack Webhook] Processing payment', {
      reference,
      userId,
      amountKobo: data?.amount,
      currency: data?.currency,
      channel: data?.channel,
    });

    // EARLY IDEMPOTENCY CHECK: Verify payment hasn't already been processed
    // This prevents race conditions where multiple webhooks arrive concurrently
    const orderId = `ord-${paymentReference}`;
    const existingOrder = await adminDb.doc(`orders/${orderId}`).get();
    if (existingOrder.exists) {
      logger.info('[Paystack Webhook] Order already processed (idempotency skip)', {
        reference: paymentReference,
        orderId,
        duration: Date.now() - webhookStart,
      });
      return new Response('OK', { status: 200 });
    }

    await fulfillPaystackPayment({
      reference: paymentReference,
      amountKobo: Number(data?.amount || 0),
      currency: data?.currency,
      channel: data?.channel,
      metadata,
      source: 'webhook',
    });

    logger.info('[Paystack Webhook] Fulfillment complete', {
      reference,
      userId,
      duration: Date.now() - webhookStart,
    });

    return new Response('OK', { status: 200 });

  } catch (error: any) {
    if (error instanceof PaymentFulfillmentError) {
      logger.error('[Paystack Webhook] Fulfillment error', {
        reference,
        code: error.code,
        error: error.message,
      });
      if (error.code === 'INVALID_PAYMENT' || error.code === 'NOT_FOUND') {
        return new Response('Bad Request', { status: 400 });
      }
      return new Response('Retry', { status: 500 });
    }
    logger.error('[Paystack Webhook] Critical error', {
      reference,
      error: error.message,
      stack: error.stack,
    });
    // Return 500 so Paystack can retry transient/internal failures.
    return new Response('Internal Server Error', { status: 500 });
  }
}
