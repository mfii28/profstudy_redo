'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CheckCircle, Eye, MoreHorizontal, Loader2, Star, XCircle } from "lucide-react";
import { getCourses, saveCourse } from '@/lib/course-data';
import { type Course } from '@/lib/db';
import Link from 'next/link';
import { EmptyState } from '@/components/dashboard/empty-state';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { logAdminAction } from '@/lib/audit-data';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);
}

export default function AdminApprovedCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user: adminUser } = useUser();
  const { toast } = useToast();

  const handleUnpublish = async (course: Course) => {
    if (!adminUser) return;
    try {
      const updated = { ...course, status: 'Draft' as const };
      await saveCourse(updated);
      await logAdminAction({
        actorId: adminUser.uid,
        actorName: adminUser.displayName || adminUser.email || 'Administrator',
        action: 'COURSE_REVIEW',
        targetId: course.id,
        targetType: 'course',
        severity: 'warn',
        details: `Admin unpublished course "${course.title}".`,
      });
      setCourses(prev => prev.filter(c => c.id !== course.id));
      toast({ title: 'Course Unpublished', description: `"${course.title}" has been moved to Draft.` });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not unpublish the course.';
      toast({ variant: 'destructive', title: 'Unpublish Failed', description: message });
    }
  };

  useEffect(() => {
    const fetchCourses = async () => {
      setIsLoading(true);
      const allCourses = await getCourses();
      setCourses(allCourses.filter(c => c.status === 'Published'));
      setIsLoading(false);
    };
    fetchCourses();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <CheckCircle className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold mb-2 font-headline">Approved Courses</h1>
          <p className="text-muted-foreground">
            Manage the active course catalog, including pricing, visibility, and featured status.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Live Course Catalog</CardTitle>
          <CardDescription>
            A list of all published courses on the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : courses.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Course Title</TableHead>
                            <TableHead>Instructor</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {courses.map(course => (
                            <TableRow key={course.id}>
                                <TableCell className="font-medium max-w-xs truncate">{course.title}</TableCell>
                                <TableCell>{course.instructor?.name || 'N/A'}</TableCell>
                                <TableCell>{course.isFree ? 'Free' : formatCurrency(course.price || 0)}</TableCell>
                                <TableCell><Badge>Published</Badge></TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href={`/course/${course.id}`} target="_blank"><Eye className="mr-2 h-4 w-4"/> View Live Page</Link>
                                            </DropdownMenuItem>
                                             <DropdownMenuItem>
                                                <Star className="mr-2 h-4 w-4"/> Feature Course
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive" onClick={() => handleUnpublish(course)}>
                                                <XCircle className="mr-2 h-4 w-4"/> Unpublish
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <EmptyState
                    icon={<CheckCircle className="h-16 w-16" />}
                    title="No courses published"
                    description="Approve courses from the 'Review Pending' page to see them here."
                />
            )}
        </CardContent>
      </Card>
    </div>
  );
}
