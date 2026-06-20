'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, Edit, Trash2, ImageIcon, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  deleteGalleryItem,
  GALLERY_GROUPS,
  getAllGalleryItems,
  saveGalleryItem,
  type GalleryItemDocument,
} from '@/lib/gallery-data';
import type { GalleryGroup, GalleryItemStatus, GalleryMediaType } from '@/lib/db';
import { EmptyState } from '@/components/dashboard/empty-state';
import { useUser } from '@/firebase';
import { getPresignedUploadUrl } from '@/app/actions/storage';
import { uploadToR2 } from '@/lib/upload-client';
import { GalleryMediaTile } from '@/components/gallery-media-tile';

const emptyItem: GalleryItemDocument = {
  id: '',
  title: '',
  caption: '',
  mediaUrl: '',
  mediaType: 'image',
  group: 'general',
  status: 'published',
  sortOrder: 0,
  createdAt: '',
};

export default function AdminGalleryPage() {
  const [items, setItems] = useState<GalleryItemDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItemDocument>(emptyItem);
  const [deleteTarget, setDeleteTarget] = useState<GalleryItemDocument | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { user } = useUser();
  const { toast } = useToast();

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    try {
      setItems(await getAllGalleryItems());
    } catch {
      toast({ variant: 'destructive', title: 'Unable to load gallery items.' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const publishedCount = useMemo(
    () => items.filter((i) => i.status === 'published').length,
    [items],
  );

  const openEditor = (item?: GalleryItemDocument) => {
    setEditingItem(item ? { ...item } : { ...emptyItem, sortOrder: items.length });
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setEditingItem({ ...emptyItem });
    setIsEditorOpen(false);
  };

  const handleMediaUpload = async (file: File) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Sign in required' });
      return;
    }
    setIsUploading(true);
    try {
      const idToken = await user.getIdToken();
      const isVideo = file.type.startsWith('video/');
      const upload = await getPresignedUploadUrl(
        user.uid,
        'rich_content',
        file.name,
        file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
        undefined,
        idToken,
      );
      if (upload.error || !upload.url || !upload.key) {
        throw new Error(upload.error || 'Unable to authorize upload.');
      }
      await uploadToR2(upload.url, file, file.type, { key: upload.key, idToken });
      setEditingItem((prev) => ({
        ...prev,
        mediaUrl: upload.key!,
        mediaType: isVideo ? 'video' : 'image',
      }));
      toast({ title: 'Media uploaded' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      toast({ variant: 'destructive', title: 'Upload failed', description: message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!editingItem.title.trim() || !editingItem.mediaUrl.trim()) {
      toast({ variant: 'destructive', title: 'Title and media are required.' });
      return;
    }
    setIsSaving(true);
    try {
      await saveGalleryItem(editingItem);
      await fetchItems();
      closeEditor();
      toast({ title: 'Gallery item saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteGalleryItem(deleteTarget.id);
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast({ title: 'Item removed', variant: 'destructive' });
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed' });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderTable = (filtered: GalleryItemDocument[]) => (
    <Table>
      <TableHeader className="bg-muted/10">
        <TableRow>
          <TableHead>Preview</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Group</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="w-28">
              <div className="relative h-16 w-24 overflow-hidden rounded-md">
                <GalleryMediaTile item={item} className="aspect-auto h-16 w-24" />
              </div>
            </TableCell>
            <TableCell className="font-semibold">{item.title}</TableCell>
            <TableCell>{GALLERY_GROUPS.find((g) => g.value === item.group)?.label ?? item.group}</TableCell>
            <TableCell className="capitalize">{item.mediaType}</TableCell>
            <TableCell>
              <Badge variant={item.status === 'published' ? 'default' : 'secondary'}>{item.status}</Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => openEditor(item)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(item)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">Content Hub</p>
          <h1 className="text-3xl font-bold tracking-tight">Gallery</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Upload photos and videos, organize them by group, and publish to the public gallery page.
          </p>
        </div>
        <Button className="gap-2" onClick={() => openEditor()}>
          <PlusCircle className="h-4 w-4" /> Add media
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total items</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{items.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Published</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{publishedCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{items.length - publishedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-none shadow-lg">
        <CardHeader className="border-b bg-muted/30 p-6">
          <CardTitle>Media library</CardTitle>
          <CardDescription>Images and videos shown on /gallery</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-56 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : items.length > 0 ? (
            <Tabs defaultValue="all" className="p-4">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                {GALLERY_GROUPS.map((g) => (
                  <TabsTrigger key={g.value} value={g.value}>{g.label}</TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="all" className="mt-4">
                {renderTable(items)}
              </TabsContent>
              {GALLERY_GROUPS.map((g) => (
                <TabsContent key={g.value} value={g.value} className="mt-4">
                  {renderTable(items.filter((i) => i.group === g.value))}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="py-24">
              <EmptyState
                icon={<ImageIcon className="h-16 w-16 text-muted-foreground/30" />}
                title="No gallery items"
                description="Upload your first photo or video to populate the public gallery."
                action={<Button onClick={() => openEditor()}>Add media</Button>}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem.id ? 'Edit item' : 'New gallery item'}</DialogTitle>
            <DialogDescription>Upload an image or video and assign it to a group.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="g-title">Title</Label>
                <Input
                  id="g-title"
                  value={editingItem.title}
                  onChange={(e) => setEditingItem((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="g-sort">Sort order</Label>
                <Input
                  id="g-sort"
                  type="number"
                  value={editingItem.sortOrder ?? 0}
                  onChange={(e) => setEditingItem((p) => ({ ...p, sortOrder: Number(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Group</Label>
                <Select
                  value={editingItem.group}
                  onValueChange={(v) => setEditingItem((p) => ({ ...p, group: v as GalleryGroup }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GALLERY_GROUPS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editingItem.status}
                  onValueChange={(v) => setEditingItem((p) => ({ ...p, status: v as GalleryItemStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-caption">Caption (optional)</Label>
              <Textarea
                id="g-caption"
                rows={3}
                value={editingItem.caption ?? ''}
                onChange={(e) => setEditingItem((p) => ({ ...p, caption: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-media">Media file</Label>
              <Input
                id="g-media"
                type="file"
                accept="image/*,video/*"
                disabled={isUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleMediaUpload(file);
                }}
              />
              {isUploading ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                </p>
              ) : null}
              {editingItem.mediaUrl ? (
                <div className="mt-2 max-w-sm">
                  <GalleryMediaTile item={editingItem} />
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving || isUploading}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete gallery item?</AlertDialogTitle>
            <AlertDialogDescription>This removes the item from the public gallery.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
