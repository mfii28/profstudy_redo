'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  BookOpen,
  Loader2,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { getPresignedUploadUrl, deleteAsset } from '@/app/actions/storage';
import { uploadToR2 } from '@/lib/upload-client';
import { resolveMediaUrl } from '@/lib/media-url';
import type { Book } from '@/lib/db';

type EditableBook = Partial<Book> & { id: string };

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount || 0);
}

function defaultBook(): EditableBook {
  const id = `book-${Date.now()}`;
  return {
    id,
    title: '',
    author: '',
    description: '',
    coverUrl: '',
    price: 0,
    type: 'digital',
    category: '',
    status: 'Draft',
    fileKey: '',
    shippingEst: '2-5 business days',
    stockCount: 0,
    tags: [],
  };
}

export default function AdminBooksPage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingBookFile, setIsUploadingBookFile] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [editableBook, setEditableBook] = useState<EditableBook>(defaultBook());

  const coverInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBooks = async () => {
    // Avoid unauthenticated calls on first render before user context is ready.
    if (!user) {
      setBooks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch('/api/books?includeDraft=true', {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: 'no-store',
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message = payload?.error || `Failed to fetch books (HTTP ${res.status}).`;
        toast({ variant: 'destructive', title: 'Books load failed', description: message });
        setBooks([]);
        return;
      }

      const data = await res.json();
      setBooks(Array.isArray(data.books) ? data.books : []);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Books load failed', description: error?.message || 'Unexpected error.' });
      setBooks([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchBooks();
  }, [user?.uid]);

  const filteredBooks = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return books;
    return books.filter((book) => {
      return (
        book.title.toLowerCase().includes(q) ||
        (book.author || '').toLowerCase().includes(q) ||
        (book.category || '').toLowerCase().includes(q)
      );
    });
  }, [books, search]);

  const openCreateDialog = () => {
    setEditableBook(defaultBook());
    setIsDialogOpen(true);
  };

  const openEditDialog = (book: Book) => {
    setEditableBook({ ...book });
    setIsDialogOpen(true);
  };

  const handleUploadCover = async (file: File) => {
    if (!user) return;
    setIsUploadingCover(true);
    try {
      const idToken = await user.getIdToken(true);
      const result = await getPresignedUploadUrl(user.uid, 'book_cover', file.name, file.type, undefined, idToken);
      if (result.error || !result.key || !result.url) throw new Error(result.error || 'Failed to upload cover.');

      await uploadToR2(result.url, file, result.contentType || file.type || 'image/jpeg', {
        key: result.key,
        idToken,
      });
      setEditableBook((prev) => ({ ...prev, coverUrl: result.key! }));
      toast({ title: 'Cover uploaded' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Cover upload failed', description: error?.message });
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleUploadBookFile = async (file: File) => {
    if (!user) return;
    if ((editableBook.type || 'digital') !== 'digital') {
      toast({ variant: 'destructive', title: 'Only digital books can have a file.' });
      return;
    }

    setIsUploadingBookFile(true);
    try {
      const idToken = await user.getIdToken(true);
      const bookId = editableBook.id && editableBook.id.trim().length > 0
        ? editableBook.id.trim()
        : `book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      if (bookId !== editableBook.id) {
        setEditableBook((prev) => ({ ...prev, id: bookId }));
      }

      const result = await getPresignedUploadUrl(
        user.uid,
        'book_file',
        file.name,
        file.type || 'application/pdf',
        bookId,
        idToken
      );
      if (result.error || !result.key || !result.url) throw new Error(result.error || 'Failed to upload file.');

      await uploadToR2(result.url, file, result.contentType || 'application/pdf', {
        key: result.key,
        idToken,
      });
      setEditableBook((prev) => ({ ...prev, fileKey: result.key! }));
      toast({ title: 'Book file uploaded' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Book file upload failed', description: error?.message });
    } finally {
      setIsUploadingBookFile(false);
    }
  };

  const handleSaveBook = async () => {
    if (!user) return;
    if (!editableBook.title || !editableBook.author || !editableBook.description || !editableBook.category) {
      toast({ variant: 'destructive', title: 'Missing required fields' });
      return;
    }

    if ((editableBook.type || 'digital') === 'digital' && !editableBook.fileKey) {
      toast({ variant: 'destructive', title: 'Digital books require a PDF file.' });
      return;
    }

    setIsSaving(true);
    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          ...editableBook,
          status: editableBook.status || 'Draft',
          type: editableBook.type || 'digital',
          price: Number(editableBook.price || 0),
          stockCount: Number(editableBook.stockCount || 0),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save book.');

      toast({ title: 'Book saved successfully' });
      setIsDialogOpen(false);
      await fetchBooks();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: error?.message });
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDeleteBook = async () => {
    if (!user || !bookToDelete) return;
    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch(`/api/books/${bookToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete book.');

      if (bookToDelete.coverUrl && bookToDelete.coverUrl.startsWith('public/')) {
        await deleteAsset(bookToDelete.coverUrl, user.uid);
      }

      toast({ title: 'Book deleted' });
      setBookToDelete(null);
      await fetchBooks();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Delete failed', description: error?.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold font-headline">Books Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create, publish, and manage digital and physical books with secure storage.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <PlusCircle className="h-4 w-4 mr-2" /> Add Book
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by title, author, or category"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
          <CardDescription>All books currently in the marketplace registry.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="h-56 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Book</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBooks.map((book) => (
                  <TableRow key={book.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 rounded-md overflow-hidden border bg-muted">
                          {book.coverUrl ? (
                            <Image src={resolveMediaUrl(book.coverUrl)} alt={book.title} fill className="object-cover" unoptimized />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center">
                              <BookOpen className="h-5 w-5 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium leading-tight">{book.title}</p>
                          <p className="text-xs text-muted-foreground">{book.author}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={book.type === 'digital' ? 'default' : 'secondary'}>{book.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={book.status === 'Published' ? 'default' : 'outline'}>{book.status}</Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(book.price || 0)}</TableCell>
                    <TableCell>{book.type === 'physical' ? (book.stockCount ?? 0) : '-'}</TableCell>
                    <TableCell className="pr-6 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(book)}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setBookToDelete(book)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editableBook.id && books.some((b) => b.id === editableBook.id) ? 'Edit Book' : 'Create Book'}</DialogTitle>
            <DialogDescription>Configure metadata, pricing, and secure assets for this book.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={editableBook.title || ''} onChange={(e) => setEditableBook((prev) => ({ ...prev, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Author</Label>
              <Input value={editableBook.author || ''} onChange={(e) => setEditableBook((prev) => ({ ...prev, author: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={editableBook.category || ''} onChange={(e) => setEditableBook((prev) => ({ ...prev, category: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={editableBook.type || 'digital'}
                onChange={(e) => setEditableBook((prev) => ({ ...prev, type: e.target.value as 'digital' | 'physical' }))}
              >
                <option value="digital">Digital</option>
                <option value="physical">Physical</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={editableBook.status || 'Draft'}
                onChange={(e) => setEditableBook((prev) => ({ ...prev, status: e.target.value as 'Published' | 'Draft' }))}
              >
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Price (GH₵)</Label>
              <Input type="number" min="0" value={editableBook.price || 0} onChange={(e) => setEditableBook((prev) => ({ ...prev, price: Number(e.target.value || 0) }))} />
            </div>
            {(editableBook.type || 'digital') === 'physical' && (
              <>
                <div className="space-y-2">
                  <Label>Stock Count</Label>
                  <Input type="number" min="0" value={editableBook.stockCount || 0} onChange={(e) => setEditableBook((prev) => ({ ...prev, stockCount: Number(e.target.value || 0) }))} />
                </div>
                <div className="space-y-2">
                  <Label>Shipping Estimate</Label>
                  <Input value={editableBook.shippingEst || ''} onChange={(e) => setEditableBook((prev) => ({ ...prev, shippingEst: e.target.value }))} />
                </div>
              </>
            )}

            <div className="md:col-span-2 space-y-2">
              <Label>Description</Label>
              <Textarea rows={4} value={editableBook.description || ''} onChange={(e) => setEditableBook((prev) => ({ ...prev, description: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Cover Image</Label>
              <div className="rounded-md border p-3 flex items-center gap-3">
                <Button type="button" variant="outline" onClick={() => coverInputRef.current?.click()} disabled={isUploadingCover}>
                  {isUploadingCover ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />} Upload Cover
                </Button>
                <span className="text-xs text-muted-foreground truncate">{editableBook.coverUrl || 'No cover uploaded'}</span>
              </div>
              <input ref={coverInputRef} className="hidden" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void handleUploadCover(e.target.files[0])} />
            </div>

            {(editableBook.type || 'digital') === 'digital' && (
              <div className="space-y-2">
                <Label>Digital Book PDF</Label>
                <div className="rounded-md border p-3 flex items-center gap-3">
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploadingBookFile}>
                    {isUploadingBookFile ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />} Upload PDF
                  </Button>
                  <span className="text-xs text-muted-foreground truncate">{editableBook.fileKey || 'No file uploaded'}</span>
                </div>
                <input ref={fileInputRef} className="hidden" type="file" accept="application/pdf" onChange={(e) => e.target.files?.[0] && void handleUploadBookFile(e.target.files[0])} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSaveBook()} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Book
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!bookToDelete} onOpenChange={() => setBookToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete book?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the book from catalog visibility and deletes associated storage files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => void confirmDeleteBook()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
