'use server';

import { adminDb, adminAuth } from '@/firebase/admin';
import type { TutorDetails } from '@/lib/db';

type PayoutMethod = 'bank' | 'momo';
type MomoNetwork = 'MTN' | 'Vodafone' | 'AirtelTigo';

type SavePayoutDetailsInput = {
  idToken: string;
  payoutMethod: PayoutMethod;
  bankName?: string;
  bankAccountName?: string;
  accountNumber?: string;
  momoNetwork?: MomoNetwork;
  payoutPhoneNumber?: string;
};

export async function savePayoutDetails(input: SavePayoutDetailsInput): Promise<{ error?: string }> {
  try {
    const decoded = await adminAuth.verifyIdToken(input.idToken);
    const uid = decoded.uid;

    const userDoc = await adminDb.doc(`users/${uid}`).get();
    if (!userDoc.exists) {
      return { error: 'User not found.' };
    }

    const userData = userDoc.data() as { role?: string };
    if (!['tutor', 'admin', 'superadmin', 'subadmin'].includes(userData?.role || '')) {
      return { error: 'Only tutors can update payout details.' };
    }

    const updates: Record<string, any> = {
      'tutorDetails.payoutMethod': input.payoutMethod,
    };

    if (input.payoutMethod === 'bank') {
      updates['tutorDetails.bankName'] = input.bankName?.trim() || null;
      updates['tutorDetails.bankAccountName'] = input.bankAccountName?.trim() || null;
      updates['tutorDetails.accountNumber'] = input.accountNumber?.trim() || null;
      updates['tutorDetails.momoNetwork'] = null;
      updates['tutorDetails.payoutPhoneNumber'] = null;
      updates['tutorDetails.momoNumber'] = null;
    } else {
      updates['tutorDetails.momoNetwork'] = input.momoNetwork || null;
      updates['tutorDetails.payoutPhoneNumber'] = input.payoutPhoneNumber?.trim() || null;
      updates['tutorDetails.momoNumber'] = input.payoutPhoneNumber?.trim() || null;
      updates['tutorDetails.bankName'] = null;
      updates['tutorDetails.bankAccountName'] = null;
      updates['tutorDetails.accountNumber'] = null;
    }

    await adminDb.doc(`users/${uid}`).update(updates);
    return {};
  } catch (err: any) {
    console.error('[savePayoutDetails]', err?.message);
    return { error: err?.message || 'Failed to save payout details.' };
  }
}
