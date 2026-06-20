/**
 * Referral rewards as purchase discounts (no cash balance / withdrawals).
 * Referrer earns a percentage discount credit when a referred student completes a paid course checkout.
 */

export const DEFAULT_REFERRAL_REWARD_PERCENT = 5;
/** Maximum discount percent that can be stacked on the referrer's account. */
export const MAX_AFFILIATE_DISCOUNT_PERCENT = 50;

export type AffiliateDiscountHistoryEntry = {
  id: string;
  at: string;
  kind: 'referral_purchase' | 'discount_applied';
  percentDelta: number;
  paymentReference?: string;
  refereeUserId?: string;
  note?: string;
};

export type AffiliateDiscountRewards = {
  totalReferrals: number;
  discountPercentAvailable: number;
  history: AffiliateDiscountHistoryEntry[];
};

export function clampDiscountPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(Math.round(value * 100) / 100, MAX_AFFILIATE_DISCOUNT_PERCENT);
}

export function parseAffiliateRewards(raw: unknown): AffiliateDiscountRewards | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const discountPercentAvailable = clampDiscountPercent(Number(o.discountPercentAvailable) || 0);
  const totalReferrals = Math.max(0, Math.floor(Number(o.totalReferrals) || 0));
  const history = Array.isArray(o.history)
    ? (o.history as AffiliateDiscountHistoryEntry[]).filter((h) => h && typeof h.id === 'string')
    : [];
  return { totalReferrals, discountPercentAvailable, history };
}

/** Subtotal after percent-off (courses + products). */
export function applyPercentDiscountToSubtotal(subtotal: number, percentOff: number): number {
  const p = clampDiscountPercent(percentOff);
  if (p <= 0 || subtotal <= 0) return subtotal;
  const discounted = subtotal * (1 - p / 100);
  return Math.max(0, Math.round(discounted * 100) / 100);
}
