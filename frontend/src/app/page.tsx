'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarCheck,
  ChevronRight,
  GraduationCap,
  Star,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { CourseCard } from '@/components/course-card';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { getFeaturedCourses } from '@/lib/course-data';
import { getBooks } from '@/lib/book-data';
import { getTestimonials } from '@/lib/testimonial-data';
import { type Book, type Course, type Testimonial } from '@/lib/db';
import { BecomeATutorBanner } from '@/components/become-a-tutor-banner';
import { StudentSuccessRoadmap } from '@/components/student-success-roadmap';
import { CourseCardSkeleton } from '@/components/course-card-skeleton';
import { resolveMediaUrl, resolveAvatarUrl } from '@/lib/media-url';
import {
  getHomeContent,
  defaultHomeContent,
  type FeatureItem,
  type QualificationPathItem,
  type FeatureIconKey,
} from '@/lib/site-content-data';

const FEATURE_ICON_MAP: Record<FeatureIconKey, React.ReactNode> = {
  BrainCircuit: <BrainCircuit className="size-5" />,
  BookOpen: <BookOpen className="size-5" />,
  CalendarCheck: <CalendarCheck className="size-5" />,
  GraduationCap: <GraduationCap className="size-5" />,
};

type PublicStats = {
  activeStudents: number;
  averageRating: number;
  expertCourses: number;
  engagementRate: number;
  qualifiedStudents: number;
};

