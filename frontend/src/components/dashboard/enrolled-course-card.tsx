'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { type Course } from '@/lib/db';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { PlayCircle, Trophy } from 'lucide-react';
import { ImageWithFallback } from '@/components/image-with-fallback';
import { resolveMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';

export function EnrolledCourseCard({ course, progress }: { course: Course, progress: number }) {
  const resolvedImageUrl = resolveMediaUrl(course.imageUrl);
  const isCompleted = progress >= 100;

  return (
    <motion.div whileHover={{ y: -4, transition: { duration: 0.2 } }}>
      <Card className="h-full flex flex-col overflow-hidden rounded-xl border-none shadow-md transition-shadow hover:shadow-xl bg-card">
        <CardHeader className="p-0 relative">
          <Link href={`/student-dashboard/learn/${course.id}`}>
            <div className="aspect-video w-full relative">
              <ImageWithFallback
                src={resolvedImageUrl}
                alt={course.title}
                fill
                className="object-cover"
              />
              {isCompleted && (
                <div className="absolute inset-0 bg-green-900/60 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-1 text-white">
                    <Trophy className="h-8 w-8" />
                    <span className="text-xs font-black uppercase tracking-widest">Completed</span>
                  </div>
                </div>
              )}
            </div>
          </Link>
        </CardHeader>
        <CardContent className="p-5 flex-grow flex flex-col">
          <CardTitle className="mb-2 text-lg font-headline font-black leading-tight line-clamp-2">
            <Link href={`/student-dashboard/learn/${course.id}`} className="hover:text-primary transition-colors">
              {course.title}
            </Link>
          </CardTitle>
          <CardDescription className="text-xs font-medium text-muted-foreground mt-1 mb-4">
            By <span className="text-foreground font-bold">{course.instructor?.name || 'Academic Expert'}</span>
          </CardDescription>
          
          <div className="mt-auto pt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Progress</span>
              <span className={cn(
                "text-xs font-black",
                isCompleted ? "text-green-600" : "text-primary"
              )}>{progress}%</span>
            </div>
            <Progress 
              value={progress} 
              className={cn("h-1.5", isCompleted ? "bg-green-100 [&>*]:bg-green-500" : "bg-muted")} 
            />
          </div>
        </CardContent>
        <CardFooter className="p-5 pt-0">
          <Button 
            className={cn(
              "w-full font-black shadow-md rounded-lg h-11",
              isCompleted && "bg-green-600 hover:bg-green-700 text-white"
            )} 
            asChild
          >
            <Link href={`/student-dashboard/learn/${course.id}`}>
              {isCompleted ? (
                <>
                  <Trophy className="mr-2 h-4 w-4" />
                  Review Course
                </>
              ) : (
                <>
                  <PlayCircle className="mr-2 h-4 w-4" />
                  {progress > 0 ? 'Continue Learning' : 'Start Learning'}
                </>
              )}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
