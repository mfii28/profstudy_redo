'use client';

import { Book, Brain, Zap, ArrowRight, PlayCircle, Receipt, Tv, UserCog, ShieldAlert, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EnrolledCourseCard } from '@/components/dashboard/enrolled-course-card';
import { useEffect, useMemo, useState } from 'react';
import { CourseCardSkeleton } from '@/components/course-card-skeleton';
import { EmptyState } from '@/components/dashboard/empty-state';
import { BookOpenCheck } from 'lucide-react';
import { useEnrolledCourses } from '@/hooks/use-enrolled-courses';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

function QuickActionCard({ icon, title, description, buttonText, href }: { icon: React.ReactNode, title: string, description: string, buttonText: string, href: string }) {
    return (
        <Card className="hover:shadow-lg transition-all cursor-pointer group border-none shadow-md">
            <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                    <div className="p-2.5 sm:p-3 bg-muted rounded-xl shrink-0">
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-bold text-foreground text-sm sm:text-base">{title}</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{description}</p>
                    </div>
                </div>
                <Button variant="outline" className="w-full gap-2 text-xs h-9 sm:h-10 font-bold" asChild>
                    <Link href={href}>{buttonText} <ArrowRight className="w-4 h-4" /></Link>
                </Button>
            </CardContent>
        </Card>
    )
}

