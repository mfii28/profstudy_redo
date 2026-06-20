'use client';

import { useEnrolledCourses } from '@/hooks/use-enrolled-courses';
import { getEnrollmentCompletionStats } from '@/lib/learning-progress';
import { useStudentProfile } from '@/hooks/use-student-profile';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BookOpen, CheckCircle2, TrendingUp, Clock } from 'lucide-react';
import { ImageWithFallback } from '@/components/image-with-fallback';
import { resolveMediaUrl } from '@/lib/media-url';

function StatCard({ icon, title, value, sub }: { icon: React.ReactNode; title: string; value: string | number; sub?: string }) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm font-medium">{title}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function CourseSkeleton() {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="flex gap-4 p-4">
        <Skeleton className="h-16 w-24 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-2 w-full mt-2" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProgressPage() {
  const { profile, isLoading: profileLoading } = useStudentProfile();
  const { enrolledCoursesWithProgress, isLoading: isCoursesLoading } = useEnrolledCourses();

  const stats = getEnrollmentCompletionStats(
    profile?.enrollments,
    enrolledCoursesWithProgress
  );

  const isLoading = profileLoading || isCoursesLoading;

  const inProgress = enrolledCoursesWithProgress.filter(c => c.progress > 0 && c.progress < 100);
  const completed = enrolledCoursesWithProgress.filter(c => c.progress === 100);
  const notStarted = enrolledCoursesWithProgress.filter(c => c.progress === 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline mb-1">My Progress</h1>
        <p className="text-muted-foreground text-sm">Track your learning journey across all enrolled courses.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
        ) : (
          <>
            <StatCard icon={<BookOpen className="h-5 w-5" />} title="Enrolled" value={stats.totalCourses} />
            <StatCard icon={<CheckCircle2 className="h-5 w-5" />} title="Completed" value={stats.coursesCompleted} />
            <StatCard icon={<TrendingUp className="h-5 w-5" />} title="Completion Rate" value={`${stats.completionRate}%`} />
          </>
        )}
      </div>

      {/* In Progress */}
      {(isLoading || inProgress.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> In Progress
          </h2>
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => <CourseSkeleton key={i} />)
          ) : (
            inProgress.map(course => (
              <Link key={course.id} href={`/student-dashboard/learn/${course.id}`}>
                <Card className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="flex gap-4 p-4">
                    <ImageWithFallback
                      src={resolveMediaUrl(course.imageUrl)}
                      alt={course.title}
                      className="h-16 w-24 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-tight line-clamp-2">{course.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{course.category}</p>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Progress</span>
                          <span className="font-medium text-foreground">{course.progress}%</span>
                        </div>
                        <Progress value={course.progress} className="h-1.5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </section>
      )}

      {/* Completed */}
      {!isLoading && completed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Completed
          </h2>
          {completed.map(course => (
            <Card key={course.id} className="border-none shadow-sm">
              <CardContent className="flex gap-4 p-4">
                <ImageWithFallback
                  src={resolveMediaUrl(course.imageUrl)}
                  alt={course.title}
                  className="h-16 w-24 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm leading-tight line-clamp-2">{course.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{course.category}</p>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200 shrink-0">
                    Completed
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      {/* Not started */}
      {!isLoading && notStarted.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Not Yet Started</h2>
          {notStarted.map(course => (
            <Link key={course.id} href={`/student-dashboard/learn/${course.id}`}>
              <Card className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer opacity-70 hover:opacity-100">
                <CardContent className="flex gap-4 p-4">
                  <ImageWithFallback
                    src={resolveMediaUrl(course.imageUrl)}
                    alt={course.title}
                    className="h-16 w-24 rounded-lg object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight line-clamp-2">{course.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{course.category}</p>
                    <Progress value={0} className="h-1.5 mt-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}

      {!isLoading && enrolledCoursesWithProgress.length === 0 && (
        <EmptyState
          icon={<BookOpen className="h-10 w-10" />}
          title="No courses yet"
          description="Enroll in a course to start tracking your progress."
          action={<Link href="/student-dashboard/browse-courses"><Button>Browse Courses</Button></Link>}
        />
      )}
    </div>
  );
}
