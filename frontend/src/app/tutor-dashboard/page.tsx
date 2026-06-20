
'use client';

import { Star, Users, BookOpen, ArrowRight, UserPlus, Clock, AlertCircle } from 'lucide-react';
import { isQuotaError } from '@/lib/service-errors';
import { reportQuotaError } from '@/lib/feedback/quota-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirestore } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { type User as UserProfile } from '@/lib/db';
import { formatDistanceToNow } from 'date-fns';
import { doc, getDoc } from 'firebase/firestore';
import { useTutorCourses } from '@/hooks/use-tutor-courses';
import { useTutorStudents } from '@/hooks/use-tutor-students';

type RecentActivity = {
    id: string;
    studentName: string;
    courseTitle: string;
    type: 'enrollment' | 'completion';
    timestamp: string;
}

const RECENT_ACTIVITY_LIMIT = 5;

function StatCard({ icon, title, value, description }: { icon: React.ReactNode, title: string, value: string, description?: string }) {
    return (
        <Card className="border-none shadow-md overflow-hidden bg-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-muted/30 border-b">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
                <div className="text-primary">{icon}</div>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="text-3xl font-black">{value}</div>
                {description && <p className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-tighter">{description}</p>}
            </CardContent>
        </Card>
    );
}

export default function TutorDashboard() {
    const { user: tutorAuth, isLoading: isAuthLoading } = useUser();
    const firestore = useFirestore();
    const { courses, isLoading: isCoursesLoading } = useTutorCourses();
    const { allStudents, isLoading: isStudentsLoading } = useTutorStudents();
    const [tutorProfile, setTutorProfile] = useState<UserProfile | null>(null);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
    const [averageRating, setAverageRating] = useState(0);
    const [totalEnrollments, setTotalEnrollments] = useState(0);
    const [loadError, setLoadError] = useState<string | null>(null);

    const fetchTutorProfile = useCallback(async () => {
        if (!tutorAuth) return;
        if (!firestore) {
          setLoadError('Your profile is still loading. Please wait a moment and retry.');
          setIsDataLoading(false);
          return;
        }
        setIsDataLoading(true);
        setLoadError(null);
        try {
          const tutorDocRef = doc(firestore, 'users', tutorAuth.uid);
          const tutorDocSnap = await getDoc(tutorDocRef);
          if (tutorDocSnap.exists()) {
            setTutorProfile(tutorDocSnap.data() as UserProfile);
          } else {
            setTutorProfile({
              id: tutorAuth.uid,
              name: tutorAuth.displayName || 'Instructor',
              email: tutorAuth.email || '',
              role: 'tutor',
            } as UserProfile);
          }
        } catch (error) {
            setLoadError('Failed to load your instructor profile. Please try again.');
            if (isQuotaError(error)) {
              reportQuotaError(error);
            }
        }
        setIsDataLoading(false);
      }, [tutorAuth, firestore]);
    
    useEffect(() => {
        if (!tutorProfile) return;

        const courseMap = new Map(courses.map(c => [c.id, c.title]));
        const items: RecentActivity[] = [];
        let enrollmentsCount = 0;

        allStudents.forEach(student => {
            (student.enrollments || []).forEach(enrollment => {
                if (!courseMap.has(enrollment.courseId)) return;
            enrollmentsCount += 1;
                const courseTitle = courseMap.get(enrollment.courseId) || 'Course';
                items.push({
                    id: `enr-${student.id}-${enrollment.courseId}`,
                    studentName: student.name,
                    courseTitle,
                    type: 'enrollment',
                    timestamp: enrollment.enrolledDate
                });
            });
        });

        items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setRecentActivity(items.slice(0, RECENT_ACTIVITY_LIMIT));
        setTotalEnrollments(enrollmentsCount);

        const ratedCourses = courses.filter(c => typeof c.rating === 'number' && (c.rating || 0) > 0);
        if (ratedCourses.length > 0) {
            const avg = ratedCourses.reduce((sum, course) => sum + (course.rating || 0), 0) / ratedCourses.length;
            setAverageRating(avg);
        } else {
            setAverageRating(0);
        }
    }, [tutorProfile, courses, allStudents]);

    useEffect(() => {
        if (!isAuthLoading) {
            fetchTutorProfile();
        }
    }, [isAuthLoading, fetchTutorProfile]);

    if (loadError && !tutorProfile) {
        return (
            <div className="space-y-4">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Dashboard unavailable</AlertTitle>
                    <AlertDescription>{loadError}</AlertDescription>
                </Alert>
                <Button onClick={() => void fetchTutorProfile()}>Retry</Button>
            </div>
        );
    }

    if (isAuthLoading || isDataLoading || isCoursesLoading || isStudentsLoading || !tutorProfile) {
        return (
             <div className="space-y-8">
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                    <Skeleton className="h-28 w-full" />
                </div>
                <Skeleton className="h-64 w-full" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="bg-primary text-primary-foreground rounded-xl p-4 sm:p-8 shadow-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-black font-headline uppercase tracking-tighter mb-2">Instructor HQ</h1>
                        <p className="text-primary-foreground/80 font-medium">Welcome back, {tutorProfile.name}.</p>
                    </div>
                    <Button size="lg" className="bg-secondary text-secondary-foreground font-black hover:bg-secondary/90 shadow-xl px-8 rounded-full" asChild>
                        <Link href="/tutor-dashboard/courses/create">New Course <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xs:grid-cols-3 gap-4 sm:gap-6">
                <StatCard 
                    icon={<BookOpen size={18} />}
                    title="Total Courses"
                    value={String(courses.length)}
                    description="Created Courses"
                />
                <StatCard 
                    icon={<Users size={18} />}
                    title="Total Enrollments"
                    value={String(totalEnrollments)}
                    description="Across All Courses"
                />
                <StatCard 
                    icon={<Star size={18} />}
                    title="Average Rating"
                    value={averageRating > 0 ? averageRating.toFixed(1) : '\u2014'}
                    description="Across Rated Courses"
                />
            </div>

            <Card className="border-none shadow-md overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="text-lg">Recent Activity</CardTitle>
                    <CardDescription>Latest student enrollments.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {recentActivity.length > 0 ? (
                        <div className="divide-y divide-border/50">
                            {recentActivity.map((item) => (
                                <div key={item.id} className="p-4 flex items-center gap-4">
                                    <div className="p-2.5 rounded-xl shrink-0 shadow-sm bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                                        <UserPlus size={16} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold truncate">
                                            <span className="text-primary">{item.studentName}</span>
                                            <span className="text-muted-foreground font-normal ml-1">joined</span>
                                        </p>
                                        <p className="text-[10px] font-black text-accent truncate mt-0.5 uppercase tracking-widest opacity-80">
                                            {item.courseTitle}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap">
                                        <Clock size={10} />
                                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-16 text-center">
                            <Users size={32} className="mx-auto mb-3 text-muted-foreground/30" />
                            <p className="font-semibold text-sm text-muted-foreground">No student activity yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Enrollments will appear here once students join your courses.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
