'use client';

/**
 * @fileOverview Data service for site content (about page etc).
 * Routes through the Python backend REST API.
 */

import { apiFetch } from '@/lib/api-client';

export type PillarIconKey = 'Users' | 'BookOpen' | 'GraduationCap';
export type ValueIconKey = 'Target' | 'Award' | 'TrendingUp';

export interface PillarItem {
  iconKey: PillarIconKey;
  title: string;
  description: string;
  body?: string;
  number?: number;
}

export interface ValueItem {
  iconKey: ValueIconKey;
  title: string;
  description: string;
  body?: string;
  number?: number;
  label?: string;
  desc?: string;
}

export interface AboutContent {
  headline: string;
  subheadline: string;
  missionStatement: string;
  pillars: PillarItem[];
  values: ValueItem[];
}

export const defaultAboutContent: AboutContent = {
  headline: 'About Profs Training Solutions',
  subheadline: 'Empowering the next generation of finance and accounting professionals.',
  missionStatement: 'Our mission is to provide world-class training that bridges the gap between academic knowledge and professional practice.',
  pillars: [
    { iconKey: 'Users', title: 'Expert Instructors', description: 'Learn from industry professionals with years of experience.' },
    { iconKey: 'BookOpen', title: 'Comprehensive Curriculum', description: 'Structured courses covering everything you need to know.' },
    { iconKey: 'GraduationCap', title: 'Career Support', description: 'Guidance and resources to help you advance your career.' },
  ],
  values: [
    { iconKey: 'Target', title: 'Excellence', description: 'We strive for the highest quality in everything we do.' },
    { iconKey: 'Award', title: 'Integrity', description: 'We uphold the highest standards of professional ethics.' },
    { iconKey: 'TrendingUp', title: 'Innovation', description: 'We continuously evolve to meet the changing needs of the industry.' },
  ],
};

export const getAboutContent = async (): Promise<AboutContent> => {
  try {
    const res = await apiFetch('/settings/about');
    if (res.ok) {
      const data = await res.json();
      return data.content || defaultAboutContent;
    }
  } catch {
    // ignore
  }
  return defaultAboutContent;
};

// Home page content types
export type FeatureIconKey = 'BrainCircuit' | 'BookOpen' | 'CalendarCheck' | 'GraduationCap';

export interface FeatureItem {
  iconKey: FeatureIconKey;
  title: string;
  description: string;
  number?: number;
}

export interface QualificationPathItem {
  title: string;
  description: string;
  icon: string;
  steps: { label: string; description: string }[];
  code?: string;
  name?: string;
  subtitle?: string;
  available?: boolean;
}

export interface HomeContent {
  features: FeatureItem[];
  qualificationPath: QualificationPathItem[];
}

export const defaultHomeContent: HomeContent = {
  features: [
    { iconKey: 'BrainCircuit', title: 'AI-Powered Learning', description: 'Personalized study plans and adaptive practice.' },
    { iconKey: 'BookOpen', title: 'Expert-Curated Content', description: 'Comprehensive materials designed by professionals.' },
    { iconKey: 'CalendarCheck', title: 'Flexible Scheduling', description: 'Learn at your own pace with on-demand access.' },
    { iconKey: 'GraduationCap', title: 'Career Outcomes', description: 'Proven track record of student success and advancement.' },
  ],
  qualificationPath: [
    {
      title: 'ICAG Path',
      description: 'Chartered Accountancy qualification',
      icon: 'GraduationCap',
      steps: [
        { label: 'Level 1', description: 'Foundation in accounting principles' },
        { label: 'Level 2', description: 'Intermediate technical skills' },
        { label: 'Level 3', description: 'Advanced professional competence' },
      ],
    },
    {
      title: 'CITG Path',
      description: 'Chartered Institute of Tax Ghana',
      icon: 'BookOpen',
      steps: [
        { label: 'Foundation', description: 'Core tax principles' },
        { label: 'Intermediate', description: 'Applied tax knowledge' },
        { label: 'Advanced', description: 'Expert tax advisory' },
      ],
    },
  ],
};

export const saveHomeContent = async (content: HomeContent): Promise<void> => {
  await apiFetch('/settings/home', {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
};

export const saveAboutContent = async (content: Partial<AboutContent>): Promise<void> => {
  await apiFetch('/settings/about', {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
};

export const getHomeContent = async (): Promise<HomeContent> => {
  try {
    const res = await apiFetch('/settings/home');
    if (res.ok) {
      const data = await res.json();
      return data.content || defaultHomeContent;
    }
  } catch {
    // ignore
  }
  return defaultHomeContent;
};

