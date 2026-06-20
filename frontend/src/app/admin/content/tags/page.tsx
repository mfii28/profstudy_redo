'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/dashboard/empty-state';
import { useToast } from '@/hooks/use-toast';
import { getTags, saveTag, removeTag, toSlug } from '@/lib/tags-data';
import type { Tag } from '@/lib/db';
import { Tag as TagIcon, PlusCircle, Search, Edit, Trash2, RefreshCw } from 'lucide-react';

const emptyTag = (): Omit<Tag, 'id'> => ({
  name: '',
  slug: '',
  description: '',
  usageCount: 0,
  createdAt: new Date().toISOString(),
});

export default function AdminTagsPage() {
  const { toast } = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<(Omit<Tag, 'id'> & { id?: string }) | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);

  const fetchTags = useCallback(async () => {
    setIsLoading(true);
    try {
      setTags(await getTags());
    } catch {
      toast({ variant: 'destructive', title: 'Failed to load tags' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const openCreate = () => { setEditTarget(emptyTag()); setDialogOpen(true); };
  const openEdit = (tag: Tag) => { setEditTarget({ ...tag }); setDialogOpen(true); };

  const handleSave = async () => {
    if (!editTarget) return;
    if (!editTarget.name.trim()) { toast({ variant: 'destructive', title: 'Tag name is required' }); return; }
    setIsSaving(true);
    try {
      const slug = editTarget.slug || toSlug(editTarget.name);
      await saveTag({ ...editTarget, slug });
      toast({ title: editTarget.id ? 'Tag updated' : 'Tag created' });
      setDialogOpen(false);
      fetchTags();
    } catch {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeTag(deleteTarget.id);
      setTags(prev => prev.filter(t => t.id !== deleteTarget.id));
      toast({ title: 'Tag deleted' });
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const filtered = tags.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.slug.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl"><TagIcon className="h-7 w-7 text-primary" /></div>
          <div>
            <h1 className="text-3xl font-bold font-headline">Tags</h1>
            <p className="text-muted-foreground text-sm">Manage content labels used across courses, blogs, and resources.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTags} disabled={isLoading} className="gap-2">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Sync
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-2">
            <PlusCircle size={14} /> New Tag
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search tags…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle>Tag Registry ({filtered.length})</CardTitle>
          <CardDescription>All content taxonomy labels and their usage statistics.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead className="pl-6">Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(tag => (
                    <TableRow key={tag.id} className="hover:bg-muted/5">
                      <TableCell className="pl-6 font-semibold text-sm">{tag.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{tag.slug}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{tag.description || '—'}</TableCell>
                      <TableCell className="text-sm">{tag.usageCount ?? 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(tag.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tag)}><Edit size={12} /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(tag)}><Trash2 size={12} /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-24">
              <EmptyState title="No tags found" description="Create tags to organize your platform content." icon={<TagIcon className="h-12 w-12 text-muted-foreground/20" />} />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget?.id ? 'Edit Tag' : 'New Tag'}</DialogTitle>
            <DialogDescription>Tags are used to label and filter content across the platform.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input
                  value={editTarget.name}
                  onChange={e => setEditTarget(prev => prev ? { ...prev, name: e.target.value, slug: toSlug(e.target.value) } : prev)}
                  placeholder="e.g. ICAG Exam"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={editTarget.slug}
                  onChange={e => setEditTarget(prev => prev ? { ...prev, slug: e.target.value } : prev)}
                  placeholder="auto-generated"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editTarget.description || ''}
                  onChange={e => setEditTarget(prev => prev ? { ...prev, description: e.target.value } : prev)}
                  placeholder="What this tag represents…"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving…' : editTarget?.id ? 'Save Changes' : 'Create Tag'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tag?</AlertDialogTitle>
            <AlertDialogDescription>&ldquo;{deleteTarget?.name}&rdquo; will be permanently removed.</AlertDialogDescription>
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
