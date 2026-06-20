'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, PlusCircle, MoreHorizontal, Edit, Trash2, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { type Course, type CourseBundle } from '@/lib/db';
import { getCourses, getBundles, saveBundle, deleteBundle } from '@/lib/course-data';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { useUser } from '@/firebase';
import { logAdminAction } from '@/lib/audit-data';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);
}

export default function AdminCourseBundlesPage() {
  const { user: adminUser } = useUser();
  const [bundles, setBundles] = useState<CourseBundle[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBundle, setEditingBundle] = useState<CourseBundle | null>(null);
  const [bundleToDelete, setBundleToDelete] = useState<CourseBundle | null>(null);
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
        const [fetchedBundles, fetchedCourses] = await Promise.all([getBundles(), getCourses()]);
        setBundles(fetchedBundles);
        setCourses(fetchedCourses.filter(c => c.status === 'Published'));
    } catch (error) {
        toast({ variant: 'destructive', title: 'Fetch Error', description: 'Could not load bundles.' });
    } finally {
        setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenDialog = (bundle: CourseBundle | null) => {
    setEditingBundle(bundle);
    setIsDialogOpen(true);
  };

  const handleSave = async (bundleData: Omit<CourseBundle, 'id'> & { id?: string }) => {
    if (!adminUser) return;

    const bundleToSave: CourseBundle = {
      id: bundleData.id || `bundle-${Date.now()}`,
      name: bundleData.name,
      description: bundleData.description,
      price: bundleData.price,
      courseIds: bundleData.courseIds,
    };

    await saveBundle(bundleToSave);
    
    await logAdminAction({
        actorId: adminUser.uid,
        actorName: adminUser.displayName || adminUser.email || 'Administrator',
        action: bundleData.id ? 'BUNDLE_UPDATE' : 'BUNDLE_CREATE',
        targetId: bundleToSave.id,
        targetType: 'course',
        severity: 'info',
        details: `${bundleData.id ? 'Updated' : 'Created'} course bundle: "${bundleToSave.name}" containing ${bundleToSave.courseIds.length} courses.`
    });

    // Optimistic UI update
    setBundles(prev => {
        const exists = prev.find(b => b.id === bundleToSave.id);
        if (exists) {
            return prev.map(b => b.id === bundleToSave.id ? bundleToSave : b);
        }
        return [...prev, bundleToSave];
    });

    toast({ title: `Bundle ${editingBundle ? 'updated' : 'created'} successfully!` });
    setIsDialogOpen(false);
    setEditingBundle(null);
  };
  
  const handleDelete = async () => {
    if (!bundleToDelete || !adminUser) return;
    
    await deleteBundle(bundleToDelete.id);
    
    await logAdminAction({
        actorId: adminUser.uid,
        actorName: adminUser.displayName || adminUser.email || 'Administrator',
        action: 'BUNDLE_DELETE',
        targetId: bundleToDelete.id,
        targetType: 'course',
        severity: 'warn',
        details: `Deleted course bundle: "${bundleToDelete.name}".`
    });

    // Optimistic UI update
    setBundles(prev => prev.filter(b => b.id !== bundleToDelete.id));
    
    toast({ title: 'Bundle Deleted', variant: 'destructive' });
    setBundleToDelete(null);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="font-headline text-3xl font-bold">Course Bundles</h1>
            <p className="text-muted-foreground">
              Create logical groupings of courses (e.g., "Full ICAG Level 1")
              with bulk pricing.
            </p>
          </div>
        </div>
        <Button onClick={() => handleOpenDialog(null)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Bundle
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existing Bundles</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
              <div className="flex justify-center items-center h-48">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
          ) : (
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Bundle Name</TableHead>
                    <TableHead>Courses Included</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {bundles.length > 0 ? (
                    bundles.map((bundle) => (
                    <TableRow key={bundle.id}>
                        <TableCell className="font-medium">{bundle.name}</TableCell>
                        <TableCell>{bundle.courseIds.length} Courses</TableCell>
                        <TableCell className="font-bold">{formatCurrency(bundle.price)}</TableCell>
                        <TableCell className="text-right">
                        <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleOpenDialog(bundle)}><Edit className="mr-2 h-4 w-4"/> Edit</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setBundleToDelete(bundle)} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4"/> Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell
                        colSpan={4}
                        className="py-12 text-center text-muted-foreground"
                    >
                        No bundles have been created yet.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      
      {isDialogOpen && (
        <BundleEditorDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          onSave={handleSave}
          bundle={editingBundle}
          allCourses={courses}
        />
      )}
      
       <AlertDialog open={!!bundleToDelete} onOpenChange={() => setBundleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the bundle "{bundleToDelete?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BundleEditorDialog({
  isOpen,
  onClose,
  onSave,
  bundle,
  allCourses
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<CourseBundle, 'id'> & { id?: string }) => void;
  bundle: CourseBundle | null;
  allCourses: Course[];
}) {
  const [name, setName] = useState(bundle?.name || '');
  const [description, setDescription] = useState(bundle?.description || '');
  const [price, setPrice] = useState(bundle?.price || 0);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set(bundle?.courseIds || []));

  const handleSave = () => {
    onSave({
      id: bundle?.id,
      name,
      description,
      price,
      courseIds: Array.from(selectedCourseIds),
    });
  };
  
  const handleCourseToggle = (courseId: string, checked: boolean) => {
      const newSet = new Set(selectedCourseIds);
      if (checked) {
          newSet.add(courseId);
      } else {
          newSet.delete(courseId);
      }
      setSelectedCourseIds(newSet);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {bundle ? 'Edit Bundle' : 'Create New Bundle'}
          </DialogTitle>
          <DialogDescription>
            Group courses together and set a bulk price for the bundle.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Bundle Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Full ICAG Level 1" />
          </div>
           <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's included in this bundle?" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Bundle Price (GH₵)</Label>
            <Input id="price" type="number" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-bold">Select Courses to Include</Label>
            <ScrollArea className="h-48 rounded-md border p-4">
                <div className="space-y-2">
                    {allCourses.length > 0 ? allCourses.map(course => (
                        <div key={course.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50 transition-colors">
                            <Checkbox 
                                id={`course-${course.id}`}
                                checked={selectedCourseIds.has(course.id)}
                                onCheckedChange={(checked) => handleCourseToggle(course.id, !!checked)}
                            />
                            <Label htmlFor={`course-${course.id}`} className="flex-1 cursor-pointer text-sm">{course.title}</Label>
                        </div>
                    )) : (
                        <p className="text-center text-muted-foreground py-8 text-xs">No published courses available to bundle.</p>
                    )}
                </div>
            </ScrollArea>
          </div>
        </div>
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || selectedCourseIds.size === 0}>
              {bundle ? 'Save Changes' : 'Create Bundle'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
