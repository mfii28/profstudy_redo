'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { CourseBuilder } from '@/components/dashboard/course-builder';
import { CourseRagIngestPanel } from '@/components/dashboard/course-rag-ingest-panel';
import { getCourseById } from '@/lib/course-data';
import { type Course } from '@/lib/db';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function EditCoursePage() {
    const params = useParams();
    const courseId = params.courseId as string;
    const [course, setCourse] = useState<Course | null | undefined>(undefined);
    const [loadError, setLoadError] = useState<string | null>(null);

    const fetchCourse = useCallback(async () => {
        if (!courseId) return;
        setCourse(undefined);
        setLoadError(null);
        try {
            const courseData = await getCourseById(courseId);
            setCourse(courseData ?? null);
        } catch {
            setLoadError('Failed to load this course. Please try again.');
            setCourse(null);
        }
    }, [courseId]);

    useEffect(() => {
        void fetchCourse();
    }, [fetchCourse]);

    if (loadError) {
        return (
            <div className="space-y-4">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Could not load course</AlertTitle>
                    <AlertDescription>{loadError}</AlertDescription>
                </Alert>
                <Button onClick={() => void fetchCourse()}>Retry</Button>
            </div>
        );
    }

    if (course === undefined) {
        return (
            <div className="space-y-8">
                <Skeleton className="h-16 w-1/2" />
                <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-12">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        );
    }

    if (course === null) {
        return <div>Course not found.</div>;
    }

    return (
        <div className="space-y-6">
            <CourseRagIngestPanel courseId={course.id} courseTitle={course.title} />
            <CourseBuilder initialCourse={course} showPricing={true} />
        </div>
    );
}
