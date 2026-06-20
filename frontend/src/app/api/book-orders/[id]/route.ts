import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/firebase/admin';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

async function getAdminUid(req: NextRequest): Promise<string | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const userSnap = await adminDb.doc(`users/${decoded.uid}`).get();
    if (!userSnap.exists) return null;

    const role = userSnap.data()?.role as string | undefined;
    if (!role || !['admin', 'superadmin', 'subadmin'].includes(role)) return null;
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUid = await getAdminUid(req);
  if (!adminUid) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const payload = await req.json();
    const deliveryStatus = payload.deliveryStatus as string | undefined;
    const trackingReference = payload.trackingReference as string | undefined;

    const allowedStatuses = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (deliveryStatus && !allowedStatuses.includes(deliveryStatus)) {
      return NextResponse.json({ error: 'Invalid delivery status.' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
      updatedBy: adminUid,
    };

    if (deliveryStatus) updates.deliveryStatus = deliveryStatus;
    if (trackingReference) updates.trackingReference = trackingReference;

    const purchaseRef = adminDb.doc(`bookPurchases/${id}`);
    await purchaseRef.set(updates, { merge: true });

    // Keep aggregate `orders` status in sync for dashboards that rely on it.
    if (deliveryStatus) {
      const purchaseSnap = await purchaseRef.get();
      const paymentReference = purchaseSnap.exists ? purchaseSnap.data()?.paymentReference : undefined;
      if (paymentReference) {
        const orderRef = adminDb.doc(`orders/ord-${paymentReference}`);
        await orderRef.set({ status: deliveryStatus, updatedAt: new Date().toISOString() }, { merge: true });
      }
    }

    const updated = await adminDb.doc(`bookPurchases/${id}`).get();
    return NextResponse.json({ order: { id: updated.id, ...updated.data() } });
  } catch {
    return NextResponse.json({ error: 'Failed to update book order.' }, { status: 500 });
  }
}
