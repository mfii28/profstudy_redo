'use client';

/**
 * @fileOverview CMS data service for editable public site content.
 * Stores features, qualification path, pillars, and values in Firestore.
 * Fallback defaults are used when documents are absent.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebase/firestore';

// ─── Icon key types ─────────────────────────────────────────────────────────
// Icons are stored as string keys; resolved to components in render code.
export type FeatureIconKey = 'BrainCircuit' | 'BookOpen' | 'CalendarCheck' | 'GraduationCap';
export type PillarIconKey = 'Users' | 'BookOpen' | 'GraduationCap';
export type ValueIconKey = 'Target' | 'Award' | 'TrendingUp';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface FeatureItem {
  number: string;
  iconKey: FeatureIconKey;
  title: string;
  description: string;
}

export interface QualificationPathItem {
  code: string;
  name: string;
  subtitle: string;
  available: boolean;
}

export interface PillarItem {
  number: string;
  iconKey: PillarIconKey;
  title: string;
  body: string;
}

export interface ValueItem {
  iconKey: ValueIconKey;
  label: string;
  desc: string;
}

export interface HomeContent {
  features: FeatureItem[];
  qualificationPath: QualificationPathItem[];
}

export interface AboutContent {
  pillars: PillarItem[];
  values: ValueItem[];
}

// ─── Defaults ────────────────────────────────────────────────────────────────
export const defaultHomeContent: HomeContent = {
  features: [
    {
      number: '01',
      iconKey: 'BrainCircuit',
      title: 'AI-Powered Learning',
      description:
        'Personalised study plans, AI tutors, and adaptive quizzes that accelerate your exam preparation.',
    },
    {
      number: '02',
      iconKey: 'BookOpen',
      title: 'Expert-Led Courses',
      description:
        'Every course is taught by ICAG and CITG professionals with real-world practice experience.',
    },
    {
      number: '03',
      iconKey: 'CalendarCheck',
      title: 'Flexible Scheduling',
      description:
        'Study on-demand or join live sessions. Your pace, your schedule, no compromises.',
    },
    {
      number: '04',
      iconKey: 'GraduationCap',
      title: 'Verified Certifications',
      description:
        'Earn recognised certificates and build a portfolio that reflects your professional progress.',
    },
  ],
  qualificationPath: [
    { code: 'L1', name: 'ICAG Level 1', subtitle: 'Foundation', available: true },
    { code: 'L2', name: 'ICAG Level 2', subtitle: 'Intermediate', available: true },
    { code: 'L3', name: 'ICAG Level 3', subtitle: 'Advanced', available: false },
    { code: 'CITG', name: 'CITG', subtitle: 'Tax Professional', available: false },
  ],
};

export const defaultAboutContent: AboutContent = {
  pillars: [
    {
      number: '01',
      iconKey: 'Users',
      title: 'Expert Instructors',
      body: 'Learn from certified ICAG and CITG professionals with years of exam coaching and real-world practice experience.',
    },
    {
      number: '02',
      iconKey: 'BookOpen',
      title: 'Comprehensive Curriculum',
      body: 'Every course is meticulously mapped to the complete ICAG and CITG syllabi — nothing is left to chance.',
    },
    {
      number: '03',
      iconKey: 'GraduationCap',
      title: 'Career Advancement',
      body: 'We measure success by your results. From Level 1 to chartered status, we are with you at every step.',
    },
  ],
  values: [
    {
      iconKey: 'Target',
      label: 'Results-focused',
      desc: 'Everything we build is designed around one outcome: you passing your exams.',
    },
    {
      iconKey: 'Award',
      label: 'Exam Excellence',
      desc: 'Our instructors have first-class pass histories and deep paper knowledge.',
    },
    {
      iconKey: 'TrendingUp',
      label: 'Continuous Growth',
      desc: 'Courses evolve with every syllabus update so you are never behind.',
    },
  ],
};

// ─── Read helpers ─────────────────────────────────────────────────────────────
export async function getHomeContent(): Promise<HomeContent> {
  if (!db) return defaultHomeContent;
  try {
    const snap = await getDoc(doc(db, 'siteContent', 'home'));
    if (!snap.exists()) return defaultHomeContent;
    const data = snap.data() as Partial<HomeContent>;
    return {
      features: data.features?.length ? data.features : defaultHomeContent.features,
      qualificationPath: data.qualificationPath?.length
        ? data.qualificationPath
        : defaultHomeContent.qualificationPath,
    };
  } catch {
    return defaultHomeContent;
  }
}

export async function getAboutContent(): Promise<AboutContent> {
  if (!db) return defaultAboutContent;
  try {
    const snap = await getDoc(doc(db, 'siteContent', 'about'));
    if (!snap.exists()) return defaultAboutContent;
    const data = snap.data() as Partial<AboutContent>;
    return {
      pillars: data.pillars?.length ? data.pillars : defaultAboutContent.pillars,
      values: data.values?.length ? data.values : defaultAboutContent.values,
    };
  } catch {
    return defaultAboutContent;
  }
}

// ─── Write helpers ────────────────────────────────────────────────────────────
export async function saveHomeContent(content: HomeContent): Promise<void> {
  if (!db) throw new Error('Firestore not initialised');
  await setDoc(doc(db, 'siteContent', 'home'), content, { merge: true });
}

export async function saveAboutContent(content: AboutContent): Promise<void> {
  if (!db) throw new Error('Firestore not initialised');
  await setDoc(doc(db, 'siteContent', 'about'), content, { merge: true });
}
