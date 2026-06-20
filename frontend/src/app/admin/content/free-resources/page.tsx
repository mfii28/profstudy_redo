'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/dashboard/empty-state';
import { TinyMceRichEditor } from '@/components/editor/tinymce-rich-editor';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { getFreeResources, saveFreeResource, removeFreeResource } from '@/lib/free-resources-data';
import type { FreeResource } from '@/lib/db';
import { Library, PlusCircle, Search, MoreHorizontal, Edit, Trash2, Star, RefreshCw, Video, FileText, Link as LinkIcon, FileType } from 'lucide-react';
import { getPresignedUploadUrl } from '@/app/actions/storage';
import { uploadToR2 } from '@/lib/upload-client';

const RESOURCE_TYPES: FreeResource['type'][] = ['video', 'document', 'pdf', 'link'];
const CATEGORIES = ['Study Materials', 'Practice Questions', 'Tutorials', 'Webinars', 'Templates', 'References'];

const TYPE_ICONS = {
  video: <Video size={12} />,
  document: <FileText size={12} />,
  pdf: <FileType size={12} />,
  link: <LinkIcon size={12} />,
};

const emptyResource = (): Omit<FreeResource, 'id'> => ({
  title: '',
  description: '',
  type: 'document',
  url: '',
  fileKey: '',
  thumbnailUrl: '',
  category: CATEGORIES[0],
  tags: [],
  isFeatured: false,
  viewCount: 0,
  createdAt: new Date().toISOString(),
});

export default function AdminFreeResourcesPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [resources, setResources] = useState<FreeResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | FreeResource['type']>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<(Omit<FreeResource, 'id'> & { id?: string }) | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingResource, setIsUploadingResource] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FreeResource | null>(null);
  const [tagsInput, setTagsInput] = useState('');

  const fetchResources = useCallback(async () => {
    setIsLoading(true);
    try {
      setResources(await getFreeResources());
    } catch {
      toast({ variant: 'destructive', title: 'Failed to load resources' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  const openCreate = () => { setEditTarget(emptyResource()); setTagsInput(''); setDialogOpen(true); };
  const openEdit = (r: FreeResource) => { setEditTarget({ ...r }); setTagsInput((r.tags || []).join(', ')); setDialogOpen(true); };

  const handleSave = async () => {
    if (!editTarget) return;
    if (!editTarget.title.trim()) { toast({ variant: 'destructive', title: 'Title is required' }); return; }
    setIsSaving(true);
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      await saveFreeResource({ ...editTarget, tags });
      toast({ title: editTarget.id ? 'Resource updated' : 'Resource created' });
      setDialogOpen(false);
      fetchResources();
    } catch {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeFreeResource(deleteTarget.id);
      setResources(prev => prev.filter(r => r.id !== deleteTarget.id));
      toast({ title: 'Resource deleted' });
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleResourceUpload = async (file?: File) => {
    if (!file || !user || !editTarget) return;
    try {
      setIsUploadingResource(true);
      const idToken = await user.getIdToken();
      const upload = await getPresignedUploadUrl(
        user.uid,
        'rich_content',
        file.name,
        file.type || 'application/octet-stream',
        undefined,
        idToken
      );
      if (upload.error || !upload.url || !upload.key) {
        throw new Error(upload.error || 'Unable to authorize upload.');
      }
      await uploadToR2(upload.url, file, file.type || 'application/octet-stream', { key: upload.key, idToken });
      const stableUrl = `/api/media/stream?key=${encodeURIComponent(upload.key)}`;
      setEditTarget((prev) => (prev ? { ...prev, url: stableUrl, fileKey: upload.key } : prev));
      toast({ title: 'Resource file uploaded' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: error?.message || 'Please try again.' });
    } finally {
      setIsUploadingResource(false);
    }
  };

  const filtered = resources.filter(r => {
    const matchesSearch = !search || r.title.toLowerCase().includes(search.toLowerCase()) || r.category.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || r.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl"><Library className="h-7 w-7 text-primary" /></div>
          <div>
            <h1 className="text-3xl font-bold font-headline">Free Resources</h1>
            <p className="text-muted-foreground text-sm">Manage free educational resources available to all users.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchResources} disabled={isLoading} className="gap-2">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Sync
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-2">
            <PlusCircle size={14} /> Add Resource
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search resources…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={v => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {RESOURCE_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle>Resources ({filtered.length})</CardTitle>
          <CardDescription>Free educational materials accessible without enrollment.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead className="pl-6">Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Featured</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(r => (
                    <TableRow key={r.id} className="hover:bg-muted/5">
                      <TableCell className="pl-6">
                        <div className="font-semibold text-sm">{r.title}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-xs">{r.description}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          {TYPE_ICONS[r.type]} {r.type}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{r.category}</Badge></TableCell>
                      <TableCell>
                        {r.isFeatured && <Star size={14} className="text-amber-500 fill-amber-500" />}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{(r.viewCount || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={14} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(r)} className="gap-2"><Edit size={12} /> Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteTarget(r)} className="gap-2 text-destructive focus:text-destructive"><Trash2 size={12} /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-24">
              <EmptyState title="No resources yet" description="Add free resources to share with your learners." icon={<Library className="h-12 w-12 text-muted-foreground/20" />} />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget?.id ? 'Edit Resource' : 'Add Resource'}</DialogTitle>
            <DialogDescription>Provide the resource details and access link or file.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Title <span className="text-destructive">*</span></Label>
                  <Input value={editTarget.title} onChange={e => setEditTarget(prev => prev ? { ...prev, title: e.target.value } : prev)} placeholder="Resource title…" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={editTarget.type} onValueChange={v => setEditTarget(prev => prev ? { ...prev, type: v as FreeResource['type'] } : prev)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RESOURCE_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={editTarget.category} onValueChange={v => setEditTarget(prev => prev ? { ...prev, category: v } : prev)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <TinyMceRichEditor
                  label="Description / Content"
                  value={editTarget.description}
                  onChange={(next) => setEditTarget((prev) => (prev ? { ...prev, description: next } : prev))}
                  placeholder="Describe the resource. You can embed images/videos/files."
                />
                <div className="space-y-2 md:col-span-2">
                  <Label>URL / Link</Label>
                  <div className="flex gap-2">
                    <Input value={editTarget.url || ''} onChange={e => setEditTarget(prev => prev ? { ...prev, url: e.target.value } : prev)} placeholder="https://… or uploaded file URL" />
                    <input
                      id="resource-file-upload"
                      type="file"
                      className="hidden"
                      onChange={(e) => void handleResourceUpload(e.target.files?.[0] || undefined)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('resource-file-upload')?.click()}
                      disabled={isUploadingResource}
                    >
                      {isUploadingResource ? 'Uploading...' : 'Upload File'}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Tags (comma-separated)</Label>
                  <Input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="ICAG, free, study" />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-xl bg-muted/10 md:col-span-2">
                  <div className="space-y-0.5">
                    <Label>Featured Resource</Label>
                    <p className="text-xs text-muted-foreground">Display prominently on the resources page.</p>
                  </div>
                  <Switch checked={!!editTarget.isFeatured} onCheckedChange={v => setEditTarget(prev => prev ? { ...prev, isFeatured: v } : prev)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>{isSaving ? 'Saving…' : editTarget?.id ? 'Save Changes' : 'Add Resource'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete resource?</AlertDialogTitle>
            <AlertDialogDescription>&ldquo;{deleteTarget?.title}&rdquo; will be permanently removed.</AlertDialogDescription>
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