const FEATURED_COURSE_LIMIT = 4;
const FEATURED_BOOK_LIMIT = 4;

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  const [topCourses, setTopCourses] = useState<Course[]>([]);
  const [featuredBooks, setFeaturedBooks] = useState<Book[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [features, setFeatures] = useState<FeatureItem[]>(defaultHomeContent.features);
  const [qualificationPath, setQualificationPath] = useState<QualificationPathItem[]>(defaultHomeContent.qualificationPath);
  const [publicStats, setPublicStats] = useState<PublicStats>({
    activeStudents: 0,
    averageRating: 0,
    expertCourses: 0,
    engagementRate: 0,
    qualifiedStudents: 0,
  });

  useEffect(() => {
    // Affiliate Tracking: Capture referral ID from URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const refId = params.get('ref');
      if (refId) {
        localStorage.setItem('studymate_ref', refId);
      }
    }

    const fetchPageData = async () => {
      setIsLoading(true);
      try {
        const [featured, allTestimonials, booksRes, statsRes, homeContent] = await Promise.all([
          getFeaturedCourses(FEATURED_COURSE_LIMIT).catch(() => [] as Course[]),
          getTestimonials().catch(() => [] as Testimonial[]),
          fetch('/api/books', { cache: 'no-store' }).catch(() => null),
          fetch('/api/public/stats', { cache: 'no-store' }).catch(() => null),
          getHomeContent().catch(() => defaultHomeContent),
        ]);
        let books: Book[] = [];
        if (booksRes?.ok) {
          const booksJson = await booksRes.json();
          books = Array.isArray(booksJson.books) ? booksJson.books : [];
        } else {
          // Keep homepage books visible when API route has transient issues.
          books = await getBooks({ includeDraft: false, max: 4 });
        }

        setTopCourses(featured);
        setFeaturedBooks(books.slice(0, FEATURED_BOOK_LIMIT));
        setTestimonials(allTestimonials);
        setFeatures(homeContent.features);
        setQualificationPath(homeContent.qualificationPath);

        if (statsRes?.ok) {
          const statsJson = await statsRes.json();
          if (statsJson?.stats) {
            setPublicStats({
              activeStudents: Number(statsJson.stats.activeStudents || 0),
              averageRating: Number(statsJson.stats.averageRating || 0),
              expertCourses: Number(statsJson.stats.expertCourses || 0),
              engagementRate: Number(statsJson.stats.engagementRate || 0),
              qualifiedStudents: Number(statsJson.stats.qualifiedStudents || 0),
            });
          }
        }
      } catch (error) {
        console.error('Home page data fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPageData();
  }, []);

  const stats = [
    { value: `${publicStats.activeStudents.toLocaleString()}+`, label: 'Active Students' },
    { value: publicStats.averageRating > 0 ? `${publicStats.averageRating.toFixed(1)}★` : '—', label: 'Average Rating' },
    { value: `${publicStats.expertCourses.toLocaleString()}+`, label: 'Expert Courses' },
    { value: `${publicStats.engagementRate}%`, label: 'Engagement Rate' },
  ];


  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section className="relative bg-background overflow-hidden">
          {/* Subtle right-panel tint */}
          <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none">
            <div className="absolute right-0 top-0 h-full w-[50%] bg-primary/[0.025]" />
            <div className="hidden lg:block absolute right-[50%] top-0 h-full w-px bg-border" />
          </div>

          <div className="page-container grid min-h-[92dvh] items-center gap-10 py-20 md:py-24 lg:grid-cols-2 lg:py-0">
            {/* Left — copy */}
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="lg:pr-12 pt-4"
            >
              <div className="mb-8 flex items-center gap-3">
                <span className="h-px w-10 bg-accent" aria-hidden />
                <span className="section-label !mb-0">ICAG · CITG · Ghana</span>
              </div>

              <h1 className="font-headline font-black text-[clamp(2.6rem,5.5vw,4.25rem)] leading-[1.02] tracking-tight text-primary">
                Professional<br />
                Qualifications<br />
                <span className="text-accent">Done Right.</span>
              </h1>

              <p className="mt-6 text-lg text-muted-foreground max-w-[46ch] leading-relaxed">
                Expert ICAG and CITG tuition in Ghana. AI-powered study tools,
                flexible scheduling, and a track record that speaks for itself.
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                <Button size="lg" className="font-semibold px-7 h-12 text-base" asChild>
                  <Link href="/signup">
                    Start Free <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="font-semibold px-7 h-12 text-base" asChild>
                  <Link href="/courses">Browse Courses</Link>
                </Button>
              </div>

              {/* Stats strip */}
              <div className="mt-14 pt-8 border-t grid grid-cols-2 xs:grid-cols-4 gap-6">
                {stats.map((s) => (
                  <div key={s.label}>
                    <p className="font-headline font-black text-2xl text-primary leading-none">{s.value}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right — qualification journey panel */}
            <motion.div
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="hidden lg:flex items-center justify-center lg:pl-12"
            >
              <div className="w-full max-w-[340px]">
                <p className="section-label mb-5 text-muted-foreground">
                  Your Qualification Journey
                </p>
                <div className="space-y-2.5">
                  {qualificationPath.map((level) => (
                    <div
                      key={level.code}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                        level.available
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border'
                      }`}
                    >
                      <span
                        className={`font-headline font-black text-xs w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          level.available
                            ? 'bg-accent text-accent-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {level.code}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm leading-none ${level.available ? 'text-primary-foreground' : 'text-primary'}`}>
                          {level.name}
                        </p>
                        <p className={`mt-1 text-xs ${level.available ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                          {level.subtitle}
                        </p>
                      </div>
                      {level.available && (
                        <CheckCircle2 className="size-4 text-accent flex-shrink-0" aria-label="Available" />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-5 p-4 rounded-xl bg-accent/10 border border-accent/25">
                  <p className="text-sm font-semibold text-primary">Next intake opening soon</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Join thousands of students on their path to professional certification.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── WHY CHOOSE US ────────────────────────────────────────────── */}
        <section id="features" className="bg-primary section-pad-lg">
          <div className="page-container">
            <div className="mb-14">
              <p className="section-label">
                Why Choose Us
              </p>
              <h2 className="section-heading max-w-md text-primary-foreground">
                Built for professionals who need results
              </h2>
            </div>

            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-primary-foreground/10">
              {features.map((feature) => (
                <div key={feature.title} className="py-8 md:py-0 md:px-10 first:md:pl-0 last:md:pr-0">
                  <div className="flex items-start gap-5">
                    <span className="font-headline font-black text-5xl text-accent/20 leading-none select-none mt-0.5 w-10 flex-shrink-0">
                      {feature.number}
                    </span>
                    <div>
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <span className="text-accent">{FEATURE_ICON_MAP[feature.iconKey]}</span>
                        <h3 className="font-headline font-bold text-lg text-primary-foreground">
                          {feature.title}
                        </h3>
                      </div>
                      <p className="text-primary-foreground/60 text-sm leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TOP COURSES ──────────────────────────────────────────────── */}
        <section id="courses" className="bg-background section-pad-lg">
          <div className="page-container">
            <div className="mb-12 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="section-label">
                  Our Curriculum
                </p>
                <h2 className="section-heading">
                  Explore Top Courses
                </h2>
              </div>
              <Button variant="outline" size="sm" asChild className="self-start sm:self-auto flex-shrink-0">
                <Link href="/courses">
                  View All <ChevronRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {isLoading ? (
                Array.from({ length: FEATURED_COURSE_LIMIT }).map((_, index) => (
                  <CourseCardSkeleton key={index} />
                ))
              ) : topCourses.length > 0 ? (
                topCourses.map((course) => (
                  <CourseCard key={course.id} course={course} />
                ))
              ) : (
                <div className="col-span-full py-16 text-center text-muted-foreground border-2 border-dashed rounded-2xl bg-muted/10">
                  <AlertCircle className="mx-auto h-8 w-8 mb-3 opacity-40" />
                  <p className="text-base font-medium">No verified courses found.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── FEATURED BOOKS ───────────────────────────────────────────── */}
        <section id="books" className="bg-surface-muted section-pad-lg">
          <div className="page-container">
            <div className="mb-12 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="section-label">
                  Study Materials
                </p>
                <h2 className="section-heading">
                  Featured Books
                </h2>
                <p className="mt-2 text-sm text-muted-foreground max-w-md">
                  Digital and physical books, DRM-protected for secure online reading.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="self-start sm:self-auto flex-shrink-0">
                <Link href="/shop">
                  View All Books <ChevronRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {isLoading ? (
                Array.from({ length: FEATURED_BOOK_LIMIT }).map((_, index) => (
                  <CourseCardSkeleton key={`book-skeleton-${index}`} />
                ))
              ) : featuredBooks.length > 0 ? (
                featuredBooks.map((book) => (
                  <Link
                    key={book.id}
                    href="/shop"
                    className="group block rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="relative h-44 bg-muted">
                      {book.coverUrl ? (
                        <Image
                          src={resolveMediaUrl(book.coverUrl)}
                          alt={book.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <BookOpen className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={book.type === 'digital' ? 'default' : 'secondary'}>
                          {book.type}
                        </Badge>
                        <Badge variant="outline">{book.category}</Badge>
                      </div>
                      <h3 className="font-semibold text-sm line-clamp-2">{book.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">by {book.author}</p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="col-span-full py-16 text-center text-muted-foreground border-2 border-dashed rounded-2xl bg-muted/10">
                  <AlertCircle className="mx-auto h-8 w-8 mb-3 opacity-40" />
                  <p className="text-base font-medium">No books published yet.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <StudentSuccessRoadmap />

        <BecomeATutorBanner />

        {/* ── TESTIMONIALS ─────────────────────────────────────────────── */}
        <section className="bg-background section-pad-lg">
          <div className="page-container">
            <div className="mb-12 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="section-label">
                  Testimonials
                </p>
                <h2 className="section-heading max-w-md">
                  Loved by learners across Ghana
                </h2>
              </div>
              <Button variant="outline" size="sm" asChild className="self-start sm:self-auto flex-shrink-0">
                <Link href="/testimonials">
                  View all <ChevronRight className="ml-1 size-4" />
                </Link>
              </Button>
            </div>

            <Carousel opts={{ align: 'start', loop: true }} className="w-full">
              <CarouselContent>
                {testimonials.map((testimonial, index) => (
                  <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3">
                    <div className="p-1">
                      <div className="flex h-full flex-col rounded-xl bg-card border p-6">
                        <div className="flex gap-0.5 mb-4">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                          ))}
                        </div>
                        <p className="flex-grow text-muted-foreground text-sm leading-relaxed">
                          &ldquo;{testimonial.text}&rdquo;
                        </p>
                        <div className="mt-6 flex items-center gap-3 pt-4 border-t">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={resolveAvatarUrl(testimonial.avatar)} alt={testimonial.name} />
                            <AvatarFallback className="text-xs font-bold">
                              {testimonial.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-sm text-primary">{testimonial.name}</p>
                            <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden sm:flex" />
              <CarouselNext className="hidden sm:flex" />
            </Carousel>
          </div>
        </section>

      </main>
      <Footer />
    </div>
  );
}
