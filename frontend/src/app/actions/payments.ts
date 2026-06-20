'use server';

/**
 * @fileOverview Next.js Proxy Server Actions for Paystack Payments.
 * Redirects payment initialization and verification to the FastAPI Python backend.
 */

export async function initializeTransaction(
  idToken: string,
  email: string,
  amount: number,
  metadata: any
) {
  try {
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/payments/initialize`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken || ''}`,
      },
      body: JSON.stringify({ email, amount, metadata }),
    });
    
    const data = await response.json();
    if (!response.ok) {
      return { error: data.detail || 'Failed to initialize transaction.' };
    }
    
    return data; // returns { authorization_url, reference }
  } catch (error: any) {
    console.error('[Payments Proxy] Init failed:', error);
    return { error: error.message || 'Payment service temporarily unavailable.' };
  }
}

export async function verifyTransaction(
  reference: string,
  expectedAmount?: number,
  idToken?: string
) {
  try {
    const queryParams = new URLSearchParams({ reference });
    if (expectedAmount !== undefined) {
      queryParams.append('expectedAmount', expectedAmount.toString());
    }
    
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/payments/verify?${queryParams.toString()}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken || ''}`,
      },
    });
    
    const data = await response.json();
    if (!response.ok) {
      return { success: false, message: data.detail || 'Transaction verification failed.' };
    }
    
    return data; // returns { success, amount, metadata, reference, orderId, courseIds }
  } catch (error: any) {
    console.error('[Payments Proxy] Verification failed:', error);
    return { success: false, message: error.message || 'Failed to verify transaction.' };
  }
}

export async function enrollFreeCourse(
  idToken: string,
  courseId: string
) {
  try {
    const prisma = (await import('@/lib/prisma')).default;
    return { success: true, courseId };
  } catch (err: any) {
    return { success: false, message: err.message || 'Free enrollment failed.' };
  }
}

export async function getPaystackSecretKey() {
  return process.env.PAYSTACK_SECRET_KEY || '';
}
