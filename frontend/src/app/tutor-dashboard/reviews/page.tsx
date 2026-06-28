'use client';

import { replyToReview } from '@/app/actions/reviews';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatarUrl } from '@/lib/media-url';
import { Star, Loader2, MessageSquare, CheckCircle2, TrendingUp, Filter, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { type User, type Course, type Review } from "@/lib/db";
import { getUsersByIds } from "@/lib/user-data";
import { getCoursesByTutorId } from "@/lib/course-data";
import { getReviewsForCourses } from "@/lib/review-data";
import { useUser } from "@/firebase";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from 'date-fns';
import { cn } from "@/lib/utils";
import { apiFetch } from '@/lib/api-client';
import { isQuotaError } from '@/lib/service-errors';
import { reportQuotaError } from '@/lib/feedback/quota-state';

type FilterType = 'recent' | 'unanswered' | 'low-rating';

export default function ReviewsPage() {
    const { user: tutorAuth, isLoading: isTutorLoading } = useUser();
    const { toast } = useToast();
    
    const [tutor, setTutor] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    
    // Engagement State
    const [activeFilter, setActiveFilter] = useState<FilterType>('recent');
    const [replyText, setReplyText] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});

    const courseLabelLookup = useMemo(() => {
        const lookup = new Map<string, string>();

        courses.forEach((course) => {
            lookup.set(course.id, course.title);
            lookup.set(course.title, course.title);
        });

        return lookup;
    }, [courses]);

    const fetchData = useCallback(async () => {
        if (!tutorAuth) return;
        setIsLoading(true);
        setLoadError(null);
        try {
            const res = await apiFetch('/users/profile');
            const tutorData = res.ok
                ? ((await res.json()).user as User)
                : ({
                    id: tutorAuth.uid,
                    name: tutorAuth.displayName || 'Instructor',
                    email: tutorAuth.email || '',
                    role: 'tutor',
                  } as User);
            setTutor(tutorData);

            const coursesData = await getCoursesByTutorId(tutorAuth.uid);
            setCourses(coursesData);

            const reviewsData = await getReviewsForCourses(coursesData);
            setReviews(reviewsData);

            const reviewerIds = Array.from(new Set(reviewsData.map((review) => review.userId).filter(Boolean)));
            const usersData = await getUsersByIds(reviewerIds);
            setUsers(usersData);
        } catch (error) {
            console.error("Fetch Error:", error);
            setLoadError('Failed to load reviews. Please try again.');
            if (isQuotaError(error)) {
                reportQuotaError(error);
            }
        } finally {
            setIsLoading(false);
        }
    }, [tutorAuth]);

    useEffect(() => {
        if (!isTutorLoading && tutorAuth) {
            fetchData();
        }
    }, [tutorAuth, isTutorLoading, fetchData]);

    const processedReviews = useMemo(() => {
        let result = [...reviews];

        if (activeFilter === 'unanswered') {
            result = result.filter(r => !r.reply);
        } else if (activeFilter === 'low-rating') {
            result = result.filter(r => r.rating <= 3);
        }

        // Sort by date (recent first) by default
        return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [reviews, activeFilter]);

    const reviewStats = useMemo(() => {
        const totalReviews = reviews.length;
        const repliedReviews = reviews.filter((review) => !!review.reply).length;
        const lowRatingCount = reviews.filter((review) => review.rating <= 3).length;
        const avgRating = totalReviews > 0
            ? reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / totalReviews
            : 0;

        return {
            totalReviews,
            repliedReviews,
            lowRatingCount,
            avgRating,
            replyRate: totalReviews > 0 ? Math.round((repliedReviews / totalReviews) * 100) : 0,
        };
    }, [reviews]);

    const handlePostReply = async (reviewId: string) => {
        const text = replyText[reviewId];
        if (!text?.trim() || !tutorAuth) return;

        setIsSubmitting(prev => ({ ...prev, [reviewId]: true }));
        try {
            const idToken = await tutorAuth.getIdToken(true);
            const result = await replyToReview(reviewId, text, idToken);
            if ('error' in result) {
                throw new Error(result.error);
            }

            const repliedAt = new Date().toISOString();
            setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, reply: text.trim(), repliedAt } : r));

            toast({
                title: "Reply Published",
                description: "Your reply has been saved.",
            });
            
            setReplyText(prev => ({ ...prev, [reviewId]: '' }));
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Failed to post reply", description: error.message || 'Please try again.' });
        } finally {
            setIsSubmitting(prev => ({ ...prev, [reviewId]: false }));
        }
    };

    if (loadError && !tutor) {
        return (
            <div className="space-y-4">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Failed to load reviews</AlertTitle>
                    <AlertDescription>{loadError}</AlertDescription>
                </Alert>
                <Button onClick={() => void fetchData()}>Retry</Button>
            </div>
        );
    }

    if (isTutorLoading || isLoading || !tutor) {
        return (
            <div className="space-y-8">
                <Skeleton className="h-10 w-1/3" />
                <div className="space-y-6">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                </div>
            </div>
        )
    }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold mb-1 font-headline tracking-tight">Student Feedback</h1>
            <p className="text-muted-foreground text-sm">
            Monitor and respond to course reviews to build authority and trust.
            </p>
        </div>
        <div className="flex items-center gap-4">
            <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Overall Rating</p>
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-primary">
                        {reviewStats.totalReviews > 0 ? reviewStats.avgRating.toFixed(1) : '\u2014'}
                    </span>
                    <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                            <Star
                                key={i}
                                className={cn(
                                    "h-4 w-4",
                                    i < Math.floor(reviewStats.avgRating) ? "fill-accent text-accent" : "text-muted/30 fill-muted/30"
                                )}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-xl border max-w-md">
        <Filter size={14} className="ml-2 text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mr-2">Filter by</span>
        <Button 
            variant={activeFilter === 'recent' ? 'default' : 'outline'} 
            size="sm" 
            className="h-7 text-[10px] font-black"
            onClick={() => setActiveFilter('recent')}
        >
            Recent
        </Button>
        <Button 
            variant={activeFilter === 'unanswered' ? 'default' : 'ghost'} 
            size="sm" 
            className="h-7 text-[10px] font-bold"
            onClick={() => setActiveFilter('unanswered')}
        >
            Unanswered
        </Button>
        <Button 
            variant={activeFilter === 'low-rating' ? 'default' : 'ghost'} 
            size="sm" 
            className="h-7 text-[10px] font-bold"
            onClick={() => setActiveFilter('low-rating')}
        >
            1-3 Star
        </Button>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-8">
        <div className="space-y-6">
            {processedReviews.length > 0 ? (
                processedReviews.map(review => {
                    const student = users.find(u => u.id === review.userId);
                    const courseLabel = courseLabelLookup.get(review.course) || review.course;
                    return (
                        <Card key={review.id} className="border-none shadow-md overflow-hidden hover:shadow-xl transition-all group">
                            <div className="h-1.5 w-full bg-accent/20 group-hover:bg-accent transition-colors" />
                            <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                                <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                                    <AvatarImage src={resolveAvatarUrl(student?.avatar)} />
                                    <AvatarFallback className="bg-primary/5 text-primary font-bold">{student?.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg font-bold truncate">{student?.name || 'Anonymous Learner'}</CardTitle>
                                            <CardDescription className="text-xs font-bold text-accent uppercase tracking-tighter">
                                                Course: {courseLabel}
                                            </CardDescription>
                                        </div>
                                        <p className="text-[10px] font-mono text-muted-foreground uppercase whitespace-nowrap">
                                            {formatDistanceToNow(new Date(review.date), { addSuffix: true })}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 mt-2">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} className={cn("h-3 w-3", i < review.rating ? "fill-accent text-accent" : "text-muted/30 fill-muted/30")} />
                                        ))}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <p className="text-sm text-foreground italic leading-relaxed pl-4 border-l-4 border-accent/10 py-2 bg-muted/10 rounded-r-lg">
                                    &ldquo;{review.text}&rdquo;
                                </p>
                                {review.reply && (
                                    <div className="ml-8 p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-2 animate-in slide-in-from-left-2">
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Your Response</span>
                                            <span className="text-[9px] text-muted-foreground ml-auto">{review.repliedAt ? formatDistanceToNow(new Date(review.repliedAt), { addSuffix: true }) : ''}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">{review.reply}</p>
                                    </div>
                                )}
                            </CardContent>
                            {!review.reply && (
                                <CardFooter className="bg-muted/30 border-t p-4 flex flex-col gap-4">
                                    <div className="w-full flex items-center gap-3">
                                        <Avatar className="h-8 w-8 border">
                                            <AvatarImage src={resolveAvatarUrl(tutor.avatar)} />
                                            <AvatarFallback>T</AvatarFallback>
                                        </Avatar>
                                        <Textarea 
                                            placeholder={`Send a professional reply to ${student?.name?.split(' ')[0] || 'the student'}...`}
                                            className="resize-none bg-background text-xs min-h-[60px]"
                                            value={replyText[review.id] || ''}
                                            onChange={e => setReplyText(prev => ({ ...prev, [review.id]: e.target.value }))}
                                        />
                                    </div>
                                    <div className="flex justify-end w-full">
                                        <Button 
                                            size="sm" 
                                            className="h-8 text-xs font-bold gap-2"
                                            onClick={() => handlePostReply(review.id)}
                                            disabled={isSubmitting[review.id] || !replyText[review.id]?.trim()}
                                        >
                                            {isSubmitting[review.id] ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
                                            Post Academic Response
                                        </Button>
                                    </div>
                                </CardFooter>
                            )}
                        </Card>
                    )
                })
            ) : (
                <Card className="border-none shadow-sm py-20">
                    <CardContent className="flex flex-col items-center text-center space-y-4 opacity-30 grayscale">
                        <Star size={64} className="text-muted-foreground" />
                        <div>
                            <p className="font-bold uppercase tracking-widest">No Feedback Matching Filters</p>
                            <p className="text-xs">Adjust your filters to see more student feedback.</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>

        <aside className="space-y-6">
            <Card className="bg-primary text-primary-foreground border-none shadow-xl">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp size={18} className="text-accent" />
                        Performance Insights
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs leading-relaxed text-primary-foreground/80">
                    <p>
                        Current average rating: <span className="font-black text-primary-foreground">{reviewStats.totalReviews > 0 ? reviewStats.avgRating.toFixed(1) : '\u2014'}</span>{' '}
                        across <span className="font-black text-primary-foreground">{reviewStats.totalReviews}</span> review(s).
                    </p>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                        <p>
                            Response coverage: <span className="font-black text-primary-foreground">{reviewStats.replyRate}%</span>{' '}
                            ({reviewStats.repliedReviews}/{reviewStats.totalReviews || 0} reviewed).
                        </p>
                        <p className="mt-2 italic">
                            {reviewStats.lowRatingCount > 0
                                ? `${reviewStats.lowRatingCount} low-rating review(s) need attention. Prioritize constructive follow-up replies to rebuild trust.`
                                : 'No low-rating reviews right now. Keep response quality consistent to protect your reputation trend.'}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Reputation Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Total Reviews</span>
                        <span className="font-bold">{reviewStats.totalReviews}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Reply Rate</span>
                        <span className="font-bold text-success">
                            {reviewStats.replyRate}%
                        </span>
                    </div>
                </CardContent>
            </Card>
        </aside>
      </div>
    </div>
  );
}