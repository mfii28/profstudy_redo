'use server';

import { apiFetchServer } from '@/lib/api-client.server';

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
    await apiFetchServer('/api/v1/tutor/payout-details', {
      method: 'PATCH',
      body: JSON.stringify({
        payoutMethod: input.payoutMethod,
        bankName: input.bankName,
        bankAccountName: input.bankAccountName,
        accountNumber: input.accountNumber,
        momoNetwork: input.momoNetwork,
        payoutPhoneNumber: input.payoutPhoneNumber,
      }),
    });
    return {};
  } catch (err: any) {
    return { error: err?.message || 'Failed to save payout details.' };
  }
}
