'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Edit, Trash2, Star, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAllTestimonials, saveTestimonial, deleteTestimonial, updateTestimonialStatus, TESTIMONIAL_GROUPS, type TestimonialDocument } from '@/lib/testimonial-data';
import type { TestimonialGroup, TestimonialStatus } from '@/lib/db';
import { EmptyState } from '@/components/dashboard/empty-state';
import { useUser } from '@/firebase';
import { getPresignedUploadUrl } from '@/app/actions/storage';
import { uploadToR2 } from '@/lib/upload-client';
import { ImageBucketField } from '@/components/upload/image-bucket-field';

const emptyStory: TestimonialDocument = {
  id: '',
  name: '',
  role: '',
  avatar: '',
  text: '',
  status: 'approved',
  group: 'general',
  source: 'admin',
};

export default function AdminStudentStoriesPage() {
  const [stories, setStories] = useState<TestimonialDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingStory, setEditingStory] = useState<TestimonialDocument>(emptyStory);
  const [deleteTarget, setDeleteTarget] = useState<TestimonialDocument | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const { user } = useUser();
  const { toast } = useToast();

  const handleAvatarUpload = async (file: File) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Sign in required' });
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const idToken = await user.getIdToken();
      const upload = await getPresignedUploadUrl(
        user.uid,
        'rich_content',
        file.name,
        file.type || 'image/png',
        undefined,
        idToken
      );
      if (upload.error || !upload.url || !upload.key) {
        throw new Error(upload.error || 'Unable to authorize upload.');
      }
      await uploadToR2(upload.url, file, file.type || 'image/png', { key: upload.key, idToken });
      setEditingStory((prev) => ({ ...prev, avatar: upload.key }));
      toast({ title: 'Photo uploaded' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      toast({ variant: 'destructive', title: 'Upload failed', description: message });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const fetchStories = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getAllTestimonials();
      setStories(data);
    } catch (error) {
      console.error('[Admin Student Stories] Failed to load stories', error);
      toast({ variant: 'destructive', title: 'Unable to load stories.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const featuredCount = useMemo(
    () => stories.filter((s) => !s.status || s.status === 'approved').length,
    [stories],
  );
  const pendingCount = useMemo(() => stories.filter((s) => s.status === 'pending').length, [stories]);

  const handleReview = async (storyId: string, status: TestimonialStatus) => {
    if (!user) return;
    try {
      await updateTestimonialStatus(storyId, status, user.uid);
      await fetchStories();
      toast({
        title: status === 'approved' ? 'Testimonial approved' : 'Testimonial rejected',
      });
    } catch {
      toast({ variant: 'destructive', title: 'Could not update status.' });
    }
  };

  const openEditor = (story?: TestimonialDocument) => {
    setEditingStory(story ? { ...story } : { ...emptyStory });
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setEditingStory({ ...emptyStory });
    setIsEditorOpen(false);
  };

  const handleSave = async () => {
    if (!editingStory.name.trim() || !editingStory.role.trim() || !editingStory.text.trim()) {
      toast({ variant: 'destructive', title: 'All fields are required.' });
      return;
    }

    setIsSaving(true);
    try {
      await saveTestimonial(editingStory);
      await fetchStories();
      closeEditor();
      toast({ title: 'Story saved', description: 'Student story has been updated.' });
    } catch (error) {
      console.error('[Admin Student Stories] Save failed', error);
      toast({ variant: 'destructive', title: 'Save failed', description: 'Could not save the story.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      await deleteTestimonial(deleteTarget.id);
      setStories((prev) => prev.filter((story) => story.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast({ title: 'Story removed', variant: 'destructive' });
    } catch (error) {
      console.error('[Admin Student Stories] Delete failed', error);
      toast({ variant: 'destructive', title: 'Delete failed', description: 'Could not remove the story.' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">Content Hub</p>
          <h1 className="text-3xl font-bold tracking-tight">Testimonials</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Publish testimonials, review user submissions, and organize them by group for the public testimonials page.
          </p>
        </div>
        <Button className="gap-2" onClick={() => openEditor()}>
          <PlusCircle className="h-4 w-4" /> Add Story
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Stories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{featuredCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{featuredCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 border-b p-6">
          <CardTitle>Story Registry</CardTitle>
          <CardDescription>Manage student testimonials shown across your marketing pages.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-56 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : stories.length > 0 ? (
            <Tabs defaultValue="published" className="p-4">
              <TabsList>
                <TabsTrigger value="published">Published</TabsTrigger>
                <TabsTrigger value="pending">
                  Pending {pendingCount > 0 ? `(${pendingCount})` : ''}
                </TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
              {(['published', 'pending', 'all'] as const).map((tab) => {
                const filtered = stories.filter((story) => {
                  if (tab === 'published') return !story.status || story.status === 'approved';
                  if (tab === 'pending') return story.status === 'pending';
                  return true;
                });
                return (
                  <TabsContent key={tab} value={tab} className="mt-4">
                    {filtered.length === 0 ? (
                      <p className="py-12 text-center text-sm text-muted-foreground">No testimonials in this tab.</p>
                    ) : (
                      <Table>
                        <TableHeader className="bg-muted/10">
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Group</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Excerpt</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((story) => (
                            <TableRow key={story.id} className="transition-colors hover:bg-muted/5">
                              <TableCell className="font-semibold">{story.name}</TableCell>
                              <TableCell>{story.role}</TableCell>
                              <TableCell>
                                {TESTIMONIAL_GROUPS.find((g) => g.value === (story.group ?? 'general'))?.label ?? 'General'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={story.status === 'pending' ? 'secondary' : story.status === 'rejected' ? 'destructive' : 'default'}>
                                  {story.status ?? 'approved'}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-md text-sm text-muted-foreground line-clamp-2">{story.text}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {story.status === 'pending' ? (
                                    <>
                                      <Button variant="outline" size="sm" className="text-success" onClick={() => void handleReview(story.id, 'approved')}>
                                        <CheckCircle2 className="h-4 w-4" />
                                      </Button>
                                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => void handleReview(story.id, 'rejected')}>
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : null}
                                  <Button variant="outline" size="sm" onClick={() => openEditor(story)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(story)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : (
            <div className="py-24">
              <EmptyState
                icon={<Star className="h-16 w-16 text-muted-foreground/30" />}
                title="No student stories"
                description="Publish a testimonial to let learners see real success stories from your community."
                action={<Button onClick={() => openEditor()}>Add Story</Button>}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingStory.id ? 'Edit Story' : 'New Story'}</DialogTitle>
            <DialogDescription>Enter a student success story and publish it to the site.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="story-name">Student Name</Label>
                <Input
                  id="story-name"
                  value={editingStory.name}
                  onChange={(event) => setEditingStory((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="story-role">Role / Program</Label>
                <Input
                  id="story-role"
                  value={editingStory.role}
                  onChange={(event) => setEditingStory((prev) => ({ ...prev, role: event.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Group</Label>
                <Select
                  value={editingStory.group ?? 'general'}
                  onValueChange={(v) => setEditingStory((prev) => ({ ...prev, group: v as TestimonialGroup }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TESTIMONIAL_GROUPS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingStory.status ?? 'approved'}
                  onValueChange={(v) => setEditingStory((prev) => ({ ...prev, status: v as TestimonialStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <ImageBucketField
              label="Student photo"
              description="Upload a portrait for this testimonial."
              value={editingStory.avatar && !editingStory.avatar.startsWith('http') ? editingStory.avatar : ''}
              isUploading={isUploadingAvatar}
              onFileSelected={(file) => void handleAvatarUpload(file)}
              inputId="story-avatar-upload"
            />
            <div className="space-y-2">
              <Label htmlFor="story-text">Story Text</Label>
              <Textarea
                id="story-text"
                rows={6}
                value={editingStory.text}
                onChange={(event) => setEditingStory((prev) => ({ ...prev, text: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Story
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete student story?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The story will be removed from all public feeds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
