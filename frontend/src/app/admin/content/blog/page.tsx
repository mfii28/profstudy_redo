'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/dashboard/empty-state';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { getBlogPosts, saveBlogPost, removeBlogPost } from '@/lib/blog-data';
import { TinyMceRichEditor } from '@/components/editor/tinymce-rich-editor';
import { getPresignedUploadUrl } from '@/app/actions/storage';
import { uploadToR2 } from '@/lib/upload-client';
import { ImageBucketField } from '@/components/upload/image-bucket-field';
import type { BlogPost } from '@/lib/db';
import { BookText, PlusCircle, Search, MoreHorizontal, Edit, Trash2, Eye, EyeOff, RefreshCw } from 'lucide-react';

const CATEGORIES = ['Platform News', 'Study Tips', 'Course Updates', 'Exam Guide', 'Career Advice', 'Announcements'];

const toSlug = (title: string) =>
  title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const emptyPost = (): Omit<BlogPost, 'id'> => ({
  title: '',
  slug: '',
  summary: '',
  content: '',
  coverUrl: '',
  authorId: '',
  authorName: '',
  category: CATEGORIES[0],
  tags: [],
  status: 'Draft',
  createdAt: new Date().toISOString(),
  viewCount: 0,
});

export default function AdminBlogPage() {
  const { user: adminUser } = useUser();
  const { toast } = useToast();

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Draft' | 'Published'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<(Omit<BlogPost, 'id'> & { id?: string }) | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [tagsInput, setTagsInput] = useState('');

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getBlogPosts();
      setPosts(data);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to load blog posts' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const openCreate = () => {
    setEditTarget({ ...emptyPost(), authorId: adminUser?.uid || '', authorName: adminUser?.displayName || adminUser?.email || '' });
    setTagsInput('');
    setDialogOpen(true);
  };

  const openEdit = (post: BlogPost) => {
    setEditTarget({ ...post });
    setTagsInput((post.tags || []).join(', '));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editTarget) return;
    if (!editTarget.title.trim()) { toast({ variant: 'destructive', title: 'Title is required' }); return; }
    if (!editTarget.summary.trim()) { toast({ variant: 'destructive', title: 'Summary is required' }); return; }

    setIsSaving(true);
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const slug = editTarget.slug || toSlug(editTarget.title);
      const now = new Date().toISOString();
      const postData = {
        ...editTarget,
        slug,
        tags,
        updatedAt: now,
        publishedAt: editTarget.status === 'Published' ? (editTarget.publishedAt || now) : editTarget.publishedAt,
      };
      await saveBlogPost(postData);
      toast({ title: editTarget.id ? 'Post updated' : 'Post created' });
      setDialogOpen(false);
      fetchPosts();
    } catch {
      toast({ variant: 'destructive', title: 'Save failed' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeBlogPost(deleteTarget.id);
      setPosts(prev => prev.filter(p => p.id !== deleteTarget.id));
      toast({ title: 'Post deleted' });
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const toggleStatus = async (post: BlogPost) => {
    const newStatus = post.status === 'Published' ? 'Draft' : 'Published';
    const now = new Date().toISOString();
    try {
      await saveBlogPost({ ...post, status: newStatus, publishedAt: newStatus === 'Published' ? now : post.publishedAt });
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, status: newStatus } : p));
      toast({ title: `Post ${newStatus === 'Published' ? 'published' : 'unpublished'}` });
    } catch {
      toast({ variant: 'destructive', title: 'Status update failed' });
    }
  };

  const handleCoverUpload = async (file?: File) => {
    if (!file || !adminUser) return;
    try {
      setIsUploadingCover(true);
      const idToken = await adminUser.getIdToken();
      const upload = await getPresignedUploadUrl(
        adminUser.uid,
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
      setEditTarget((prev) => (prev ? { ...prev, coverUrl: upload.key } : prev));
      toast({ title: 'Cover uploaded' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Cover upload failed', description: error?.message || 'Please try again.' });
    } finally {
      setIsUploadingCover(false);
    }
  };

  const filtered = posts.filter(p => {
    const matchesSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl"><BookText className="h-7 w-7 text-primary" /></div>
          <div>
            <h1 className="text-3xl font-bold font-headline">Blog Manager</h1>
            <p className="text-muted-foreground text-sm">Create and publish platform articles and guides.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPosts} disabled={isLoading} className="gap-2">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Sync
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-2">
            <PlusCircle size={14} /> New Post
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by title or category…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Published">Published</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle>Posts ({filtered.length})</CardTitle>
          <CardDescription>Manage all blog content published on your platform.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead className="pl-6">Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(post => (
                    <TableRow key={post.id} className="hover:bg-muted/5">
                      <TableCell className="pl-6">
                        <div className="font-semibold text-sm">{post.title}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-xs">{post.summary}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{post.category}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={post.status === 'Published' ? 'default' : 'secondary'} className="text-[10px]">{post.status}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{(post.viewCount || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={14} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(post)} className="gap-2"><Edit size={12} /> Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleStatus(post)} className="gap-2">
                              {post.status === 'Published' ? <><EyeOff size={12} /> Unpublish</> : <><Eye size={12} /> Publish</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteTarget(post)} className="gap-2 text-destructive focus:text-destructive"><Trash2 size={12} /> Delete</DropdownMenuItem>
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
              <EmptyState title="No posts found" description="Create your first blog post to get started." icon={<BookText className="h-12 w-12 text-muted-foreground/20" />} />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget?.id ? 'Edit Post' : 'New Blog Post'}</DialogTitle>
            <DialogDescription>Fill in the post details. Slug is auto-generated from the title.</DialogDescription>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label>Title <span className="text-destructive">*</span></Label>
                  <Input
                    value={editTarget.title}
                    onChange={e => setEditTarget(prev => prev ? { ...prev, title: e.target.value, slug: toSlug(e.target.value) } : prev)}
                    placeholder="Post title…"
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
                  <Label>Category</Label>
                  <Select value={editTarget.category} onValueChange={v => setEditTarget(prev => prev ? { ...prev, category: v } : prev)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Summary <span className="text-destructive">*</span></Label>
                  <Textarea
                    value={editTarget.summary}
                    onChange={e => setEditTarget(prev => prev ? { ...prev, summary: e.target.value } : prev)}
                    placeholder="Brief summary shown in listings…"
                    rows={2}
                  />
                </div>
                <TinyMceRichEditor
                  label="Content"
                  value={editTarget.content}
                  onChange={(next) => setEditTarget((prev) => (prev ? { ...prev, content: next } : prev))}
                  placeholder="Write and format your full post content..."
                />
                <div className="space-y-2">
                  <Label>Tags (comma-separated)</Label>
                  <Input
                    value={tagsInput}
                    onChange={e => setTagsInput(e.target.value)}
                    placeholder="ICAG, exam, study"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editTarget.status}
                    onValueChange={v => setEditTarget(prev => prev ? { ...prev, status: v as BlogPost['status'] } : prev)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Published">Published</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <ImageBucketField
                    label="Cover image"
                    description="Upload a cover image to cloud storage."
                    value={editTarget.coverUrl && !editTarget.coverUrl.startsWith('http') ? editTarget.coverUrl : ''}
                    isUploading={isUploadingCover}
                    onFileSelected={(file) => void handleCoverUpload(file)}
                    inputId="blog-cover-upload"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : editTarget?.id ? 'Save Changes' : 'Create Post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete post?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; will be permanently deleted.
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
