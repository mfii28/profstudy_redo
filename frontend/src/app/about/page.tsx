'use client';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { motion } from 'framer-motion';
import { Users, BookOpen, GraduationCap, Target, Award, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getGlobalSettings, defaultGlobalSettings } from '@/lib/platform-settings-data';
import {
  getAboutContent,
  defaultAboutContent,
  type PillarItem,
  type ValueItem,
  type PillarIconKey,
  type ValueIconKey,
} from '@/lib/site-content-data';
import { type GlobalSettings } from '@/lib/db';

const PILLAR_ICON_MAP: Record<PillarIconKey, React.ComponentType<{ className?: string }>> = {
  Users,
  BookOpen,
  GraduationCap,
};

const VALUE_ICON_MAP: Record<ValueIconKey, React.ComponentType<{ className?: string }>> = {
  Target,
  Award,
  TrendingUp,
};

type PublicStats = {
  activeStudents: number;
  averageRating: number;
  expertCourses: number;
  engagementRate: number;
  qualifiedStudents: number;
};


export default function AboutPage() {
  const [settings, setSettings] = useState<GlobalSettings>(defaultGlobalSettings);
  const [pillars, setPillars] = useState<PillarItem[]>(defaultAboutContent.pillars);
  const [values, setValues] = useState<ValueItem[]>(defaultAboutContent.values);
  const [publicStats, setPublicStats] = useState<PublicStats>({
    activeStudents: 0,
    averageRating: 0,
    expertCourses: 0,
    engagementRate: 0,
    qualifiedStudents: 0,
  });

  useEffect(() => {
    getGlobalSettings().then(setSettings);
    getAboutContent().then(content => {
      setPillars(content.pillars);
      setValues(content.values);
    }).catch(() => { /* keep defaults */ });

    const fetchPublicStats = async () => {
      try {
        const res = await fetch('/api/public/stats', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (!json?.stats) return;
        setPublicStats({
          activeStudents: Number(json.stats.activeStudents || 0),
          averageRating: Number(json.stats.averageRating || 0),
          expertCourses: Number(json.stats.expertCourses || 0),
          engagementRate: Number(json.stats.engagementRate || 0),
          qualifiedStudents: Number(json.stats.qualifiedStudents || 0),
        });
      } catch {
        // Keep static layout even if metrics endpoint is down.
      }
    };

    void fetchPublicStats();
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">

        {/* Hero */}
        <section className="bg-primary text-primary-foreground overflow-hidden">
          <div className="page-container hero-pad">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-3xl"
            >
              <div className="mb-8 flex items-center gap-3">
                <span className="h-px w-10 bg-accent" aria-hidden />
                <span className="section-label !mb-0">Our Story</span>
              </div>
              <h1 className="font-headline font-black text-[clamp(2.5rem,5vw,4rem)] leading-[1.02] tracking-tight">
                About {settings.siteName}
              </h1>
              <p className="mt-6 text-lg text-primary-foreground/70 max-w-[52ch] leading-relaxed">
                {settings.siteDescription} We are on a mission to make professional accounting education accessible, effective, and results-driven — powered by expert tutors and modern learning technology.
              </p>
            </motion.div>

            {/* Stat bar */}
            <div className="mt-16 pt-12 border-t border-primary-foreground/10 grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: `${publicStats.qualifiedStudents.toLocaleString()}+`, label: 'Students Enrolled' },
                { value: `${publicStats.engagementRate}%`, label: 'Learner Engagement' },
                { value: `${publicStats.expertCourses.toLocaleString()}+`, label: 'Expert Courses' },
                { value: publicStats.averageRating > 0 ? `${publicStats.averageRating.toFixed(1)}★` : '—', label: 'Average Rating' },
              ].map((s) => (
                <div key={s.label}>
                  <p className="font-headline font-black text-3xl text-accent">{s.value}</p>
                  <p className="mt-1 text-sm text-primary-foreground/60">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What we stand for */}
        <section className="bg-background section-pad-lg">
          <div className="page-container">
            <div className="mb-14">
              <p className="section-label">What We Stand For</p>
              <h2 className="section-heading max-w-md">
                Three pillars of professional education
              </h2>
            </div>

            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
              {pillars.map((p) => {
                const Icon = PILLAR_ICON_MAP[p.iconKey];
                return (
                  <div key={p.title} className="py-8 md:py-0 md:px-10 first:md:pl-0 last:md:pr-0">
                    <div className="flex items-start gap-5">
                      <span className="font-headline font-black text-5xl text-accent/20 leading-none select-none w-10 flex-shrink-0 mt-0.5">
                        {p.number}
                      </span>
                      <div>
                        <div className="flex items-center gap-2.5 mb-2.5">
                          <Icon className="size-5 text-accent" />
                          <h3 className="font-headline font-bold text-lg text-primary">{p.title}</h3>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">{p.body}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="bg-surface-muted section-pad-lg">
          <div className="page-container">
            <div className="mb-14">
              <p className="section-label">Our Values</p>
              <h2 className="section-heading max-w-sm">
                How we show up every day
              </h2>
            </div>

            <div className="grid sm:grid-cols-3 gap-6">
              {values.map((v) => {
                const Icon = VALUE_ICON_MAP[v.iconKey];
                return (
                  <div key={v.label} className="bg-card rounded-xl border p-6">
                    <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                      <Icon className="size-5 text-accent" />
                    </div>
                    <h3 className="font-headline font-bold text-base text-primary mb-2">{v.label}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
