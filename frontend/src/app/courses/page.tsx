'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { LayoutGrid, List, Search, Star, Users, AlertCircle, ArrowUpDown } from 'lucide-react';
import { CourseCard } from '@/components/course-card';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { type Course } from '@/lib/db';
import { getCourses } from '@/lib/course-data';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { BecomeATutorBanner } from '@/components/become-a-tutor-banner';
import { CourseCardSkeleton, CourseListSkeleton } from '@/components/course-card-skeleton';
import { ImageWithFallback } from '@/components/image-with-fallback';
import { resolveMediaUrl } from '@/lib/media-url';

type ViewMode = 'grid' | 'list';
type SortOption = 'popular' | 'rated' | 'newest' | 'price-low' | 'price-high';

function CourseListItem({ course }: { course: Course }) {
    const formatCount = (count?: number) => {
        if (!count) return '0';
        return new Intl.NumberFormat('en-US').format(count);
    }
    const resolvedImageUrl = resolveMediaUrl(course.imageUrl);

  return (
    <Link href={`/course/${course.id}`}>
        <Card className="flex flex-col overflow-hidden rounded-lg shadow-sm transition-shadow hover:shadow-lg md:flex-row">
          <div className="relative h-48 w-full flex-shrink-0 md:h-auto md:w-64">
            <ImageWithFallback
              src={resolvedImageUrl}
              alt={course.description}
              fill
              className="object-cover"
            />
          </div>
          <div className="flex flex-1 flex-col p-6">
            <div className="flex-1">
              <Badge variant="secondary" className="mb-2">
                {course.difficulty}
              </Badge>
              <CardTitle className="mb-2 font-headline text-xl font-bold">
                {course.title}
              </CardTitle>
              <CardDescription className="mb-4">
                By {course.instructor?.name}
              </CardDescription>
              <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
                {course.subtitle}
              </p>
            </div>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-accent">{course.rating}</span>
                  <Star className="h-4 w-4 fill-accent text-accent" />
                  <span className="text-xs text-muted-foreground">({formatCount(course.reviewsCount)})</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span className="text-xs">{formatCount(course.studentsCount)} students</span>
                </div>
              </div>
              <div className="text-2xl font-bold text-primary">
                 {course.isFree ? 'Free' : `GH₵${course.price}`}
              </div>
            </div>
          </div>
        </Card>
    </Link>
  );
}


export default function CoursesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('popular');

  useEffect(() => {
    const fetchCourses = async () => {
        setIsLoading(true);
        try {
            const fetchedCourses = await getCourses();
            
            // SECURITY: Show only published courses on public catalog
            const published = fetchedCourses.filter(c => c.status === 'Published');
            setAllCourses(published);
            setCourses(published);
        } catch (error) {
            console.error("Courses page fetch error:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    fetchCourses();
  }, []);

  // Apply search, category, difficulty filters, and sorting
  useEffect(() => {
    let filtered = allCourses;

    // Filter by search term (title, subtitle, description)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(term) ||
        c.subtitle.toLowerCase().includes(term) ||
        c.description?.toLowerCase().includes(term)
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(c => c.category === selectedCategory);
    }

    // Filter by difficulty
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter(c => c.difficulty === selectedDifficulty);
    }

    // Sort
    const sorted = [...filtered];
    switch (sortBy) {
      case 'popular':
        sorted.sort((a, b) => (b.studentsCount || 0) - (a.studentsCount || 0));
        break;
      case 'rated':
        sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'newest':
        sorted.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        break;
      case 'price-low':
        sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price-high':
        sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
    }

    setCourses(sorted);
  }, [searchTerm, selectedCategory, selectedDifficulty, sortBy, allCourses]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <section className="bg-primary text-primary-foreground">
          <div className="page-container section-pad">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <h1 className="font-headline text-4xl font-bold md:text-5xl">
                Explore Our Course Catalog
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
                Find the perfect course to help you achieve your career goals.
              </p>
            </motion.div>
          </div>
        </section>

        <section className="bg-background section-pad">
          <div className="page-container">
          <div className="sticky top-16 z-40 mb-8 rounded-lg border bg-card/80 p-4 shadow-sm backdrop-blur-lg">
            <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-4">
              <div className="relative md:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                <Input 
                  placeholder="Search for courses..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10" 
                />
              </div>
              <div className="flex items-center justify-center gap-2 md:col-span-1">
                <Button 
                  variant={selectedCategory === 'all' ? 'default' : 'ghost'}
                  onClick={() => setSelectedCategory('all')}
                  size="sm"
                >
                  All
                </Button>
                <Button 
                  variant={selectedCategory === 'icag' ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory('icag')}
                  size="sm"
                >
                  ICAG
                </Button>
                <Button 
                  variant={selectedCategory === 'citg' ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory('citg')}
                  size="sm"
                >
                  CITG
                </Button>
                <Select value={selectedDifficulty} onValueChange={(v) => setSelectedDifficulty(v)}>
                  <SelectTrigger className="w-full xs:w-[130px] h-9">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 md:col-span-1">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="w-full h-9">
                    <ArrowUpDown className="h-3.5 w-3.5 mr-2 shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="rated">Highest Rated</SelectItem>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="price-low">Price: Low to High</SelectItem>
                    <SelectItem value="price-high">Price: High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-end gap-2 md:col-span-1">
                <span className="text-xs text-muted-foreground font-medium mr-2">{courses.length} course{courses.length !== 1 ? 's' : ''}</span>
                <Button variant="ghost" size="icon" onClick={() => setViewMode('grid')} className={cn('rounded-md', viewMode === 'grid' && 'bg-accent text-accent-foreground hover:bg-accent/90')}>
                  <LayoutGrid />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setViewMode('list')} className={cn('rounded-md', viewMode === 'list' && 'bg-accent text-accent-foreground hover:bg-accent/90')}>
                  <List />
                </Button>
              </div>
            </div>
          </div>

          <motion.div
            layout
            className={cn(
              'grid gap-8',
              viewMode === 'grid'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1'
            )}
          >
            {isLoading ? (
                viewMode === 'grid' ? (
                    Array.from({ length: 6 }).map((_, index) => <CourseCardSkeleton key={index} />)
                ) : (
                    Array.from({ length: 4 }).map((_, index) => <CourseListSkeleton key={index} />)
                )
            ) : courses.length > 0 ? (
                courses.map((course) => (
                <motion.div layout key={course.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                    {viewMode === 'grid' ? (
                    <CourseCard course={course} />
                    ) : (
                    <CourseListItem course={course} />
                    )}
                </motion.div>
                ))
            ) : (
                <div className="col-span-full rounded-2xl border-2 border-dashed bg-surface py-20 text-center text-muted-foreground">
                    <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-20" />
                    <p className="text-xl font-bold">No courses found</p>
                    <p className="max-w-xs mx-auto mt-2">
                      {allCourses.length === 0 
                        ? 'Check back soon for new courses.' 
                        : 'Try adjusting your search or filters to find what you\'re looking for.'}
                    </p>
                </div>
            )}
          </motion.div>
          </div>
        </section>
        <BecomeATutorBanner />
      </main>
      <Footer />
    </div>
  );
}