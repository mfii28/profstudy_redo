'use server';

import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase-server';
import type { Payout, SubscriptionPlan, Order, BillingHistory, OrderStatus } from '@/lib/db';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Authentication required');
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  const role = dbUser?.role || 'student';
  const isAdmin = ['admin', 'superadmin', 'subadmin'].includes(role);
  if (!isAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }
  return dbUser;
}

export async function getPayoutsAction(): Promise<Payout[]> {
  try {
    const payouts = await prisma.payout.findMany({
      orderBy: { date: 'desc' },
    });
    return payouts.map(p => ({
      id: p.id,
      tutorId: p.tutorId,
      date: p.date.toISOString(),
      amount: p.amount,
      method: p.method as any,
      status: p.status as any,
    })) as Payout[];
  } catch (error) {
    console.error('Error fetching payouts:', error);
    return [];
  }
}

export async function getPayoutsByTutorIdAction(tutorId: string): Promise<Payout[]> {
  if (!tutorId) return [];
  try {
    const payouts = await prisma.payout.findMany({
      where: { tutorId },
      orderBy: { date: 'desc' },
    });
    return payouts.map(p => ({
      id: p.id,
      tutorId: p.tutorId,
      date: p.date.toISOString(),
      amount: p.amount,
      method: p.method as any,
      status: p.status as any,
    })) as Payout[];
  } catch (error) {
    console.error('Error fetching tutor payouts:', error);
    return [];
  }
}

export async function getSubscriptionPlansAction(): Promise<SubscriptionPlan[]> {
  try {
    const record = await prisma.platformSettings.findUnique({
      where: { id: 'subscription-plans' }
    });
    if (record && record.settings) {
      return (record.settings as any).plans || [];
    }
    // Seed default plans
    const defaultPlans: SubscriptionPlan[] = [
      { id: 'plan-basic', name: 'Basic AI', price: '0', interval: 'month', activeSubscribers: 1200, features: ['Daily Chat', 'Basic Quizzes'] },
      { id: 'plan-premium', name: 'Premium AI', price: '25', interval: 'month', activeSubscribers: 450, features: ['Unlimited Chat', 'Unlimited Quizzes', 'Study Plans'] }
    ];
    await prisma.platformSettings.upsert({
      where: { id: 'subscription-plans' },
      update: { settings: { plans: defaultPlans } },
      create: { id: 'subscription-plans', settings: { plans: defaultPlans } }
    });
    return defaultPlans;
  } catch (error) {
    console.error('Error getting subscription plans:', error);
    return [];
  }
}

export async function saveSubscriptionPlanAction(plan: SubscriptionPlan): Promise<void> {
  await requireAdmin();
  try {
    const current = await getSubscriptionPlansAction();
    const index = current.findIndex(p => p.id === plan.id);
    if (index >= 0) {
      current[index] = plan;
    } else {
      current.push(plan);
    }
    await prisma.platformSettings.upsert({
      where: { id: 'subscription-plans' },
      update: { settings: { plans: current } },
      create: { id: 'subscription-plans', settings: { plans: current } }
    });
  } catch (error) {
    console.error('Error saving subscription plan:', error);
    throw new Error('Save failed');
  }
}

export async function deleteSubscriptionPlanAction(planId: string): Promise<void> {
  await requireAdmin();
  try {
    let current = await getSubscriptionPlansAction();
    current = current.filter(p => p.id !== planId);
    await prisma.platformSettings.upsert({
      where: { id: 'subscription-plans' },
      update: { settings: { plans: current } },
      create: { id: 'subscription-plans', settings: { plans: current } }
    });
  } catch (error) {
    console.error('Error deleting subscription plan:', error);
    throw new Error('Delete failed');
  }
}

export async function getOrdersAction(userId?: string): Promise<Order[]> {
  try {
    const whereClause = userId ? { userId } : {};
    const orders = await prisma.order.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          }
        }
      }
    });
    return orders.map(o => ({
      id: o.id,
      userId: o.userId,
      orderId: o.id,
      date: o.createdAt.toISOString(),
      total: o.amount,
      status: o.status as any,
      items: 'Course Enrollment', // default item description
      paymentReference: o.reference,
    })) as Order[];
  } catch (error) {
    console.error('Error fetching orders:', error);
    return [];
  }
}

export async function updateOrderStatusAction(orderId: string, status: OrderStatus): Promise<void> {
  await requireAdmin();
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    throw new Error('Update failed');
  }
}

export async function getBillingHistoryAction(userId?: string): Promise<BillingHistory[]> {
  try {
    const orders = await getOrdersAction(userId);
    return orders.map(o => ({
      id: o.id,
      userId: o.userId,
      invoiceId: `INV-${o.id.substring(0, 8).toUpperCase()}`,
      date: o.date,
      amount: o.total,
      status: (o.status as any) === 'completed' ? 'Paid' : ((o.status as any) === 'failed' ? 'Failed' : 'Pending'),
      description: o.items,
      paymentMethod: o.paymentMethod || 'Paystack',
    })) as BillingHistory[];
  } catch (error) {
    console.error('Error getting billing history:', error);
    return [];
  }
}

export async function updatePayoutStatusAction(payoutId: string, status: Payout['status']): Promise<void> {
  await requireAdmin();
  try {
    await prisma.payout.update({
      where: { id: payoutId },
      data: { status },
    });
  } catch (error) {
    console.error('Error updating payout status:', error);
    throw new Error('Update failed');
  }
}

export async function getCommissionSettingsAction(): Promise<{ defaultRate: number; overrides: any[] }> {
  try {
    const record = await prisma.platformSettings.findUnique({
      where: { id: 'commission-config' }
    });
    if (record && record.settings) {
      return record.settings as any;
    }
    return { defaultRate: 20, overrides: [] };
  } catch (error) {
    return { defaultRate: 20, overrides: [] };
  }
}

export async function saveCommissionSettingsAction(settings: { defaultRate: number; overrides?: any[] }): Promise<void> {
  await requireAdmin();
  try {
    await prisma.platformSettings.upsert({
      where: { id: 'commission-config' },
      update: { settings: settings as any },
      create: { id: 'commission-config', settings: settings as any }
    });
  } catch (error) {
    console.error('Error saving commission settings:', error);
    throw new Error('Save failed');
  }
}
