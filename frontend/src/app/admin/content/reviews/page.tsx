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
import { getBookReviews, updateBookReview, removeBookReview } from '@/lib/book-reviews-data';
import type { BookReview } from '@/lib/db';
import { Star, Search, MoreHorizontal, CheckCircle2, XCircle, Trash2, RefreshCw, MessageSquare, BookOpen } from 'lucide-react';

const starRow = (n: number) => Array.from({ length: 5 }, (_, i) => (
  <Star key={i} size={10} className={i < n ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'} />
));

const statusVariant = (s: BookReview['status']) =>
  s === 'Approved' ? 'default' : s === 'Rejected' ? 'destructive' : 'secondary';

export default function AdminBookReviewsPage() {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<BookReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BookReview['status']>('all');
  const [ratingFilter, setRatingFilter] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all');
  const [replyTarget, setReplyTarget] = useState<BookReview | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BookReview | null>(null);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      setReviews(await getBookReviews());
    } catch {
      toast({ variant: 'destructive', title: 'Failed to load reviews' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleStatusChange = async (id: string, status: BookReview['status']) => {
    try {
      await updateBookReview(id, { status });
      setReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      toast({ title: `Review ${status.toLowerCase()}` });
    } catch {
      toast({ variant: 'destructive', title: 'Update failed' });
    }
  };

  const handleReply = async () => {
    if (!replyTarget || !replyText.trim()) return;
    setIsSaving(true);
    try {
      await updateBookReview(replyTarget.id, { adminReply: replyText, repliedAt: new Date().toISOString() });
      setReviews(prev => prev.map(r => r.id === replyTarget.id ? { ...r, adminReply: replyText, repliedAt: new Date().toISOString() } : r));
      toast({ title: 'Reply saved' });
      setReplyTarget(null);
      setReplyText('');
    } catch {
      toast({ variant: 'destructive', title: 'Reply failed' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await removeBookReview(deleteTarget.id);
      setReviews(prev => prev.filter(r => r.id !== deleteTarget.id));
      toast({ title: 'Review deleted' });
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const filtered = reviews.filter(r => {
    const matchesSearch = !search || (r.bookTitle || '').toLowerCase().includes(search.toLowerCase()) || (r.userName || '').toLowerCase().includes(search.toLowerCase()) || r.text.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesRating = ratingFilter === 'all' || r.rating === parseInt(ratingFilter);
    return matchesSearch && matchesStatus && matchesRating;
  });

  const stats = {
    total: reviews.length,
    pending: reviews.filter(r => r.status === 'Pending').length,
    approved: reviews.filter(r => r.status === 'Approved').length,
    avgRating: reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—',
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl"><Star className="h-7 w-7 text-primary" /></div>
          <div>
            <h1 className="text-3xl font-bold font-headline">Book Reviews</h1>
            <p className="text-muted-foreground text-sm">Moderate and manage reviews submitted for books in the store.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReviews} disabled={isLoading} className="gap-2">
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Sync
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Reviews', value: stats.total },
          { label: 'Pending Moderation', value: stats.pending },
          { label: 'Approved', value: stats.approved },
          { label: 'Avg. Rating', value: stats.avgRating },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by book, reviewer, or content…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={ratingFilter} onValueChange={v => setRatingFilter(v as typeof ratingFilter)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            {[5, 4, 3, 2, 1].map(n => <SelectItem key={n} value={String(n)}>{n} Stars</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle>Reviews ({filtered.length})</CardTitle>
          <CardDescription>Review submissions from book buyers and learners.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead className="pl-6">Book</TableHead>
                    <TableHead>Reviewer</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead>Review</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(review => (
                    <TableRow key={review.id} className="hover:bg-muted/5">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-1.5">
                          <BookOpen size={12} className="text-muted-foreground" />
                          <span className="font-semibold text-sm">{review.bookTitle || review.bookId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{review.userName || review.userId}</TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">{starRow(review.rating)}</div>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-muted-foreground max-w-xs truncate">{review.text}</p>
                        {review.adminReply && (
                          <p className="text-[10px] text-primary mt-0.5 truncate max-w-xs">↩ {review.adminReply}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(review.status)} className="text-[10px]">{review.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(review.date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={14} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {review.status !== 'Approved' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(review.id, 'Approved')} className="gap-2 text-green-600 focus:text-green-600">
                                <CheckCircle2 size={12} /> Approve
                              </DropdownMenuItem>
                            )}
                            {review.status !== 'Rejected' && (
                              <DropdownMenuItem onClick={() => handleStatusChange(review.id, 'Rejected')} className="gap-2 text-amber-600 focus:text-amber-600">
                                <XCircle size={12} /> Reject
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => { setReplyTarget(review); setReplyText(review.adminReply || ''); }} className="gap-2">
                              <MessageSquare size={12} /> Reply
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteTarget(review)} className="gap-2 text-destructive focus:text-destructive">
                              <Trash2 size={12} /> Delete
                            </DropdownMenuItem>
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
              <EmptyState title="No reviews found" description="Book reviews will appear here once submitted." icon={<Star className="h-12 w-12 text-muted-foreground/20" />} />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!replyTarget} onOpenChange={open => !open && setReplyTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reply to Review</DialogTitle>
            <DialogDescription>Write an admin response to this review for {replyTarget?.bookTitle || 'the book'}.</DialogDescription>
          </DialogHeader>
          {replyTarget && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/20 rounded-lg">
                <div className="flex gap-0.5 mb-1">{starRow(replyTarget.rating)}</div>
                <p className="text-sm text-muted-foreground">{replyTarget.text}</p>
              </div>
              <div className="space-y-2">
                <Label>Your Reply</Label>
                <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write your response…" rows={4} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplyTarget(null)}>Cancel</Button>
            <Button onClick={handleReply} disabled={isSaving || !replyText.trim()}>{isSaving ? 'Saving…' : 'Post Reply'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete review?</AlertDialogTitle>
            <AlertDialogDescription>This review will be permanently removed from the platform.</AlertDialogDescription>
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
