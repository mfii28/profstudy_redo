'use client';

import { useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatarUrl } from '@/lib/media-url';
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { type User } from "@/lib/db";
import { useUser } from "@/firebase";
import { Loader2, Search, Users } from "lucide-react";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Input } from '@/components/ui/input';
import { useTutorCourses } from '@/hooks/use-tutor-courses';
import { useTutorStudents } from '@/hooks/use-tutor-students';

export default function StudentsPage() {
    const { user: tutorAuth, isLoading: isTutorLoading } = useUser();
    const { courses } = useTutorCourses();
    const {
        allStudents,
        isLoading,
        error,
        refetch,
        searchStudents,
    } = useTutorStudents({ pageSize: 500 });
    const [searchTerm, setSearchTerm] = useState('');

    const hasSearch = searchTerm.trim().length > 0;
    const visibleStudents = useMemo(() => {
        if (!hasSearch) return allStudents;
        return searchStudents(searchTerm);
    }, [allStudents, hasSearch, searchStudents, searchTerm]);

    const studentCourseTitlesById = useMemo(() => {
        const taughtCourseIds = new Set(courses.map((course) => course.id));
        const courseMap = new Map(courses.map((course) => [course.id, course.title]));
        const map = new Map<string, string[]>();
        for (const student of allStudents) {
            const titles = (student.enrollments || [])
                .filter((enrollment) => taughtCourseIds.has(enrollment.courseId))
                .map((enrollment) => courseMap.get(enrollment.courseId) || enrollment.courseId);
            map.set(student.id, titles);
        }
        return map;
    }, [allStudents, courses]);

    if (isTutorLoading) {
        return (
             <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!tutorAuth) return null;

  return (
    <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
            <div>
                <h1 className="text-3xl font-bold mb-1 font-headline tracking-tight">Student Registry</h1>
                <p className="text-muted-foreground text-sm">
                    Lifetime student list across all your courses.
                </p>
            </div>
            <div className="w-full sm:w-72 space-y-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by student name..."
                        className="pl-9 pr-20 bg-background"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {hasSearch && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7"
                            onClick={() => setSearchTerm('')}
                        >
                            Clear
                        </Button>
                    )}
                </div>
                {hasSearch && (
                    <p className="text-xs text-muted-foreground">{visibleStudents.length} result(s) found</p>
                )}
            </div>
        </div>

        <Card className="border-none shadow-lg overflow-hidden">
            <CardHeader className="bg-muted/30 border-b p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Active Learners</CardTitle>
                        <CardDescription>
                            Students who have ever enrolled in your {courses.length} course(s).
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="h-6 font-bold uppercase tracking-widest bg-primary/5">
                        {allStudents.length} Total Students
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Syncing Registry...</p>
                    </div>
                ) : error ? (
                    <div className="py-20">
                        <EmptyState
                            icon={<Users className="h-16 w-16 text-destructive/30" />}
                            title="Unable to load students"
                            description="There was a problem loading student records. Please retry."
                            action={<Button onClick={() => refetch()}>Retry</Button>}
                        />
                    </div>
                ) : visibleStudents.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/10">
                                    <TableRow>
                                        <TableHead className="pl-6 w-[340px]">Student</TableHead>
                                        <TableHead>Enrolled Courses</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {visibleStudents.map((student) => (
                                        <TableRow key={student.id} className="hover:bg-muted/5 transition-colors group">
                                            <TableCell className="pl-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                                                        <AvatarImage src={resolveAvatarUrl(student.avatar)} alt={student.name} />
                                                        <AvatarFallback className="bg-primary/5 text-primary font-bold">
                                                            {student.name.split(' ').map((n) => n[0]).join('')}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-sm truncate">{student.name}</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase truncate tracking-tighter">Student ID: {student.id.substring(0, 12)}</p>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-2 py-2">
                                                    {(studentCourseTitlesById.get(student.id) ?? []).length > 0 ? (
                                                        (studentCourseTitlesById.get(student.id) ?? []).map((title) => (
                                                            <Badge key={`${student.id}-${title}`} variant="outline" className="text-[10px]">
                                                                {title}
                                                            </Badge>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">No enrolled courses</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                ) : (
                    <div className="py-32">
                        <EmptyState
                            icon={<Users className="h-16 w-16 text-muted-foreground/20" />}
                            title={searchTerm ? "No results found" : "Your registry is empty"}
                            description={searchTerm ? `We couldn't find any students matching "${searchTerm}".` : "Students will appear here after they enroll in your courses."}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}