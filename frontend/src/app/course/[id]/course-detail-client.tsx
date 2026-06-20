'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ImageWithFallback } from '@/components/image-with-fallback';
import {
  ArrowRight,
  Book,
  CheckCircle,
  PlayCircle,
  Star,
  Clock,
  BarChart,
  Users,
  CheckCircle2,
  MessageSquare,
  Package,
} from 'lucide-react';
import { notFound, useRouter } from 'next/navigation';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { useCart } from '@/lib/cart-context';
import { useEffect, useState, useMemo } from 'react';
import { type Course, type User as AppUser, type Review } from '@/lib/db';
import { getCourseById } from '@/lib/course-data';
import { getCourseListingPrice } from '@/lib/course-pricing';
import { getReviewsByCourseReference } from '@/lib/review-data';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { resolveMediaUrl, resolveAvatarUrl } from '@/lib/media-url';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { enrollFreeCourse } from '@/app/actions/payments';
import { submitReview } from '@/app/actions/reviews';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

function CourseDetailSkeleton() {
    return (
        <div className="page-container py-8 md:py-12">
            <Skeleton className="h-6 w-1/3 mb-8" />
             <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-8">
                    <Card>
                        <Skeleton className="aspect-video w-full" />
                        <CardContent className="p-6 space-y-4">
                            <Skeleton className="h-8 w-3/4" />
                            <Skeleton className="h-6 w-1/2" />
                            <div className="flex gap-4">
                                <Skeleton className="h-5 w-24" />
                                <Skeleton className="h-5 w-24" />
                            </div>
                        </CardContent>
                    </Card>
                     <Skeleton className="h-10 w-full" />
                </div>
                 <aside className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardContent className="p-6 space-y-4">
                             <Skeleton className="h-10 w-1/2 mx-auto" />
                             <Skeleton className="h-12 w-full" />
                             <Skeleton className="h-12 w-full" />
                        </CardContent>
                    </Card>
                </aside>
             </div>
        </div>
    )
}

