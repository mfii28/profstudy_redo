
'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCourses, saveCourse, deleteCourse, assignCourseToTutor } from '@/lib/course-data';
import { createClassroom } from '@/app/actions/classroom';
import { type Course, type CourseStatus, type User } from '@/lib/db';
import { getUserById, getUsers } from '@/lib/user-data';
import { hasPermission } from '@/lib/rbac-data';
import { useState, useEffect } from 'react';
import { Check, X, Eye, MoreHorizontal, Trash2, Loader2, AlertCircle, PlusCircle, DollarSign, Pencil } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase";
import { logAdminAction } from "@/lib/audit-data";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteCourseAssetsByCourseId, previewCourseAssetPurge } from '@/app/actions/storage';
import { sendTransactionalEmail } from '@/app/actions/email';

const getStatusVariant = (status?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
        case 'Published': return 'default';
        case 'Draft': return 'secondary';
        case 'Under Review': return 'outline';
        case 'Rejected': return 'destructive';
        default: return 'secondary';
    }
}

export default function AdminCoursesPage() {
    const { user: adminUser } = useUser();
    const [courses, setCourses] = useState<Course[]>([]);
    const [activeFilter, setActiveFilter] = useState<'under-review' | 'all' | 'rejected' | 'draft'>('under-review');
    const [isLoading, setIsLoading] = useState(true);
    const [tutors, setTutors] = useState<User[]>([]);
    const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
    const [selectedTutorByCourseId, setSelectedTutorByCourseId] = useState<Record<string, string>>({});
    const [assigningCourseId, setAssigningCourseId] = useState<string | null>(null);
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
    const [isDeletePreviewLoading, setIsDeletePreviewLoading] = useState(false);
    const [deletePreview, setDeletePreview] = useState<{ planned: number; preserved: number } | null>(null);
    const [courseToApprove, setCourseToApprove] = useState<Course | null>(null);
    const [approvalIsFree, setApprovalIsFree] = useState(false);
    const [approvalPrice, setApprovalPrice] = useState<number>(0);
    const [isApproving, setIsApproving] = useState(false);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (!adminUser) return;
        getUserById(adminUser.uid).then((profile) => {
            setIsSuperAdmin(profile?.role === 'superadmin');
        });
    }, [adminUser]);

    const fetchCourses = async () => {
        setIsLoading(true);
        try {
            const [fetchedCourses, usersResult] = await Promise.all([
                getCourses(),
                getUsers(),
            ]);
            setCourses(fetchedCourses);
            const tutorUsers = usersResult.users.filter((user) => user.role === 'tutor');
            setTutors(tutorUsers);
            setSelectedTutorByCourseId(
                fetchedCourses.reduce<Record<string, string>>((acc, course) => {
                    acc[course.id] = course.tutorId || '';
                    return acc;
                }, {})
            );
        } catch (error) {
            console.error("Failed to fetch courses:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCourses();
    }, []);

    useEffect(() => {
        const loadDeletePreview = async () => {
            if (!courseToDelete || !adminUser) {
                setDeletePreview(null);
                return;
            }

            setIsDeletePreviewLoading(true);
            try {
                const result = await previewCourseAssetPurge(courseToDelete.id, adminUser.uid);
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
    }, [courseToDelete, adminUser]);

    const updateCourseStatus = async (
        courseId: string,
        status: CourseStatus,
        pricingOverride?: { isFree: boolean; price: number }
    ) => {
        if (!adminUser) return;

        const actingUser = await getUserById(adminUser.uid);
        const canApprove = await hasPermission(actingUser, 'courses:approve');
        if (!canApprove) {
            toast({
                variant: 'destructive',
                title: 'Permission denied',
                description: 'You do not have permission to approve or reject courses.',
            });
            return;
        }
        if (pricingOverride && actingUser?.role !== 'superadmin') {
            toast({
                variant: 'destructive',
                title: 'Permission denied',
                description: 'Only super-admins can set course pricing during approval.',
            });
            return;
        }

        const courseToUpdate = courses.find(course => course.id === courseId);
        if (courseToUpdate) {
            const pricingFields = pricingOverride
                ? { isFree: pricingOverride.isFree, price: pricingOverride.isFree ? 0 : pricingOverride.price }
                : status === 'Published' && courseToUpdate.isFree === undefined
                    ? { isFree: true, price: 0 }
                    : {};
            const updatedCourse: Course = {
                ...courseToUpdate,
                status,
                ...pricingFields,
            };

            try {
                await saveCourse(updatedCourse);
                if (status === 'Published') {
                    const idToken = await adminUser.getIdToken();
                    const classroomResult = await createClassroom(idToken, courseId).catch((error) => ({
                        error: error instanceof Error ? error.message : String(error),
                    }));
                    if (classroomResult?.error) {
                        console.error('Classroom setup failed for courseId:', courseId, 'error:', classroomResult.error);
                        toast({
                            variant: 'destructive',
                            title: 'Classroom setup failed',
                            description: 'Classroom setup failed but course was published.',
                        });
                    }
                }
                await logAdminAction({
                    actorId: adminUser.uid,
                    actorName: adminUser.displayName || adminUser.email || 'Administrator',
                    action: 'COURSE_REVIEW',
                    targetId: courseId,
                    targetType: 'course',
                    severity: status === 'Published' ? 'info' : 'warn',
                    details: `Admin ${status === 'Published' ? 'APPROVED' : 'REJECTED'} course "${courseToUpdate.title}".`
                });
                setCourses(prev => prev.map(c => c.id === courseId ? updatedCourse : c));
                toast({
                    title: `Course ${status}`,
                    description: status === 'Published' ? "The course is now live." : "Course marked as rejected."
                });

                // Notify tutor via email (non-blocking; result surfaced as a warning toast)
                if (courseToUpdate.tutorId && (status === 'Published' || status === 'Rejected')) {
                    adminUser.getIdToken(true).then(idToken =>
                        getUserById(courseToUpdate.tutorId).then(tutor => {
                            if (!tutor?.email) return;
                            return sendTransactionalEmail({
                                type: status === 'Published' ? 'courseApproval' : 'courseRejection',
                                to: tutor.email,
                                recipientName: tutor.name || 'Tutor',
                                courseTitle: courseToUpdate.title,
                                courseId: courseToUpdate.id,
                                callerIdToken: idToken,
                            }).then(result => {
                                if (result.error) {
                                    toast({
                                        variant: 'destructive',
                                        title: 'Tutor email not sent',
                                        description: result.error,
                                    });
                                }
                            });
                        })
                    ).catch(() => {
                        toast({
                            variant: 'destructive',
                            title: 'Tutor email not sent',
                            description: 'Could not notify the tutor by email.',
                        });
                    });
                }
            } catch (error: any) {
                toast({
                    variant: "destructive",
                    title: "Action Failed",
                    description: error?.message || "Could not update course status. Please retry."
                });
            }
        }
    };

    const openApproveDialog = (course: Course) => {
        setCourseToApprove(course);
        setApprovalIsFree(course.isFree ?? false);
        setApprovalPrice(course.price ?? 0);
    };

    const confirmApproval = async () => {
        if (!courseToApprove) return;
        setIsApproving(true);
        try {
            await updateCourseStatus(courseToApprove.id, 'Published', {
                isFree: approvalIsFree,
                price: approvalPrice,
            });
        } finally {
            setIsApproving(false);
            setCourseToApprove(null);
        }
    };
    
    const assignTutorToCourse = async (courseId: string) => {
        if (!adminUser) return;

        const actingUser = await getUserById(adminUser.uid);
        const canManageCourses = await hasPermission(actingUser, 'courses:approve');
        if (!canManageCourses) {
            toast({
                variant: 'destructive',
                title: 'Permission denied',
                description: 'You do not have permission to reassign tutors.',
            });
            return;
        }

        const selectedTutorId = selectedTutorByCourseId[courseId];
        const selectedTutor = tutors.find((tutor) => tutor.id === selectedTutorId);
        const targetCourse = courses.find((course) => course.id === courseId);

        if (!selectedTutor || !targetCourse) {
            toast({
                variant: 'destructive',
                title: 'Assignment failed',
                description: 'Please select a valid tutor.',
            });
            return;
        }

        setAssigningCourseId(courseId);
        try {
            await assignCourseToTutor(targetCourse, {
                id: selectedTutor.id,
                name: selectedTutor.name,
                avatar: selectedTutor.avatar,
            });

            setCourses((prev) => prev.map((course) => (
                course.id === courseId
                    ? {
                        ...course,
                        tutorId: selectedTutor.id,
                        instructor: {
                            name: selectedTutor.name || course.instructor?.name || 'Academic Expert',
                            title: course.instructor?.title || 'Instructor',
                            avatar: selectedTutor.avatar || course.instructor?.avatar || '',
                            bio: course.instructor?.bio || '',
                        },
                    }
                    : course
            )));

            await logAdminAction({
                actorId: adminUser.uid,
                actorName: adminUser.displayName || adminUser.email || 'Administrator',
                action: 'COURSE_REVIEW',
                targetId: courseId,
                targetType: 'course',
                severity: 'info',
                details: `Admin assigned course "${targetCourse.title}" to tutor "${selectedTutor.name}".`
            });

            toast({ title: 'Tutor assigned', description: `${targetCourse.title} is now assigned to ${selectedTutor.name}.` });
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Assignment failed',
                description: error?.message || 'Could not assign tutor to this course.',
            });
        } finally {
            setAssigningCourseId(null);
        }
    };

    const confirmDelete = async () => {
        if (courseToDelete && adminUser) {
            const actingUser = await getUserById(adminUser.uid);
            const canDelete = await hasPermission(actingUser, 'courses:delete');
            if (!canDelete) {
                toast({
                    variant: 'destructive',
                    title: 'Permission denied',
                    description: 'You do not have permission to delete courses.',
                });
                return;
            }

            try {
                const cleanupResult = await deleteCourseAssetsByCourseId(courseToDelete.id, adminUser.uid);
                if (cleanupResult?.error) {
                    throw new Error(cleanupResult.error);
                }

                await deleteCourse(courseToDelete.id);

                await logAdminAction({
                    actorId: adminUser.uid,
                    actorName: adminUser.displayName || adminUser.email || 'Administrator',
                    action: 'COURSE_DELETE',
                    targetId: courseToDelete.id,
                    targetType: 'course',
                    severity: 'critical',
                    details: `Permanently deleted course: ${courseToDelete.title}.`
                });

                setCourses(prev => prev.filter(c => c.id !== courseToDelete.id));
                toast({ title: "Course Deleted", variant: "destructive" });
                setCourseToDelete(null);
                setDeleteConfirmationText('');
                setDeletePreview(null);
            } catch (error: any) {
                toast({
                    variant: "destructive",
                    title: "Delete Failed",
                    description: error?.message || "Could not delete the course."
                });
            }
        }
    };

    const isDeleteConfirmed = deleteConfirmationText.trim().toUpperCase() === 'DELETE';

        const filteredCourses = courses.filter((course) => {
                if (activeFilter === 'all') return true;
                if (activeFilter === 'under-review') return course.status === 'Under Review';
                if (activeFilter === 'rejected') return course.status === 'Rejected';
                if (activeFilter === 'draft') return course.status === 'Draft';
                return true;
        });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold mb-2 font-headline tracking-tight">Review Queue</h1>
            <p className="text-muted-foreground text-sm">
            Moderate course submissions and ensure content quality for the marketplace.
            </p>
        </div>
                <Button asChild>
                    <Link href="/admin/courses/create">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Create Course
                        </Link>
                </Button>
      </div>

            <Tabs value={activeFilter} onValueChange={(value) => setActiveFilter(value as 'under-review' | 'all' | 'rejected' | 'draft')}>
                <TabsList>
                        <TabsTrigger value="under-review">Under Review ({courses.filter(c => c.status === 'Under Review').length})</TabsTrigger>
                        <TabsTrigger value="all">All ({courses.length})</TabsTrigger>
                        <TabsTrigger value="rejected">Rejected ({courses.filter(c => c.status === 'Rejected').length})</TabsTrigger>
                        <TabsTrigger value="draft">Draft ({courses.filter(c => c.status === 'Draft').length})</TabsTrigger>
                </TabsList>
            </Tabs>

       <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
            <CardTitle>Global Submissions</CardTitle>
            <CardDescription>
                Review and approve expert instructor content.
            </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
            {isLoading ? (
                 <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                 </div>
            ) : (
                <Table>
                    <TableHeader className="bg-muted/10">
                        <TableRow>
                            <TableHead className="pl-6">Course Title</TableHead>
                            <TableHead>Instructor</TableHead>
                            <TableHead>Assign Tutor</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right pr-6">Management</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCourses.map(course => (
                            <TableRow key={course.id} className="hover:bg-muted/5 transition-colors">
                                <TableCell className="pl-6 font-bold text-sm max-w-xs truncate">{course.title}</TableCell>
                                <TableCell className="text-xs">{course.instructor?.name || 'Academic Expert'}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2 min-w-[200px] sm:min-w-[280px]">
                                        <Select
                                            value={selectedTutorByCourseId[course.id] || undefined}
                                            onValueChange={(value) => setSelectedTutorByCourseId((prev) => ({ ...prev, [course.id]: value }))}
                                        >
                                            <SelectTrigger className="h-8 text-xs">
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
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-[10px] font-black"
                                            disabled={!selectedTutorByCourseId[course.id] || assigningCourseId === course.id}
                                            onClick={() => assignTutorToCourse(course.id)}
                                        >
                                            {assigningCourseId === course.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'ASSIGN'}
                                        </Button>
                                    </div>
                                </TableCell>
                                <TableCell><Badge variant="secondary" className="capitalize text-[10px]">{course.category}</Badge></TableCell>
                                <TableCell>
                                    <Badge variant={getStatusVariant(course.status)} className="text-[10px]">{course.status}</Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6 space-x-2">
                                    <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                                        <Link href={`/admin/courses/${course.id}/edit`}><Pencil className="h-4 w-4" /></Link>
                                    </Button>
                                    <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                                        <Link href={`/course/${course.id}/preview`} target="_blank"><Eye className="h-4 w-4" /></Link>
                                    </Button>
                                    {course.status === 'Under Review' && (
                                        <div className="inline-flex gap-2">
                                            <Button variant="outline" size="sm" className="h-8 text-[10px] font-black text-destructive hover:bg-destructive/10 border-destructive/20" onClick={() => updateCourseStatus(course.id, 'Rejected')}>
                                                REJECT
                                            </Button>
                                            <Button size="sm" className="h-8 text-[10px] font-black" onClick={() => isSuperAdmin ? openApproveDialog(course) : updateCourseStatus(course.id, 'Published')}>
                                                APPROVE
                                            </Button>
                                        </div>
                                    )}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4"/></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => { setDeleteConfirmationText(''); setDeletePreview(null); setCourseToDelete(course); }} className="text-destructive focus:text-destructive">
                                                <Trash2 className="mr-2 h-4 w-4"/> Delete Permanent
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                        {filteredCourses.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-20 opacity-30 grayscale">
                                    <AlertCircle size={48} className="mx-auto mb-2" />
                                    <p className="font-bold uppercase tracking-widest text-xs">
                                        {activeFilter === 'under-review' ? 'No pending reviews' : 'No courses in this filter'}
                                    </p>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>

        <Dialog open={!!courseToApprove} onOpenChange={(open) => { if (!open) setCourseToApprove(null); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-primary" /> Set Course Pricing</DialogTitle>
                    <DialogDescription>
                        Set the price for <strong>"{courseToApprove?.title}"</strong> before publishing it to the marketplace.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border-2 border-dashed">
                        <div className="space-y-0.5">
                            <Label className="text-base font-semibold">Make this course free</Label>
                            <p className="text-xs text-muted-foreground">Toggle on to offer this course at no cost.</p>
                        </div>
                        <Switch
                            checked={approvalIsFree}
                            onCheckedChange={(val) => { setApprovalIsFree(val); if (val) setApprovalPrice(0); }}
                        />
                    </div>
                    {!approvalIsFree && (
                        <div className="space-y-2">
                            <Label htmlFor="approval-price">Listing Price (GH₵)</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm">GH₵</span>
                                <Input
                                    id="approval-price"
                                    type="number"
                                    min={0}
                                    className="pl-12 h-11 text-base font-bold"
                                    value={approvalPrice}
                                    onChange={(e) => setApprovalPrice(parseFloat(e.target.value) || 0)}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">The platform takes a 20% commission on all sales.</p>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setCourseToApprove(null)}>Cancel</Button>
                    <Button onClick={confirmApproval} disabled={isApproving || (!approvalIsFree && approvalPrice <= 0)}>
                        {isApproving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                        Approve & Publish
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

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
                    <AlertDialogTitle>Permanent Deletion</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will remove "{courseToDelete?.title}" from all marketplace listings and student dashboard, and delete linked storage assets for this course ID (lesson videos, document media, and thumbnails) to save storage space. This action is irreversible.
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
                    />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeletePreviewLoading || !isDeleteConfirmed}>Confirm Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
