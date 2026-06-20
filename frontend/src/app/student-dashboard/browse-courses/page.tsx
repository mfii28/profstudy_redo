'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import { CourseCard } from '@/components/course-card';
import { CourseCardSkeleton } from '@/components/course-card-skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { type Course } from '@/lib/db';
import { getPublishedCourses } from '@/lib/course-data';

export default function BrowseCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    const fetchCourses = async () => {
      setIsLoading(true);
      const publishedCourses = await getPublishedCourses();
      setCourses(publishedCourses);
      setIsLoading(false);
    };
    void fetchCourses();
  }, []);

  const categories = ['All', ...Array.from(new Set(courses.map((course) => course.category).filter(Boolean)))];

  const filteredCourses = courses.filter(course => {
    const matchesSearch = 
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.subtitle.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = 
      selectedCategory === 'All' || 
      course.category?.toLowerCase() === selectedCategory.toLowerCase();
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 font-headline">Browse Courses</h1>
        <p className="text-muted-foreground">
          Explore our expert-led courses and find your path to professional mastery.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between sticky top-20 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 p-4 border rounded-lg shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input 
            placeholder="Search courses..." 
            className="pl-9" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
          {categories.map(category => (
            <Button
              key={category}
              variant={selectedCategory === category ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <CourseCardSkeleton key={i} />)
        ) : filteredCourses.length > 0 ? (
          filteredCourses.map(course => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <CourseCard course={course} />
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center">
            <p className="text-muted-foreground">No courses found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