export default function CourseDetailClient({
    courseId,
    isPreview = false,
}: {
    courseId: string;
    isPreview?: boolean;
}) {
  const router = useRouter();
  const { addToCart } = useCart();
    const { user } = useUser();
  const firestore = useFirestore();
    const { toast } = useToast();

  const [course, setCourse] = useState<Course | undefined | null>(undefined);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
    const [isEnrolling, setIsEnrolling] = useState(false);
  const [reviewSort, setReviewSort] = useState<'recent' | 'highest' | 'lowest'>('recent');
  const [purchaseOption, setPurchaseOption] = useState<'course_only' | 'course_with_book'>('course_only');

  // Review submission state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [hasUserReviewed, setHasUserReviewed] = useState(false);
  
  const sortedReviews = useMemo(() => {
    const sorted = [...reviews];
    switch (reviewSort) {
      case 'highest':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case 'lowest':
        sorted.sort((a, b) => a.rating - b.rating);
        break;
      case 'recent':
      default:
        sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
    }
    return sorted;
  }, [reviews, reviewSort]);

  useEffect(() => {
    const fetchCourse = async () => {
        if (courseId) {
            const courseData = await getCourseById(courseId);
            setCourse(courseData || null);
            
            // Fetch reviews for this course
            if (courseId) {
                const courseReviews = await getReviewsByCourseReference(courseId, courseData?.title);
                setReviews(courseReviews);

                // Check if user has already reviewed
                if (user) {
                    const userReview = courseReviews.find(review => review.userId === user.uid);
                    setHasUserReviewed(!!userReview);
                }
            }
        }
    }
    fetchCourse();
  }, [courseId, user]);

  useEffect(() => {
    if (user && firestore && courseId) {
        const unsubscribe = onSnapshot(doc(firestore, 'users', user.uid), (snap) => {
            if (snap.exists()) {
                const profile = snap.data() as AppUser;
                setIsEnrolled(profile.enrollments?.some(e => e.courseId === courseId) || false);
            }
        });
        return () => unsubscribe();
    }
  }, [user, firestore, courseId]);

  useEffect(() => {
    if (user && reviews.length > 0) {
      const userReview = reviews.find(review => review.userId === user.uid);
      setHasUserReviewed(!!userReview);
    } else if (!user) {
      setHasUserReviewed(false);
    }
  }, [user, reviews]);


  if (course === undefined) {
    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Header />
            <main className="flex-1">
                 <div className="h-16 border-b" />
                 <section className="bg-background py-8 md:py-12">
                    <CourseDetailSkeleton />
                </section>
            </main>
            <Footer />
        </div>
    )
  }

  if (course === null) {
    notFound();
  }

    const handleAction = async () => {
    if (isEnrolled) {
            router.push(`/student-dashboard/learn/${course.id}`);
    } else if (!user) {
            router.push(`/login?redirect=/course/${course.id}`);
        } else if (course.isFree) {
            setIsEnrolling(true);
            try {
                const idToken = await user.getIdToken();
                const result = await enrollFreeCourse(idToken, course.id);
                if (!result.success) {
                    throw new Error(result.message || 'Enrollment failed.');
                }
                toast({ title: 'Enrolled successfully!', description: `You now have access to ${course.title}.` });
                router.push(`/student-dashboard/learn/${course.id}`);
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Enrollment failed', description: error.message || 'Could not enroll you right now. Please try again.' });
            } finally {
                setIsEnrolling(false);
            }
    } else {
            const attachedBook = (course.books || [])[0];
            addToCart(course, {
                coursePurchaseOption: attachedBook && purchaseOption === 'course_with_book' ? 'course_with_book' : 'course_only',
                attachedBookId: attachedBook?.id,
                attachedBookTitle: attachedBook?.title,
                attachedBookPrice: Number(attachedBook?.price || 0),
            });
            toast({ title: 'Added to cart', description: `${course.title} has been added to your cart.` });
            router.push('/student-dashboard/cart');
    }
  };
  
  const handleSubmitReview = async () => {
    if (!user || !course || hasUserReviewed) return;

    setIsSubmittingReview(true);
    try {
      const idToken = await user.getIdToken();
      const result = await submitReview({
        courseId: course.id,
        rating: reviewRating,
        text: reviewText,
      }, idToken);

      if ('error' in result) {
        throw new Error(result.error);
      }

      // Refresh reviews
      const updatedReviews = await getReviewsByCourseReference(course.id, course.title);
      setReviews(updatedReviews);

      toast({
        title: 'Review submitted!',
        description: 'Thank you for sharing your feedback.',
      });

      // Reset form
      setReviewText('');
      setReviewRating(5);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to submit review',
        description: error.message || 'Please try again.',
      });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const totalLessons = course.sections?.reduce((acc, section) => acc + (section.lessons?.length || 0), 0) || 0;
  const totalHours = (course.sections?.reduce((acc, section) => {
    const sectionDuration = section.lessons?.reduce((lessonAcc, lesson) => lessonAcc + (lesson.duration || 0), 0) || 0;
    return acc + sectionDuration;
  }, 0) || 0) / 60;
  const attachedBook = (course.books || [])[0];
  const listing = getCourseListingPrice(course);
  const bundlePrice = listing + Number(attachedBook?.price || 0);
  const selectedPrice = purchaseOption === 'course_with_book' && attachedBook ? bundlePrice : listing;

    const resolvedImageUrl = resolveMediaUrl(course.imageUrl);
  
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="sticky top-16 z-40 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 border-b">
            <div className="page-container flex h-16 items-center justify-between">
                <h2 className="font-headline text-lg font-bold truncate">{course.title}</h2>
                {isEnrolled ? (
                    <Badge variant="outline" className="hidden sm:flex text-success border-success bg-success/5 gap-1.5 font-bold uppercase tracking-widest text-[10px]">
                        <CheckCircle2 size={12} />
                        Purchased
                    </Badge>
                ) : null}
            </div>
        </div>

        <section className="bg-background py-8 md:py-12">
            <div className="page-container">
                {isPreview ? (
                    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                        Preview Mode: This view is visible to authorized reviewers and course owners before public release.
                    </div>
                ) : null}
                <Breadcrumbs
                    items={[
                        { label: 'Home', href: '/' },
                        { label: 'Courses', href: '/courses' },
                        { label: course.title || 'Course' },
                    ]}
                />
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                         <Card className="overflow-hidden rounded-lg shadow-lg">
                            <div className="relative aspect-video w-full">
                                <ImageWithFallback 
                                    src={resolvedImageUrl} 
                                    alt={course.description || course.title} 
                                    fill 
                                    className="object-cover" 
                                />
                            </div>
                            <CardContent className="p-6">
                                <h1 className="mb-2 font-headline text-3xl font-bold md:text-4xl">{course.title}</h1>
                                <p className="text-lg text-muted-foreground">{course.subtitle}</p>
                                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                        <span className="font-bold text-accent">{course.rating || 5.0}</span>
                                        <Star className="h-4 w-4 fill-accent text-accent" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Users className="h-4 w-4" />
                                        <span>{course.studentsCount || 0} students</span>
                                    </div>
                                    {isEnrolled && (
                                        <Badge variant="outline" className="text-success border-success bg-success/5 gap-1.5 font-bold uppercase tracking-widest text-[10px]">
                                            <CheckCircle2 size={12} />
                                            Owned
                                        </Badge>
                                    )}
                                </div>
                            </CardContent>
                         </Card>

                        <Tabs defaultValue="overview" className="mt-8">
                            <TabsList className="w-full lg:w-auto">
                                <TabsTrigger value="overview">Overview</TabsTrigger>
                                <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
                                <TabsTrigger value="reviews" className="gap-1.5">
                                    <MessageSquare className="h-4 w-4" />
                                    Reviews ({reviews.length})
                                </TabsTrigger>
                                <TabsTrigger value="instructor">Instructor</TabsTrigger>
                            </TabsList>
                            <TabsContent value="overview" className="mt-6 rounded-lg border bg-card p-6">
                               <h3 className="font-headline text-2xl font-bold mb-4">What you'll learn</h3>
                                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {course.whatYoullLearn?.map((item, idx) => (
                                        <li key={idx} className="flex items-start gap-3">
                                            <CheckCircle className="mt-1 h-5 w-5 flex-shrink-0 text-accent" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </TabsContent>
                            <TabsContent value="curriculum" className="mt-6 rounded-lg border bg-card p-6">
                                <h3 className="font-headline text-2xl font-bold mb-4">Course Curriculum</h3>
                                <Accordion type="single" collapsible className="w-full">
                                    {course.sections?.map((section, index) => (
                                        <AccordionItem value={`item-${index}`} key={section.id || index}>
                                            <AccordionTrigger className="font-bold">{section.title}</AccordionTrigger>
                                            <AccordionContent>
                                                <ul className="space-y-2 p-2">
                                                    {section.lessons?.map(lesson => (
                                                        <li key={lesson.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                                            <div className="flex items-center gap-3">
                                                                <PlayCircle className="h-5 w-5 text-muted-foreground" />
                                                                <span className="text-sm">{lesson.title}</span>
                                                                <Badge variant="outline">{lesson.type}</Badge>
                                                            </div>
                                                            <span className="text-sm text-muted-foreground">{lesson.duration || 0}min</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </TabsContent>
                            <TabsContent value="reviews" className="mt-6 rounded-lg border bg-card p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="font-headline text-2xl font-bold">Student Reviews</h3>
                                    {reviews.length > 1 && (
                                        <Select value={reviewSort} onValueChange={(v) => setReviewSort(v as typeof reviewSort)}>
                                             <SelectTrigger className="w-full sm:w-[160px] h-9">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="recent">Most Recent</SelectItem>
                                                <SelectItem value="highest">Highest Rated</SelectItem>
                                                <SelectItem value="lowest">Lowest Rated</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>

                                {/* Review Submission Form */}
                                {user && isEnrolled && !hasUserReviewed && (
                                    <Card className="border-2 border-primary/20 bg-primary/5 mb-6">
                                        <CardContent className="p-6">
                                            <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
                                                <MessageSquare className="h-5 w-5 text-primary" />
                                                Share Your Experience
                                            </h4>
                                            <div className="space-y-4">
                                                <div>
                                                    <Label className="text-sm font-medium">Rating</Label>
                                                    <div className="flex items-center gap-1 mt-2">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <button
                                                                key={star}
                                                                type="button"
                                                                onClick={() => setReviewRating(star)}
                                                                className="focus:outline-none"
                                                            >
                                                                <Star
                                                                    className={`h-6 w-6 ${
                                                                        star <= reviewRating
                                                                            ? 'fill-accent text-accent'
                                                                            : 'text-muted-foreground hover:text-accent'
                                                                    } transition-colors`}
                                                                />
                                                            </button>
                                                        ))}
                                                        <span className="ml-2 text-sm text-muted-foreground">
                                                            {reviewRating} star{reviewRating !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label htmlFor="review-text" className="text-sm font-medium">
                                                        Your Review
                                                    </Label>
                                                    <Textarea
                                                        id="review-text"
                                                        placeholder="Tell others about your learning experience..."
                                                        value={reviewText}
                                                        onChange={(e) => setReviewText(e.target.value)}
                                                        rows={4}
                                                        className="mt-2"
                                                        maxLength={2000}
                                                    />
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {reviewText.length}/2000 characters
                                                    </p>
                                                </div>
                                                <Button
                                                    onClick={handleSubmitReview}
                                                    disabled={isSubmittingReview || reviewText.length < 10}
                                                    className="w-full sm:w-auto"
                                                >
                                                    {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {user && isEnrolled && hasUserReviewed && (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                                        <p className="text-green-800 text-sm flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4" />
                                            You've already reviewed this course. Thank you for your feedback!
                                        </p>
                                    </div>
                                )}

                                {user && !isEnrolled && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                                        <p className="text-amber-800 text-sm">
                                            You must be enrolled in this course to leave a review.
                                        </p>
                                    </div>
                                )}

                                {sortedReviews.length > 0 ? (
                                    <div className="space-y-4">
                                        {sortedReviews.map((review) => (
                                            <Card key={review.id} className="border-0 bg-muted/30">
                                                <CardContent className="p-4">
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div>
                                                            <p className="font-bold text-sm">{review.userId}</p>
                                                            <div className="flex items-center gap-1 mt-1">
                                                                {Array.from({ length: 5 }).map((_, i) => (
                                                                    <Star
                                                                        key={i}
                                                                        className={`h-3.5 w-3.5 ${
                                                                            i < review.rating
                                                                                ? 'fill-accent text-accent'
                                                                                : 'text-muted-foreground'
                                                                        }`}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(review.date).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-foreground leading-relaxed">{review.text}</p>
                                                    {review.reply && (
                                                        <div className="mt-4 p-3 bg-background rounded border-l-2 border-primary">
                                                            <p className="text-xs font-bold text-primary mb-1">Instructor's Reply</p>
                                                            <p className="text-xs text-muted-foreground">{review.reply}</p>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-12 text-center text-muted-foreground">
                                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                        <p className="font-bold">No reviews yet</p>
                                        <p className="text-sm mt-2">Be the first to review this course!</p>
                                    </div>
                                )}
                            </TabsContent>
                            <TabsContent value="instructor" className="mt-6 rounded-lg border bg-card p-6">
                                <h3 className="font-headline text-2xl font-bold mb-4">About the Instructor</h3>
                                {course.instructor && (
                                    <div className="flex flex-col items-center gap-6 sm:flex-row">
                                        <Avatar className="h-24 w-24">
                                            <AvatarImage src={resolveAvatarUrl(course.instructor.avatar)} />
                                            <AvatarFallback>{course.instructor.name?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h4 className="text-xl font-bold">{course.instructor.name}</h4>
                                            <p className="text-accent font-medium">{course.instructor.title}</p>
                                            <p className="mt-2 text-muted-foreground">{course.instructor.bio}</p>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>

                    <aside className="lg:col-span-1">
                        <div className="sticky top-24 space-y-6">
                            <Card className="shadow-lg">
                                <CardContent className="p-6">
                                    <div className="mb-4 text-center">
                                        <span className="text-4xl font-bold font-headline">
                                            {isEnrolled ? 'Access Granted' : course.isFree ? 'Free' : `GH₵${selectedPrice.toFixed(2)}`}
                                        </span>
                                    </div>
                                    {!isEnrolled && !course.isFree && attachedBook && (
                                        <div
                                            className="mb-4 rounded-xl border-2 border-primary/35 bg-gradient-to-br from-primary/[0.08] via-background to-background p-4 shadow-md ring-1 ring-primary/10"
                                            role="region"
                                            aria-label="Purchase options"
                                        >
                                            <div className="mb-3 flex items-center gap-2">
                                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                                                    <Package className="h-4 w-4" aria-hidden />
                                                </span>
                                                <div>
                                                    <p className="font-headline text-sm font-bold leading-tight text-foreground">
                                                        Add the companion book?
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Check the box to bundle — leave unchecked for course only.
                                                    </p>
                                                </div>
                                            </div>
                                            <label
                                                htmlFor="purchase-with-book"
                                                className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent bg-background/80 p-3 transition-colors hover:border-primary/25 hover:bg-background"
                                            >
                                                <Checkbox
                                                    id="purchase-with-book"
                                                    checked={purchaseOption === 'course_with_book'}
                                                    onCheckedChange={(checked) =>
                                                        setPurchaseOption(checked === true ? 'course_with_book' : 'course_only')
                                                    }
                                                    className="mt-0.5 h-5 w-5 shrink-0 rounded-[6px]"
                                                    aria-describedby="purchase-with-book-hint"
                                                />
                                                <span className="min-w-0 flex-1 space-y-1">
                                                    <span className="block font-semibold text-foreground">
                                                        Include “{attachedBook.title}”
                                                    </span>
                                                    <span id="purchase-with-book-hint" className="block text-sm text-muted-foreground">
                                                        Book add-on{' '}
                                                        <span className="font-bold text-primary">+ GH₵{Number(attachedBook.price || 0).toFixed(2)}</span>
                                                        {' · '}
                                                        Bundle total{' '}
                                                        <span className="font-bold text-foreground">GH₵{bundlePrice.toFixed(2)}</span>
                                                    </span>
                                                </span>
                                            </label>
                                            <p className="mt-3 border-t border-primary/15 pt-3 text-center text-xs text-muted-foreground">
                                                <span className="font-semibold text-foreground">Course only:</span> GH₵{listing.toFixed(2)} — price above updates when you check the box.
                                            </p>
                                        </div>
                                    )}
                                    <Button 
                                        size="lg" 
                                        className="w-full font-bold" 
                                        onClick={handleAction}
                                        disabled={isEnrolling}
                                        variant={isEnrolled ? "secondary" : "default"}
                                    >
                                        {isEnrolled 
                                            ? (
                                                <>Open Course <CheckCircle2 className="ml-2 h-5 w-5" /></>
                                            ) 
                                            : !user 
                                            ? (
                                                <>Sign In to Purchase <ArrowRight className="ml-2" /></>
                                            )
                                            : isEnrolling
                                            ? (
                                                <>Enrolling...</>
                                            )
                                            : course.isFree
                                            ? (
                                                <>Enroll Free Now <ArrowRight className="ml-2" /></>
                                            )
                                            : (
                                                <>Add to Cart <ArrowRight className="ml-2" /></>
                                            )
                                        }
                                    </Button>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-6">
                                    <h3 className="font-headline font-bold mb-4">Course Details</h3>
                                    <ul className="space-y-3 text-sm">
                                        <li className="flex items-center justify-between">
                                            <span className="flex items-center gap-2 text-muted-foreground"><BarChart /> Difficulty</span>
                                            <span className="font-medium">{course.difficulty}</span>
                                        </li>
                                        <li className="flex items-center justify-between">
                                            <span className="flex items-center gap-2 text-muted-foreground"><Book /> Lessons</span>
                                            <span className="font-medium">{totalLessons}</span>
                                        </li>
                                        <li className="flex items-center justify-between">
                                            <span className="flex items-center gap-2 text-muted-foreground"><Clock /> Duration</span>
                                            <span className="font-medium">{totalHours.toFixed(1)} hours</span>
                                        </li>
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    </aside>
                </div>
            </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}