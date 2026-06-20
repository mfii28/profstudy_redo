'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStudentProfile } from '@/hooks/use-student-profile';
import type { Book, BookPurchase } from '@/lib/db';
import { BookOpen, Search, Star } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { resolveMediaUrl } from '@/lib/media-url';

export default function BooksPage() {
  const { user: currentUser, isLoading: isUserLoading } = useStudentProfile();
  const [books, setBooks] = useState<Book[]>([]);
  const [purchases, setPurchases] = useState<BookPurchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'digital' | 'physical' | 'owned'>('all');

  useEffect(() => {
    if (isUserLoading) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const idToken = currentUser ? await currentUser.getIdToken(true) : '';
        const [booksRes, purchasesRes] = await Promise.all([
          fetch('/api/books', { cache: 'no-store' }),
          currentUser
            ? fetch('/api/book-orders', {
                headers: { Authorization: `Bearer ${idToken}` },
                cache: 'no-store',
              })
            : Promise.resolve(null),
        ]);

        const booksData = await booksRes.json();
        const purchasesData = purchasesRes ? await purchasesRes.json() : { orders: [] };

        setBooks(Array.isArray(booksData.books) ? booksData.books : []);
        setPurchases(Array.isArray(purchasesData.orders) ? purchasesData.orders : []);
      } catch {
        setBooks([]);
        setPurchases([]);
      }
      setIsLoading(false);
    };
    void load();
  }, [currentUser, isUserLoading]);

  const purchasedBookIds = useMemo(() => new Set(purchases.map((p) => p.bookId)), [purchases]);

  const filtered = useMemo(() => {
    return books.filter((book) => {
      const matchesSearch =
        book.title.toLowerCase().includes(search.toLowerCase()) ||
        book.author.toLowerCase().includes(search.toLowerCase()) ||
        book.category.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      if (tab === 'digital') return book.type === 'digital';
      if (tab === 'physical') return book.type === 'physical';
      if (tab === 'owned') return purchasedBookIds.has(book.id);
      return true;
    });
  }, [books, search, tab, purchasedBookIds]);

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-primary text-primary-foreground rounded-xl p-6 sm:p-8 shadow-lg">
        <h1 className="text-2xl sm:text-3xl font-black font-headline uppercase tracking-tighter mb-1">Book Store</h1>
        <p className="text-primary-foreground/75 text-sm font-medium">
          Browse digital and physical study materials. Digital books open in the secure online reader.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search books, authors, categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="digital">Digital</TabsTrigger>
            <TabsTrigger value="physical">Physical</TabsTrigger>
            <TabsTrigger value="owned">My Books</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-10 w-10 text-muted-foreground" />}
          title={tab === 'owned' ? 'No books purchased yet' : 'No books found'}
          description={tab === 'owned' ? 'Browse the store to find your first book.' : 'Try a different search or filter.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              owned={purchasedBookIds.has(book.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookCard({ book, owned }: { book: Book; owned: boolean }) {
  const isFreeBook = Boolean(book.isFree) || Number(book.price ?? 0) <= 0;

  return (
    <Card className="flex flex-col overflow-hidden hover:shadow-lg transition-shadow duration-200">
      <div className="relative h-48 bg-muted">
        {book.coverUrl ? (
          <Image src={resolveMediaUrl(book.coverUrl)} alt={book.title} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex items-center justify-center h-full">
            <BookOpen className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}
        <div className="absolute top-2 left-2 flex gap-1">
          <Badge variant={book.type === 'digital' ? 'default' : 'secondary'} className="text-xs">
            {book.type === 'digital' ? 'Digital' : 'Physical'}
          </Badge>
          {owned && (
            <Badge variant="outline" className="text-xs bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400">
              Owned
            </Badge>
          )}
        </div>
      </div>
      <CardContent className="flex flex-col gap-1 p-4 flex-1">
        <p className="text-xs text-muted-foreground">{book.category}</p>
        <h3 className="font-semibold line-clamp-2 leading-tight">{book.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-1">by {book.author}</p>
        {book.rating != null && (
          <div className="flex items-center gap-1 mt-1">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-xs font-medium">{book.rating.toFixed(1)}</span>
            {book.reviewsCount != null && (
              <span className="text-xs text-muted-foreground">({book.reviewsCount})</span>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0 flex items-center justify-between">
        <span className="font-bold text-sm">
          {isFreeBook ? 'Free' : `GH₵ ${(book.price ?? 0).toFixed(2)}`}
        </span>
        <Button size="sm" asChild>
          <Link href={`/student-dashboard/books/${book.id}`}>
            {owned ? 'Open' : isFreeBook ? 'Claim' : 'Details'}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
