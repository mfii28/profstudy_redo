
'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteCourse, saveCourse } from '@/lib/course-data';
import { BookCopy, PlusCircle, Edit, Copy, MoreVertical, Trash2, Clock, CheckCircle2, FileEdit, XCircle, Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ImageWithFallback } from "@/components/image-with-fallback";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/dashboard/empty-state";
import { type Course } from '@/lib/db';
import { useUser } from '@/firebase';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CourseCardSkeleton } from '@/components/course-card-skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { useTutorCourses } from '@/hooks/use-tutor-courses';
import { resolveMediaUrl } from '@/lib/media-url';
import { Input } from '@/components/ui/input';
import { deleteCourseAssetsByCourseId, previewCourseAssetPurge } from '@/app/actions/storage';

const getStatusVariant = (status?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
        case 'Published': return 'default';
        case 'Draft': return 'secondary';
        case 'Under Review': return 'outline';
        case 'Rejected': return 'destructive';
        default: return 'secondary';
    }
}

function CoursesContent() {
    const { user } = useUser();
    const searchParams = useSearchParams();
    const statusParam = searchParams.get('status');
    const { toast } = useToast();
    
    const { courses, isLoading, error, refetch } = useTutorCourses();
    const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
    const [activeTab, setActiveTab] = useState(statusParam || 'all');
    const [isDuplicatingId, setIsDuplicatingId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
    const [isDeletePreviewLoading, setIsDeletePreviewLoading] = useState(false);
    const [deletePreview, setDeletePreview] = useState<{ planned: number; preserved: number } | null>(null);

    useEffect(() => {
        if (statusParam) {
            setActiveTab(statusParam);
        }
    }, [statusParam]);

    useEffect(() => {
        const loadDeletePreview = async () => {
            if (!courseToDelete || !user) {
                setDeletePreview(null);
                return;
            }

            setIsDeletePreviewLoading(true);
            try {
                const result = await previewCourseAssetPurge(courseToDelete.id, user.uid);
                if (!result?.error) {
                    setDeletePreview({
                        planned: Number(result?.plannedDeletionCount || 0),
                        preserved: Number(result?.preservedSharedCount || 0),
                    });
                } else {
                    setDeletePreview(null);
                }
            } catch {
                setDeletePreview(null);
            } finally {
                setIsDeletePreviewLoading(false);
            }
        };

        void loadDeletePreview();
    }, [courseToDelete, user]);

    const handleDuplicate = async (course: Course) => {
        if (!user) return;
        setIsDuplicatingId(course.id);
        
        // Duplicated courses start as fresh drafts, so engagement metrics reset.
        const newCourse: Course = {
            ...course,
            id: `course-${Date.now()}`,
            title: `${course.title} (Copy)`,
            status: 'Draft',
            updatedAt: new Date().toISOString(),
            studentsCount: 0,
            rating: 0,
            reviewsCount: 0
        };

        try {
            await saveCourse(newCourse, user.uid);
            await refetch();
            toast({ title: "Course Duplicated", description: "A new draft has been created." });
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Duplication Failed", description: e?.message || "Could not duplicate this course. Please try again." });
        } finally {
            setIsDuplicatingId(null);
        }
    };

    const handleDelete = (course: Course) => {
        setDeleteConfirmationText('');
        setDeletePreview(null);
        setCourseToDelete(course);
    }
    
    const confirmDelete = async () => {
        if (courseToDelete && user) {
            setIsDeleting(true);
            try {
                const cleanupResult = await deleteCourseAssetsByCourseId(courseToDelete.id, user.uid);
                if (cleanupResult?.error) {
                    throw new Error(cleanupResult.error);
                }

                await deleteCourse(courseToDelete.id, user.uid);
                await refetch();
                toast({ title: "Course Deleted" });
            } catch (e: any) {
                toast({ title: "Delete Failed", description: e?.message || "Could not delete this course. Please try again.", variant: "destructive" });
            } finally {
                setIsDeleting(false);
                setCourseToDelete(null);
                setDeleteConfirmationText('');
                setDeletePreview(null);
            }
        }
    }

    const isDeleteConfirmed = deleteConfirmationText.trim().toUpperCase() === 'DELETE';

    const tabCounts = useMemo(() => ({
        all: courses.length,
        published: courses.filter((c) => c.status === 'Published').length,
        pending: courses.filter((c) => c.status === 'Under Review').length,
        draft: courses.filter((c) => c.status === 'Draft').length,
        rejected: courses.filter((c) => c.status === 'Rejected').length,
    }), [courses]);

    const filteredCourses = activeTab === 'all' 
        ? courses 
        : courses.filter(c => {
            const status = c.status?.toLowerCase() || '';
            if (activeTab === 'draft') return status === 'draft';
            if (activeTab === 'pending') return status === 'under review';
            if (activeTab === 'published') return status === 'published';
            if (activeTab === 'rejected') return status === 'rejected';
            return true;
        });

  return (
    <div className="space-y-8">
       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold mb-2 font-headline">Course Management</h1>
                <p className="text-muted-foreground">
                    Create, edit, and track the approval status of your academic content.
                </p>
            </div>
            <Button asChild className="shadow-lg">
                <Link href="/tutor-dashboard/courses/create">
                    <PlusCircle className="mr-2 h-4 w-4"/>
                    Create New Course
                </Link>
            </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-8 overflow-x-auto h-auto flex justify-start sm:inline-flex">
            <TabsTrigger value="all" className="gap-2 font-bold">All ({tabCounts.all})</TabsTrigger>
            <TabsTrigger value="published" className="gap-2 font-bold">
                <CheckCircle2 size={14} className="text-success"/> Published ({tabCounts.published})
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2 font-bold">
                <Clock size={14} className="text-orange-500"/> Reviewing ({tabCounts.pending})
            </TabsTrigger>
            <TabsTrigger value="draft" className="gap-2 font-bold">
                <FileEdit size={14}/> Drafts ({tabCounts.draft})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2 font-bold">
                <XCircle size={14} className="text-destructive"/> Rejected ({tabCounts.rejected})
            </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="m-0">
            {isLoading ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({length: 3}).map((_, i) => <CourseCardSkeleton key={i} />)}
                </div>
            ) : error ? (
                <div className="py-12">
                    <EmptyState
                        icon={<XCircle className="h-16 w-16 text-destructive/30" />}
                        title="Could not load courses"
                        description="There was a problem loading your course catalog. Please retry."
                        action={<Button onClick={() => refetch()}>Retry</Button>}
                    />
                </div>
            ) : filteredCourses.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredCourses.map(course => (
                    <Card key={course.id} className="flex flex-col group overflow-hidden border-none shadow-sm hover:shadow-xl transition-all">
                        <div className="relative">
                            <div className="absolute top-3 right-3 z-10">
                                <Badge variant={getStatusVariant(course.status)} className="shadow-sm backdrop-blur-md bg-opacity-90 font-bold">
                                    {course.status || 'Draft'}
                                </Badge>
                            </div>
                            <div className="relative aspect-video rounded-t-lg bg-muted overflow-hidden">
                                <ImageWithFallback src={resolveMediaUrl(course.imageUrl)} alt={course.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                            </div>
                        </div>
                        <CardHeader className="pb-2">
                            <CardTitle className="line-clamp-2 text-lg font-bold leading-tight">{course.title}</CardTitle>
                            <CardDescription className="font-bold text-primary">{course.isFree ? 'Free' : `GH₵${course.price}`}</CardDescription>
                        </CardHeader>
                        <CardFooter className="mt-auto flex justify-between items-center bg-muted/10 p-4 pt-4 border-t">
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" asChild className="h-8 font-bold">
                                    <Link href={`/tutor-dashboard/courses/edit/${course.id}`}><Edit className="mr-2 h-3.5 w-3.5"/> Edit</Link>
                                </Button>

                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4"/></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                        <Link href={`/course/${course.id}/preview`} target="_blank"><Eye className="mr-2 h-4 w-4"/> Preview Page</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDuplicate(course)} disabled={isDuplicatingId === course.id || isDeleting}>
                                        {isDuplicatingId === course.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Copy className="mr-2 h-4 w-4"/>}
                                        Duplicate
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleDelete(course)} className="text-destructive focus:text-destructive" disabled={isDeleting}>
                                        <Trash2 className="mr-2 h-4 w-4"/> Delete Permanently
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CardFooter>
                    </Card>
                ))}
            </div>
            ) : (
                <div className="py-12">
                    <EmptyState
                        icon={activeTab === 'pending' ? <Clock className="h-16 w-16 text-orange-200" /> : activeTab === 'rejected' ? <XCircle className="h-16 w-16 text-destructive/20" /> : <BookCopy className="h-16 w-16 text-muted-foreground/20" />}
                        title={activeTab === 'all' ? "Start your catalog" : `No ${activeTab} courses`}
                        description={
                            activeTab === 'pending'
                                ? "You don't have any courses currently in the approval queue. Submit a draft for review to see it here."
                                : activeTab === 'rejected'
                                    ? "No rejected courses. Keep quality high and your approvals smooth."
                                    : "Start sharing your knowledge and building your first professional course today."
                        }
                        action={activeTab === 'all' && (
                            <Button asChild>
                                <Link href="/tutor-dashboard/courses/create">
                                    <PlusCircle className="mr-2 h-4 w-4"/>
                                    Build Your First Course
                                </Link>
                            </Button>
                        )}
                    />
                </div>
            )}
        </TabsContent>
      </Tabs>
        
        <AlertDialog
            open={!!courseToDelete}
            onOpenChange={(open) => {
                if (!open) {
                    setCourseToDelete(null);
                    setDeleteConfirmationText('');
                    setDeletePreview(null);
                }
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete the course "{courseToDelete?.title}" and purge all linked storage assets for this course ID, including lesson videos, document media (PDF/DOC), and thumbnails to free up space. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2">
                    {isDeletePreviewLoading ? (
                        <p className="text-xs text-muted-foreground">Analyzing linked doc/media files...</p>
                    ) : deletePreview ? (
                        <p className="text-xs text-muted-foreground">
                            Planned deletion: <span className="font-black text-destructive">{deletePreview.planned}</span> files. Preserved shared files: <span className="font-black">{deletePreview.preserved}</span>.
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground">File impact preview unavailable. Deletion will still purge linked course files.</p>
                    )}
                    <p className="text-xs text-muted-foreground">Type <span className="font-black tracking-wide">DELETE</span> to confirm.</p>
                    <Input
                        value={deleteConfirmationText}
                        onChange={(e) => setDeleteConfirmationText(e.target.value)}
                        placeholder="Type DELETE"
                        disabled={isDeleting}
                    />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting || isDeletePreviewLoading || !isDeleteConfirmed}>
                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Delete Course
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

export default function CoursesPage() {
    return (
        <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin" /></div>}>
            <CoursesContent />
        </Suspense>
    );
}
