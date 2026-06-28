'use client';

import { apiFetch } from '@/lib/api-client';

export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
};

export type UserBadge = {
  id: string;
  userId: string;
  badgeId: string;
  awardedAt: string;
};

export const BADGES: Badge[] = [];

export const getUserBadges = async (userId: string): Promise<UserBadge[]> => {
    try {
        const res = await apiFetch(`/gamification/badges?userId=${encodeURIComponent(userId)}`);
        if (!res.ok) return [];
        return (await res.json()).badges || [];
    } catch { return []; }
};

export const awardBadge = async (userId: string, badgeId: string): Promise<void> => {
    await apiFetch('/gamification/badges', {
        method: 'POST',
        body: JSON.stringify({ userId, badgeId }),
    });
};

export const getStudyPoints = (enrollmentsCount: number, streak: number): number => {
    return enrollmentsCount * 10 + streak * 5;
};
