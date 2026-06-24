'use client';

import {
  getPayoutsAction,
  getPayoutsByTutorIdAction,
  getSubscriptionPlansAction,
  saveSubscriptionPlanAction,
  deleteSubscriptionPlanAction,
  getOrdersAction,
  updateOrderStatusAction,
  getBillingHistoryAction,
  updatePayoutStatusAction,
  getCommissionSettingsAction,
  saveCommissionSettingsAction,
} from '@/app/actions/finance';
import type { Payout, SubscriptionPlan, Order, BillingHistory, OrderStatus } from '@/lib/db';

export const getPayouts = async (): Promise<Payout[]> => {
  return getPayoutsAction();
};

export const getPayoutsByTutorId = async (tutorId: string): Promise<Payout[]> => {
  return getPayoutsByTutorIdAction(tutorId);
};

export const getSubscriptionPlans = async (): Promise<SubscriptionPlan[]> => {
  return getSubscriptionPlansAction();
};

export const saveSubscriptionPlan = (plan: SubscriptionPlan): void => {
  void saveSubscriptionPlanAction(plan);
};

export const deleteSubscriptionPlan = (planId: string): void => {
  void deleteSubscriptionPlanAction(planId);
};

export const getOrders = async (userId?: string): Promise<Order[]> => {
  return getOrdersAction(userId);
};

export const updateOrderStatus = (orderId: string, status: OrderStatus): void => {
  void updateOrderStatusAction(orderId, status);
};

export const getBillingHistory = async (userId?: string): Promise<BillingHistory[]> => {
  return getBillingHistoryAction(userId);
};

export const updatePayoutStatus = (payoutId: string, status: Payout['status']): void => {
  void updatePayoutStatusAction(payoutId, status);
};

export const getCommissionSettings = async () => {
  return getCommissionSettingsAction();
};

export const saveCommissionSettings = (settings: { defaultRate: number; overrides?: any[] }) => {
  void saveCommissionSettingsAction(settings);
};

