'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/firebase';
import { getReviewsByUser } from '@/lib/review-data';
import type { Review } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Star, Calendar, MessageSquare } from 'lucide-react';

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return dateStr; }
}

function ReviewSkeleton() {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-5 space-y-3">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </CardContent>
    </Card>
  );
}

export default function ReviewsPage() {
  const { user } = useUser();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    getReviewsByUser(user.uid)
      .then(setReviews)
      .finally(() => setIsLoading(false));
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline mb-1">My Reviews</h1>
        <p className="text-muted-foreground text-sm">Feedback you have left on courses you completed.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <ReviewSkeleton key={i} />)}</div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={<Star className="h-10 w-10" />}
          title="No reviews yet"
          description="After completing a course, leave a review to help other learners."
          action={<Link href="/student-dashboard/my-learning"><Button>Go to My Learning</Button></Link>}
        />
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
            <Card key={review.id} className="border-none shadow-sm">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">{review.course}</p>
                    <StarRating rating={review.rating} />
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                    <Calendar className="h-3 w-3" />{formatDate(review.date)}
                  </span>
                </div>
                {review.text && (
                  <p className="text-sm text-muted-foreground">{review.text}</p>
                )}
                {review.reply && (
                  <div className="bg-muted/50 rounded-lg p-3 border-l-2 border-primary/40">
                    <p className="text-xs font-semibold text-primary flex items-center gap-1 mb-1">
                      <MessageSquare className="h-3 w-3" /> Instructor reply
                    </p>
                    <p className="text-sm text-muted-foreground">{review.reply}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
