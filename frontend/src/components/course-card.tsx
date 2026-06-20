'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { type Course, type User as AppUser } from '@/lib/db';
import { getCourseTotalListPrice } from '@/lib/course-pricing';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, Users, Heart, PlayCircle, CheckCircle2 } from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { toggleWishlist } from '@/lib/user-data';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { doc, onSnapshot } from 'firebase/firestore';
import { ImageWithFallback } from '@/components/image-with-fallback';
import { resolveMediaUrl } from '@/lib/media-url';

export function CourseCard({ course }: { course: Course }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);

  useEffect(() => {
    if (user && firestore) {
        const unsubscribe = onSnapshot(doc(firestore, 'users', user.uid), (snap) => {
            if (snap.exists()) {
                const profile = snap.data() as AppUser;
                setIsEnrolled(profile.enrollments?.some(e => e.courseId === course.id) || false);
                setIsWishlisted(profile.wishlistCourseIds?.includes(course.id) || false);
            }
        });
        return () => unsubscribe();
    }
  }, [user, firestore, course.id]);

  const formatCount = (count?: number) => {
    if (count === undefined || count === null) return '0';
    return new Intl.NumberFormat('en-US').format(count);
  };

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
        toast({ title: "Please log in", description: "You need an account to save courses." });
        return;
    }

    const newState = !isWishlisted;
    try {
        await toggleWishlist(user.uid, course.id, newState);
        toast({
            title: newState ? "Saved to Wishlist" : "Removed from Wishlist",
            description: course.title,
        });
    } catch (error) {
        console.error("Wishlist error:", error);
    }
  };

  const rating = course.rating || 5.0;
    const resolvedImageUrl = resolveMediaUrl(course.imageUrl);

  return (
    <motion.div whileHover={{ y: -8, transition: { duration: 0.2 } }}>
      <Link href={isEnrolled ? `/student-dashboard/learn/${course.id}` : `/course/${course.id}`}>
        <Card className="h-full flex flex-col overflow-hidden rounded-xl border-none shadow-md transition-all hover:shadow-2xl bg-card">
          <CardHeader className="p-0 relative">
            <div className="aspect-video w-full relative overflow-hidden">
                <ImageWithFallback
                src={resolvedImageUrl}
                alt={course.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
            </div>
            {user && (
                <button 
                    onClick={handleToggleWishlist}
                    className="absolute top-3 right-3 z-10 rounded-full bg-card/90 p-2 shadow-md backdrop-blur-sm transition-colors hover:bg-card"
                >
                    <Heart className={cn("h-4 w-4 transition-colors", isWishlisted ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
                </button>
            )}
            <div className="absolute bottom-3 left-3 flex gap-2">
                <Badge className="bg-primary/80 backdrop-blur-md border-none text-[10px] font-bold uppercase tracking-wider">
                    {course.category}
                </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 flex-grow flex flex-col">
            <div className="flex-grow">
                <CardTitle className="mb-2 text-lg font-headline font-bold leading-tight line-clamp-2 text-foreground">
                {course.title}
                </CardTitle>
                <p className="text-xs font-medium text-muted-foreground mb-4">
                By <span className="text-primary">{course.instructor?.name || 'Academic Expert'}</span>
                </p>
            </div>
            
            <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1 bg-accent/10 px-2 py-0.5 rounded text-accent font-black text-xs">
                    {rating.toFixed(1)}
                    <Star className="h-3 w-3 fill-accent" />
                </div>
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                    ({formatCount(course.reviewsCount)} Reviews)
                </span>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-4">
                <div className="flex items-center gap-1.5 font-medium">
                    <Users className="h-3.5 w-3.5 text-primary/40" />
                    <span>{formatCount(course.studentsCount)} students</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                    <Badge variant="secondary" className="h-5 px-2 text-[9px] font-black uppercase tracking-widest bg-muted/50 border-none">
                        {course.difficulty}
                    </Badge>
                </div>
            </div>
          </CardContent>
          <CardFooter className="p-5 pt-0 flex items-center justify-between">
            {isEnrolled ? (
                <div className="flex items-center gap-2 text-success font-black text-xs uppercase tracking-widest">
                    <CheckCircle2 className="h-4 w-4" />
                    Owned
                </div>
            ) : (
                <div className="text-2xl font-black text-primary font-headline">
                    {course.isFree ? 'FREE' : `GH₵${getCourseTotalListPrice(course).toFixed(2)}`}
                </div>
            )}
            
            {isEnrolled ? (
                <Button size="sm" variant="secondary" className="rounded-full px-4 h-8 font-bold text-xs gap-2">
                    <PlayCircle className="h-3.5 w-3.5" />
                    Learn
                </Button>
            ) : (
                <Button size="sm" className="rounded-full px-4 h-8 font-bold text-xs">
                    Enroll
                </Button>
            )}
          </CardFooter>
        </Card>
      </Link>
    </motion.div>
  );
}