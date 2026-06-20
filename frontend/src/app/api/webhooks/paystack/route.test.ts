import crypto from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockDocRef = {
  path: string;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

type MockCollectionRef = {
  path: string;
  get: ReturnType<typeof vi.fn>;
};

const adminMocks = vi.hoisted(() => {
  const docRefs = new Map<string, MockDocRef>();
  const collectionRefs = new Map<string, MockCollectionRef>();
  const docGetHandlers = new Map<string, () => any>();
  const collectionGetHandlers = new Map<string, () => any>();

  const batchDelete = vi.fn();
  const batchCommit = vi.fn(async () => undefined);

  const adminDb = {
    doc: vi.fn((path: string) => {
      if (!docRefs.has(path)) {
        docRefs.set(path, {
          path,
          get: vi.fn(async () => {
            const handler = docGetHandlers.get(path);
            if (handler) return handler();
            return { exists: false, data: () => undefined };
          }),
          set: vi.fn(async () => undefined),
          update: vi.fn(async () => undefined),
          create: vi.fn(async () => undefined),
          delete: vi.fn(async () => undefined),
        });
      }
      return docRefs.get(path)!;
    }),
    collection: vi.fn((path: string) => {
      if (!collectionRefs.has(path)) {
        collectionRefs.set(path, {
          path,
          get: vi.fn(async () => {
            const handler = collectionGetHandlers.get(path);
            if (handler) return handler();
            return { empty: true, docs: [] };
          }),
        });
      }
      return collectionRefs.get(path)!;
    }),
    batch: vi.fn(() => ({
      delete: batchDelete,
      commit: batchCommit,
    })),
  };

  const FieldValue = {
    arrayUnion: vi.fn((...args: unknown[]) => ({ __op: 'arrayUnion', args })),
    increment: vi.fn((value: number) => ({ __op: 'increment', value })),
    serverTimestamp: vi.fn(() => ({ __op: 'serverTimestamp' })),
  };

  return {
    adminDb,
    FieldValue,
    docRefs,
    collectionRefs,
    docGetHandlers,
    collectionGetHandlers,
    batchDelete,
    batchCommit,
  };
});

const emailMocks = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(async () => ({ success: true })),
}));

const paymentMocks = vi.hoisted(() => ({
  fulfillPaystackPayment: vi.fn(async () => undefined),
}));

const loggerMocks = vi.hoisted(() => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/firebase/admin', () => ({
  adminDb: adminMocks.adminDb,
  FieldValue: adminMocks.FieldValue,
}));

vi.mock('@/app/actions/email', () => ({
  sendTransactionalEmail: emailMocks.sendTransactionalEmail,
}));

vi.mock('@/lib/logging', () => loggerMocks);

vi.mock('@/lib/payment-fulfillment', () => ({
  fulfillPaystackPayment: paymentMocks.fulfillPaystackPayment,
  PaymentFulfillmentError: class PaymentFulfillmentError extends Error {
    code = 'FULFILLMENT_FAILED';
  },
}));

import { POST } from './route';

function buildSignedRequest(payload: Record<string, unknown>, secret = 'unit_test_secret') {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha512', secret).update(body).digest('hex');

  return new Request('http://localhost/api/webhooks/paystack', {
    method: 'POST',
    headers: {
      'x-paystack-signature': signature,
      'content-type': 'application/json',
    },
    body,
  });
}

describe('paystack webhook route', () => {
  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = 'unit_test_secret';
    vi.clearAllMocks();

    adminMocks.docRefs.clear();
    adminMocks.collectionRefs.clear();
    adminMocks.docGetHandlers.clear();
    adminMocks.collectionGetHandlers.clear();
  });

  it('returns 401 for invalid webhook signature', async () => {
    const request = new Request('http://localhost/api/webhooks/paystack', {
      method: 'POST',
      headers: {
        'x-paystack-signature': 'invalid',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ event: 'charge.success', data: { reference: 'ref-1' } }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('short-circuits when order is already processed (idempotency)', async () => {
    const reference = 'ref-already';
    adminMocks.docGetHandlers.set(`orders/ord-${reference}`, () => ({
      exists: true,
      data: () => ({ orderId: reference }),
    }));

    const request = buildSignedRequest({
      event: 'charge.success',
      data: {
        reference,
        status: 'success',
        amount: 10000,
        metadata: { userId: 'user-1', checkoutType: 'cart_purchase', items: [] },
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(adminMocks.adminDb.doc).toHaveBeenCalledWith(`orders/ord-${reference}`);
    expect(adminMocks.adminDb.doc).not.toHaveBeenCalledWith('users/user-1');
  });

  it('returns 200 and exits when metadata is missing userId', async () => {
    const request = buildSignedRequest({
      event: 'charge.success',
      data: {
        reference: 'ref-no-user',
        status: 'success',
        amount: 12000,
        metadata: { checkoutType: 'cart_purchase', items: [] },
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(adminMocks.adminDb.doc).not.toHaveBeenCalled();
  });

  it('processes a cart purchase and delegates fulfillment', async () => {
    const reference = 'ref-success';
    const userId = 'user-123';

    adminMocks.docGetHandlers.set(`orders/ord-${reference}`, () => ({
      exists: false,
      data: () => undefined,
    }));

    const request = buildSignedRequest({
      event: 'charge.success',
      data: {
        reference,
        status: 'success',
        amount: 15000,
        channel: 'card',
        currency: 'GHS',
        metadata: {
          userId,
          checkoutType: 'cart_purchase',
          items: [
            { id: 'course-1', title: 'Course One', type: 'course' },
            { id: 'course-2', title: 'Course Two Existing', type: 'course' },
          ],
        },
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(paymentMocks.fulfillPaystackPayment).toHaveBeenCalledTimes(1);
    expect(paymentMocks.fulfillPaystackPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        reference,
        amountKobo: 15000,
        source: 'webhook',
      })
    );
  });
});
