'use server';

import { apiFetchServer } from '@/lib/api-client.server';
import type { Payout, SubscriptionPlan, Order, BillingHistory, OrderStatus } from '@/lib/db';

export async function getPayoutsAction(): Promise<Payout[]> {
  try {
    const res = await apiFetchServer('/api/v1/admin/finance/payouts');
    return res.json();
  } catch {
    return [];
  }
}

export async function getPayoutsByTutorIdAction(tutorId: string): Promise<Payout[]> {
  if (!tutorId) return [];
  try {
    const res = await apiFetchServer(`/api/v1/admin/finance/payouts/tutor/${tutorId}`);
    return res.json();
  } catch {
    return [];
  }
}

export async function getSubscriptionPlansAction(): Promise<SubscriptionPlan[]> {
  try {
    const res = await apiFetchServer('/api/v1/admin/finance/subscription-plans');
    return res.json();
  } catch {
    return [];
  }
}

export async function saveSubscriptionPlanAction(plan: SubscriptionPlan): Promise<void> {
  await apiFetchServer('/api/v1/admin/finance/subscription-plans', {
    method: 'POST',
    body: JSON.stringify(plan),
  });
}

export async function deleteSubscriptionPlanAction(planId: string): Promise<void> {
  await apiFetchServer(`/api/v1/admin/finance/subscription-plans/${planId}`, {
    method: 'DELETE',
  });
}

export async function getOrdersAction(userId?: string): Promise<Order[]> {
  try {
    const query = userId ? `?user_id=${userId}` : '';
    const res = await apiFetchServer(`/api/v1/admin/finance/orders${query}`);
    return res.json();
  } catch {
    return [];
  }
}

export async function updateOrderStatusAction(orderId: string, status: OrderStatus): Promise<void> {
  await apiFetchServer(`/api/v1/admin/finance/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function getBillingHistoryAction(userId?: string): Promise<BillingHistory[]> {
  try {
    const orders = await getOrdersAction(userId);
    return orders.map(o => ({
      id: o.id,
      userId: o.userId,
      invoiceId: `INV-${o.id.substring(0, 8).toUpperCase()}`,
      date: (o as any).date,
      amount: (o as any).total,
      status: (o.status as any) === 'completed' ? 'Paid' : ((o.status as any) === 'failed' ? 'Failed' : 'Pending'),
      description: (o as any).items,
      paymentMethod: (o as any).paymentMethod || 'Paystack',
    })) as BillingHistory[];
  } catch {
    return [];
  }
}

export async function updatePayoutStatusAction(payoutId: string, status: Payout['status']): Promise<void> {
  await apiFetchServer(`/api/v1/admin/finance/payouts/${payoutId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function getCommissionSettingsAction(): Promise<{ defaultRate: number; overrides: any[] }> {
  try {
    const res = await apiFetchServer('/api/v1/admin/finance/commission-config');
    return res.json();
  } catch {
    return { defaultRate: 20, overrides: [] };
  }
}

export async function saveCommissionSettingsAction(settings: { defaultRate: number; overrides?: any[] }): Promise<void> {
  await apiFetchServer('/api/v1/admin/finance/commission-config', {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}