export default function Dashboard() {
        const { user, profile, enrolledCoursesWithProgress, isLoading } = useEnrolledCourses();
    const [isEmailProviderReady, setIsEmailProviderReady] = useState<boolean | null>(null);

        const profileNeedsAttention = useMemo(() => {
            if (!profile) return false;
            return !profile.name?.trim() || !profile.bio?.trim() || !profile.avatar?.trim();
        }, [profile]);

        useEffect(() => {
            let cancelled = false;
            const checkProvider = async () => {
                try {
                    const res = await fetch('/api/email/provider-status', { cache: 'no-store' });
                    if (!res.ok) throw new Error('Provider status request failed');
                    const result = await res.json();
                    if (!cancelled) {
                        setIsEmailProviderReady(Boolean(result?.configured));
                    }
                } catch {
                    if (!cancelled) {
                        setIsEmailProviderReady(false);
                    }
                }
            };

            void checkProvider();
            return () => {
                cancelled = true;
            };
        }, []);

    const nextLessonNudge = (() => {
      if (!profile || !enrolledCoursesWithProgress?.length) return null;
      for (const course of enrolledCoursesWithProgress) {
        if (!course?.sections) continue;
        const enrollment = profile.enrollments?.find(e => e.courseId === course.id);
        const completedSet = new Set(enrollment?.completedLessons || []);
        for (const section of course.sections) {
          for (const lesson of section.lessons || []) {
            if (!completedSet.has(lesson.id)) {
              return { courseTitle: course.title, courseId: course.id, lessonTitle: lesson.title, sectionTitle: section.title, duration: lesson.duration || 10 };
            }
          }
        }
      }
      return null;
    })();

    if (isLoading || !profile) {
      return (
          <div className="space-y-6 sm:space-y-8">
              <Skeleton className="h-48 w-full rounded-xl" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
              <Skeleton className="h-96 w-full rounded-xl" />
          </div>
      )
  }

  const firstName = (profile.name || '').split(' ')[0] || 'there';

  return (
    <div className="space-y-6 sm:space-y-8 pb-20">
        <div className="bg-primary text-primary-foreground rounded-xl p-6 sm:p-8 shadow-lg">
            <div className="flex flex-col gap-4 sm:gap-6">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl sm:text-3xl md:text-4xl font-black mb-1 sm:mb-2 truncate font-headline uppercase tracking-tighter">Ahlan, {firstName}!</h1>
                        <p className="text-xs sm:text-base text-primary-foreground/80 font-medium">Continue your path to ICAG mastery.</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button size="lg" className="w-full sm:w-auto bg-secondary text-secondary-foreground font-black hover:bg-secondary/90 shadow-xl px-8 rounded-full h-11 sm:h-12" asChild>
                       <Link href="/student-dashboard/browse-courses">Explore Courses</Link>
                    </Button>
                    <Button variant="outline" size="lg" className="w-full sm:w-auto bg-white/10 text-white hover:bg-white/20 border-white/20 shadow-md font-bold h-11 sm:h-12" asChild>
                        <Link href="/student-dashboard/my-learning">Continue Learning</Link>
                    </Button>
                </div>
            </div>
        </div>

                {profileNeedsAttention && (
                        <Card className="border-2 border-amber-300/50 bg-amber-50/80 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500 dark:bg-amber-950/20 dark:border-amber-700/50">
                                <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 text-center sm:text-left">
                                                <div className="p-3 rounded-full bg-amber-200/70 text-amber-800 dark:bg-amber-800/40 dark:text-amber-300">
                                                        <ShieldAlert className="h-6 w-6" />
                                                </div>
                                                <div>
                                                        <h4 className="font-black uppercase text-xs tracking-widest text-amber-900 dark:text-amber-200">Complete Your Profile</h4>
                                                        <p className="text-sm font-medium text-muted-foreground">Add your full bio and profile photo so your account is fully set up.</p>
                                                </div>
                                        </div>
                                        <Button size="sm" className="font-bold px-6" asChild>
                                                <Link href="/student-dashboard/settings/profile">Open Settings <ArrowRight className="ml-2 h-4 w-4" /></Link>
                                        </Button>
                                </CardContent>
                        </Card>
                )}

                {isEmailProviderReady === false && (
                    <Card className="border-2 border-red-300/50 bg-red-50/80 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500 dark:bg-red-950/20 dark:border-red-700/50">
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="p-3 rounded-full bg-red-200/70 text-red-800 dark:bg-red-800/40 dark:text-red-300">
                                <AlertCircle className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="font-black uppercase text-xs tracking-widest text-red-900 dark:text-red-200">Email Service Unavailable</h4>
                                <p className="text-sm font-medium text-muted-foreground">Email provider is not configured. Contact support if you expected email updates.</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {nextLessonNudge && (
              <Card className="sm:col-span-2 border-none shadow-md bg-gradient-to-r from-primary/5 to-accent/5 animate-in fade-in slide-in-from-top-2 duration-500">
                <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
                      <PlayCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Continue Where You Left Off</p>
                      <p className="font-bold text-sm text-foreground">{nextLessonNudge.lessonTitle}</p>
                      <p className="text-xs text-muted-foreground">{nextLessonNudge.courseTitle} &bull; {nextLessonNudge.sectionTitle} &bull; ~{nextLessonNudge.duration}min</p>
                    </div>
                  </div>
                  <Button className="w-full sm:w-auto font-bold gap-2 rounded-full px-6 shadow-lg" asChild>
                    <Link href={`/student-dashboard/learn/${nextLessonNudge.courseId}`}>Resume <ArrowRight className="h-4 w-4" /></Link>
                  </Button>
                </CardContent>
              </Card>
            )}
            <Card className="border-none shadow-md overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/30 border-b p-4 sm:p-6">
                    <CardTitle className="text-[10px] uppercase text-muted-foreground font-black tracking-widest">Active Enrollments</CardTitle>
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Book className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                </CardHeader>
                <CardContent className="pt-4 sm:pt-6 px-4 sm:p-6">
                    <p className="text-3xl sm:text-4xl font-black text-foreground">{profile.enrollments?.length || 0}</p>
                </CardContent>
            </Card>
             <Card className="border-none shadow-md overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/30 border-b p-4 sm:p-6">
                    <CardTitle className="text-[10px] uppercase text-muted-foreground font-black tracking-widest">Current Streak</CardTitle>
                    <div className="p-2 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400">
                         <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                </CardHeader>
                <CardContent className="pt-4 sm:pt-6 px-4 sm:p-6">
                    <p className="text-3xl sm:text-4xl font-black text-foreground">{profile.studyStreak || 0} <span className="text-sm font-medium text-muted-foreground">Days</span></p>
                </CardContent>
            </Card>
        </div>

        <div className="space-y-8 sm:space-y-10 m-0">
            <Card className="bg-accent text-accent-foreground border-none shadow-xl relative overflow-hidden group">
                    <div className="absolute right-0 top-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <Brain className="w-8 h-8 text-white" />
                    </div>
                    <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <div className="p-2.5 sm:p-3 bg-white/20 rounded-2xl shrink-0 backdrop-blur-sm">
                                <Brain className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                            </div>
                             <div className="min-w-0">
                                <h4 className="font-black text-white text-lg sm:text-xl font-headline uppercase tracking-tight">AI Study Assistant</h4>
                                <p className="text-xs sm:text-sm text-white/80 font-medium">Help with complex concepts and calculations.</p>
                            </div>
                        </div>
                        <Button className="w-full sm:w-auto bg-white text-accent hover:bg-white/90 font-black h-11 sm:h-12 px-8 rounded-full shadow-lg text-xs sm:text-sm" asChild>
                            <Link href="/student-dashboard/ai-assistant">Launch Assistant</Link>
                        </Button>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <QuickActionCard
                        icon={<Tv className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />}
                        title="Live Classes"
                        description="Join upcoming sessions"
                        buttonText="Open"
                        href="/student-dashboard/live-classes"
                    />
                    <QuickActionCard
                        icon={<Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />}
                        title="Transactions"
                        description="View payment history"
                        buttonText="View"
                        href="/student-dashboard/transactions"
                    />
                    <QuickActionCard
                        icon={<UserCog className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-400" />}
                        title="Account"
                        description="Profile and preferences"
                        buttonText="Settings"
                        href="/student-dashboard/settings/profile"
                    />
                </div>
                
                <div className="space-y-6">
                  <h3 className="text-[10px] sm:text-xs font-black font-headline tracking-widest uppercase text-muted-foreground mb-4 border-l-4 border-primary pl-3">Your Active Shelf</h3>
                   {enrolledCoursesWithProgress.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {enrolledCoursesWithProgress.map(course => (
                                course && <EnrolledCourseCard key={course.id} course={course} progress={course.progress} />
                            ))}
                        </div>
                   ) : (
                        <EmptyState
                            icon={<BookOpenCheck className="h-12 w-12 sm:h-16 sm:w-16 text-secondary" />}
                            title="Your shelf is empty"
                            description="Start by enrolling in an expert-led ICAG or CITG course today."
                            action={<Button asChild className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-black px-8 h-11 sm:h-12 rounded-full text-xs"><Link href="/student-dashboard/browse-courses">Browse Catalog</Link></Button>}
                            />
                   )}
                </div>
        </div>

    </div>
  );
}
