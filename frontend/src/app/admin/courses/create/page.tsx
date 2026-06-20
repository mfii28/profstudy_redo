'use client';

import { useMemo, useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { getUsers } from '@/lib/user-data';
import type { Course, User } from '@/lib/db';
import { CourseBuilder } from '@/components/dashboard/course-builder';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

function createDraftForTutor(tutor: User | undefined): Course {
  return {
    id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tutorId: tutor?.id || '',
    title: 'Untitled Course',
    subtitle: '',
    description: '',
    imageUrl: '',
    imageHint: 'accounting study',
    category: '',
    difficulty: 'Beginner',
    language: 'English',
    sections: [],
    price: 0,
    isFree: false,
    status: 'Draft',
    instructor: {
      name: tutor?.name || 'Academic Expert',
      title: 'Instructor',
      avatar: tutor?.avatar || '',
      bio: tutor?.bio || '',
    },
    whatYoullLearn: [],
    prerequisites: [],
  };
}

export default function AdminCreateCoursePage() {
  const { user: adminUser } = useUser();
  const [tutors, setTutors] = useState<User[]>([]);
  const [selectedTutorId, setSelectedTutorId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTutors = async () => {
      setIsLoading(true);
      try {
        const usersResult = await getUsers();
        const tutorUsers = usersResult.users.filter((user) => user.role === 'tutor');
        setTutors(tutorUsers);
        if (tutorUsers.length > 0) {
          setSelectedTutorId(tutorUsers[0].id);
        }
      } finally {
        setIsLoading(false);
      }
    };

    void loadTutors();
  }, []);

  const selectedTutor = useMemo(
    () => tutors.find((tutor) => tutor.id === selectedTutorId),
    [tutors, selectedTutorId]
  );

  if (!adminUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tutors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Tutors Available</CardTitle>
          <CardDescription>Create or approve at least one tutor account before creating courses from admin.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Course as Admin</CardTitle>
          <CardDescription>Select the tutor owner for this course before building content.</CardDescription>
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

      <CourseBuilder
        key={selectedTutorId}
        ownerTutorId={selectedTutorId}
        initialCourse={createDraftForTutor(selectedTutor)}
      />
    </div>
  );
}
