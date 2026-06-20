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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tags, PlusCircle, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { type CourseCategory } from '@/lib/db';
import { getCategories, saveCategories } from '@/lib/course-data';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useUser } from '@/firebase';
import { logAdminAction } from '@/lib/audit-data';

export default function AdminCategoriesPage() {
  const { user: adminUser } = useUser();
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CourseCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<CourseCategory | null>(null);
  const [currentName, setCurrentName] = useState('');
  const [currentDescription, setCurrentDescription] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const fetchCategories = async () => {
      const data = await getCategories();
      setCategories(data);
    };
    fetchCategories();
  }, []);

  const handleOpenDialog = (category: CourseCategory | null) => {
    setEditingCategory(category);
    setCurrentName(category ? category.name : '');
    setCurrentDescription(category ? category.description : '');
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCategory(null);
    setCurrentName('');
    setCurrentDescription('');
  };

  const handleSave = async () => {
    if (!currentName || !adminUser) {
      toast({ title: "Name is required.", variant: "destructive" });
      return;
    }

    const categoryToSave: CourseCategory = {
      id: editingCategory?.id || `cat-${Date.now()}`,
      name: currentName,
      description: currentDescription,
    };

    const updatedCategories = editingCategory
      ? categories.map((c) => (c.id === editingCategory.id ? categoryToSave : c))
      : [...categories, categoryToSave];
    
    await saveCategories(updatedCategories);
    
    await logAdminAction({
        actorId: adminUser.uid,
        actorName: adminUser.displayName || adminUser.email || 'Administrator',
        action: editingCategory ? 'CATEGORY_UPDATE' : 'CATEGORY_CREATE',
        targetId: categoryToSave.id,
        targetType: 'setting',
        severity: 'info',
        details: `${editingCategory ? 'Updated' : 'Created'} course category: "${categoryToSave.name}".`
    });

    setCategories(updatedCategories);
    toast({ title: `Category ${editingCategory ? 'updated' : 'created'} successfully!` });
    handleCloseDialog();
  };

  const handleDelete = async () => {
    if (!categoryToDelete || !adminUser) return;
    const updatedCategories = categories.filter(c => c.id !== categoryToDelete.id);
    await saveCategories(updatedCategories);
    
    await logAdminAction({
        actorId: adminUser.uid,
        actorName: adminUser.displayName || adminUser.email || 'Administrator',
        action: 'CATEGORY_DELETE',
        targetId: categoryToDelete.id,
        targetType: 'setting',
        severity: 'warn',
        details: `Deleted course category: "${categoryToDelete.name}".`
    });

    setCategories(updatedCategories);
    toast({ title: "Category deleted", variant: "destructive"});
    setCategoryToDelete(null);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Tags className="h-8 w-8" />
          <div>
            <h1 className="font-headline text-3xl font-bold">
              Categories & Tags
            </h1>
            <p className="text-muted-foreground">
              Manage the taxonomy of the platform (e.g., ICAG, CITG, Subjects).
            </p>
          </div>
        </div>
        <Button onClick={() => handleOpenDialog(null)}>
          <PlusCircle className="mr-2 h-4 w-4" /> New Category
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Course Categories</CardTitle>
          <CardDescription>
            Manage the categories used to organize courses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length > 0 ? (
                categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">{category.name}</TableCell>
                    <TableCell className="text-muted-foreground">{category.description}</TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenDialog(category)}><Edit className="mr-2 h-4 w-4"/> Edit</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setCategoryToDelete(category)} className="text-destructive">
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
                    colSpan={3}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No categories configured.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'Create New Category'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={currentName}
                onChange={(e) => setCurrentName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={currentDescription}
                onChange={(e) => setCurrentDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
       <AlertDialog open={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the category "{categoryToDelete?.name}". This action cannot be undone.
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
