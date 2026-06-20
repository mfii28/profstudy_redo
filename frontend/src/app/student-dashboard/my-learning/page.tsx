'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CourseCardSkeleton } from '@/components/course-card-skeleton';
import { EmptyState } from '@/components/dashboard/empty-state';
import { BookOpenCheck, Trophy, TrendingUp, BookOpen } from 'lucide-react';
import { EnrolledCourseCard } from '@/components/dashboard/enrolled-course-card';
import { useEnrolledCourses } from '@/hooks/use-enrolled-courses';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function MyLearningPage() {
  const { enrolledCoursesWithProgress, isLoading } = useEnrolledCourses();

  const activeCourses = enrolledCoursesWithProgress.filter(c => c.progress < 100);
  const completedCourses = enrolledCoursesWithProgress.filter(c => c.progress >= 100);
  const avgProgress = enrolledCoursesWithProgress.length
    ? Math.round(enrolledCoursesWithProgress.reduce((sum, c) => sum + c.progress, 0) / enrolledCoursesWithProgress.length)
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold">My Learning</h1>
          <p className="text-muted-foreground">
            Your personal shelf of every course you have ever enrolled in.
          </p>
        </div>
        <Button asChild>
          <Link href="/student-dashboard/browse-courses">Explore Courses</Link>
        </Button>
      </div>

      {isLoading ? (
        <>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <CourseCardSkeleton key={index} />
            ))}
          </div>
        </>
      ) : enrolledCoursesWithProgress.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-none shadow-md overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/30 border-b p-4">
                <CardTitle className="text-[10px] uppercase text-muted-foreground font-black tracking-widest">Enrolled</CardTitle>
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <BookOpen className="w-4 h-4" />
                </div>
              </CardHeader>
              <CardContent className="pt-4 px-4 pb-4">
                <p className="text-3xl font-black">{enrolledCoursesWithProgress.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Total courses</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/30 border-b p-4">
                <CardTitle className="text-[10px] uppercase text-muted-foreground font-black tracking-widest">Completed</CardTitle>
                <div className="p-2 rounded-lg bg-green-100 text-green-600 dark:bg-green-950/20 dark:text-green-400">
                  <Trophy className="w-4 h-4" />
                </div>
              </CardHeader>
              <CardContent className="pt-4 px-4 pb-4">
                <p className="text-3xl font-black">{completedCourses.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Courses finished</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-md overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/30 border-b p-4">
                <CardTitle className="text-[10px] uppercase text-muted-foreground font-black tracking-widest">Avg Progress</CardTitle>
                <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </CardHeader>
              <CardContent className="pt-4 px-4 pb-4">
                <p className="text-3xl font-black">{avgProgress}%</p>
                <p className="text-xs text-muted-foreground mt-1">Across all courses</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="in-progress">
            <TabsList>
              <TabsTrigger value="in-progress">
                In Progress ({activeCourses.length})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({completedCourses.length})
              </TabsTrigger>
              <TabsTrigger value="all">
                All ({enrolledCoursesWithProgress.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="in-progress" className="mt-6">
              {activeCourses.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {activeCourses.map(course => (
                    <EnrolledCourseCard key={course.id} course={course} progress={course.progress} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Trophy className="h-16 w-16 text-green-500" />}
                  title="All caught up!"
                  description="You have completed all your enrolled courses. Explore more to keep learning."
                  action={<Button asChild><Link href="/student-dashboard/browse-courses">Browse More Courses</Link></Button>}
                />
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-6">
              {completedCourses.length > 0 ? (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {completedCourses.map(course => (
                    <EnrolledCourseCard key={course.id} course={course} progress={course.progress} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<BookOpenCheck className="h-16 w-16 text-muted-foreground" />}
                  title="No completed courses yet"
                  description="Keep learning and you will see your finished courses here."
                />
              )}
            </TabsContent>

            <TabsContent value="all" className="mt-6">
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {enrolledCoursesWithProgress.map(course => (
                  <EnrolledCourseCard key={course.id} course={course} progress={course.progress} />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <EmptyState
          icon={<BookOpenCheck className="h-16 w-16 text-muted-foreground" />}
          title="Your learning journey starts here"
          description="You have not enrolled in any courses yet. Browse our catalog to find the perfect course for you."
          action={<Button asChild><Link href="/student-dashboard/browse-courses">Browse Courses</Link></Button>}
        />
      )}
    </div>
  );
}
