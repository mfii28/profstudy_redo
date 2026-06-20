'use client';

import { collection, getDocs, query, where, doc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/firestore';

export type Badge = {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'streak' | 'academic' | 'community' | 'milestone';
  requirement: number;
};

export type UserBadge = {
  id: string;
  badgeId: string;
  userId: string;
  earnedAt: string;
};

// Pre-defined badges available in the system
export const BADGES: Badge[] = [
  { id: 'streak-3', title: '3-Day Streak', description: 'Study for 3 consecutive days.', icon: 'Flame', category: 'streak', requirement: 3 },
  { id: 'streak-7', title: 'Weekly Warrior', description: 'Study for 7 consecutive days.', icon: 'Flame', category: 'streak', requirement: 7 },
  { id: 'streak-30', title: 'Monthly Master', description: 'Study for 30 consecutive days.', icon: 'Flame', category: 'streak', requirement: 30 },
  { id: 'streak-100', title: 'Century Scholar', description: 'Study for 100 consecutive days.', icon: 'Crown', category: 'streak', requirement: 100 },
  { id: 'enroll-1', title: 'First Steps', description: 'Enroll in your first course.', icon: 'BookOpen', category: 'academic', requirement: 1 },
  { id: 'enroll-5', title: 'Knowledge Seeker', description: 'Enroll in 5 courses.', icon: 'BookOpen', category: 'academic', requirement: 5 },
  { id: 'enroll-10', title: 'Course Collector', description: 'Enroll in 10 courses.', icon: 'GraduationCap', category: 'academic', requirement: 10 },
  { id: 'points-1000', title: 'Rising Star', description: 'Earn 1,000 study points.', icon: 'Star', category: 'milestone', requirement: 1000 },
  { id: 'points-5000', title: 'Academic Elite', description: 'Earn 5,000 study points.', icon: 'Trophy', category: 'milestone', requirement: 5000 },
  { id: 'points-10000', title: 'Grandmaster', description: 'Earn 10,000 study points.', icon: 'Award', category: 'milestone', requirement: 10000 },
  { id: 'quiz-10', title: 'Quiz Enthusiast', description: 'Complete 10 AI quizzes.', icon: 'Zap', category: 'academic', requirement: 10 },
  { id: 'discussion-5', title: 'Active Contributor', description: 'Start 5 discussion threads.', icon: 'MessageSquare', category: 'community', requirement: 5 },
];

export const getUserBadges = async (userId: string): Promise<UserBadge[]> => {
  if (!db || !userId) return [];
  const badgesCollection = collection(db, 'userBadges');
  const q = query(badgesCollection, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserBadge));
};

export const awardBadge = async (userId: string, badgeId: string): Promise<void> => {
  if (!db || !userId) return;
  const docId = `${userId}_${badgeId}`;
  const badgeRef = doc(db, 'userBadges', docId);
  await setDoc(badgeRef, {
    badgeId,
    userId,
    earnedAt: new Date().toISOString(),
  }, { merge: true });
};

export const getStudyPoints = (enrollmentsCount: number, streak: number): number => {
  return (enrollmentsCount * 500) + (streak * 100);
};
