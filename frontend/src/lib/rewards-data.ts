'use client';

import { collection, doc, setDoc, getDocs, query, where, runTransaction } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { ClaimedReward } from './db';

/**
 * @fileOverview Data service for Study Points and Rewards.
 */

export const getClaimedRewards = async (userId: string): Promise<ClaimedReward[]> => {
    if (!db || !userId) return [];
    const rewardsCollection = collection(db, 'claimedRewards');
    const q = query(rewardsCollection, where("userId", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as ClaimedReward);
};

/**
 * Atomic Reward Redemption
 * Deducts points from user profile and records the reward claim.
 */
export const redeemReward = async (userId: string, reward: { id: string, title: string, cost: number }): Promise<void> => {
    if (!db) return;

    const userRef = doc(db, 'users', userId);
    const claimId = `claim-${Date.now()}`;
    const claimRef = doc(db, 'claimedRewards', claimId);

    // Atomic transaction: read balance → validate → deduct → record claim
    await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('User not found.');

        const userData = userSnap.data();
        const enrollmentsCount = (userData.enrollments || []).length;
        const streak = userData.studyStreak || 0;
        const alreadySpent = userData.pointsSpent || 0;

        const earned  = (enrollmentsCount * 500) + (streak * 100);
        const balance = earned - alreadySpent;

        if (balance < reward.cost) {
            throw new Error(`Insufficient points. Balance: ${balance}, needed: ${reward.cost}.`);
        }

        const claimData: ClaimedReward = {
            id: claimId,
            userId,
            rewardId: reward.id,
            rewardTitle: reward.title,
            date: new Date().toISOString(),
            pointsSpent: reward.cost,
        };

        transaction.set(claimRef, claimData);
        transaction.update(userRef, { pointsSpent: alreadySpent + reward.cost });
    });
};
