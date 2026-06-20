'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { CourseBuilder } from '@/components/dashboard/course-builder';
import { CourseRagIngestPanel } from '@/components/dashboard/course-rag-ingest-panel';
import { getCourseById } from '@/lib/course-data';
import { getUsers } from '@/lib/user-data';
import type { Course, User } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdminEditCoursePage() {
  const params = useParams<{ id: string }>();
  const courseId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [course, setCourse] = useState<Course | null>(null);
  const [tutors, setTutors] = useState<User[]>([]);
  const [selectedTutorId, setSelectedTutorId] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!courseId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const [fetchedCourse, usersResult] = await Promise.all([
          getCourseById(courseId),
          getUsers(),
        ]);

        setCourse(fetchedCourse || null);
        const tutorUsers = usersResult.users.filter((user) => user.role === 'tutor');
        setTutors(tutorUsers);
        setSelectedTutorId(fetchedCourse?.tutorId || tutorUsers[0]?.id || '');
      } finally {
        setIsLoading(false);
      }
    };

    void loadData();
  }, [courseId]);

  const selectedTutor = useMemo(
    () => tutors.find((tutor) => tutor.id === selectedTutorId),
    [tutors, selectedTutorId]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Course Not Found</CardTitle>
          <CardDescription>The requested course could not be loaded for editing.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Edit Course as Admin</CardTitle>
          <CardDescription>Edit approved courses without forcing re-approval, and optionally reassign the course owner.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 max-w-md">
          <Label>Tutor Owner</Label>
          <Select value={selectedTutorId} onValueChange={setSelectedTutorId}>
            <SelectTrigger>
              <SelectValue placeholder="Select tutor" />
            </SelectTrigger>
            <SelectContent>
              {tutors.map((tutor) => (
                <SelectItem key={tutor.id} value={tutor.id}>
                  {tutor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <CourseRagIngestPanel courseId={course.id} courseTitle={course.title} />

      <CourseBuilder
        initialCourse={course}
        ownerTutorId={selectedTutorId}
        ownerTutorProfile={selectedTutor ? {
          id: selectedTutor.id,
          name: selectedTutor.name,
          avatar: selectedTutor.avatar,
          bio: selectedTutor.bio,
        } : undefined}
        preservePublishedStatusOnEdit
      />
    </div>
  );
}