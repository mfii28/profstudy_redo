'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ProductCard } from '@/components/product-card';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { getProducts } from '@/lib/product-data';
import { type Book, type Product } from '@/lib/db';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Search } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/media-url';
import { useUser } from '@/firebase';
import { getBooks } from '@/lib/book-data';
import { apiFetch } from '@/lib/api-client';

export default function ShopPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const { user } = useUser();
  const [isAdminRole, setIsAdminRole] = useState(false);

  useEffect(() => {
    if (!user) return;
    apiFetch('/users/profile')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.user) {
          const role = data.user.role as string | undefined;
          setIsAdminRole(role === 'admin' || role === 'superadmin' || role === 'subadmin');
        }
      })
      .catch(() => {});
  }, [user]);
  const [bookSearch, setBookSearch] = useState('');
  const [bookType, setBookType] = useState<'all' | 'digital' | 'physical'>('all');

  useEffect(() => {
    const fetchProducts = async () => {
        setIsLoading(true);
        try {
          const [allProducts, booksRes] = await Promise.all([
            getProducts(),
            fetch('/api/books', { cache: 'no-store' }),
          ]);

          let publishedBooks: Book[] = [];
          if (booksRes.ok) {
            const booksData = await booksRes.json();
            publishedBooks = Array.isArray(booksData.books) ? booksData.books : [];
          } else {
            // Fallback for transient API/index issues so storefront still stays populated.
            publishedBooks = await getBooks({ includeDraft: false });
          }

          setProducts(allProducts);
          setBooks(publishedBooks);
        } finally {
          setIsLoading(false);
        }
    };
    
    fetchProducts();
  }, []);
  
  function ProductCardSkeleton() {
    return (
        <div className="flex flex-col space-y-3">
            <Skeleton className="h-[225px] w-full rounded-xl" />
            <div className="space-y-2">
                <Skeleton className="h-4 w-[250px]" />
                <Skeleton className="h-4 w-[200px]" />
            </div>
        </div>
    )
  }

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const q = bookSearch.toLowerCase().trim();
      const matchesSearch = !q
        || book.title.toLowerCase().includes(q)
        || (book.author || '').toLowerCase().includes(q)
        || (book.category || '').toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (bookType === 'all') return true;
      return book.type === bookType;
    });
  }, [books, bookSearch, bookType]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <section className="bg-primary text-primary-foreground overflow-hidden">
          <div className="page-container hero-pad">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-6 flex items-center gap-3">
                <span className="h-px w-10 bg-accent" aria-hidden />
                <span className="section-label !mb-0">Study Materials</span>
              </div>
              <h1 className="font-headline font-black text-[clamp(2.5rem,5vw,4rem)] leading-[1.02] tracking-tight">
                PTS Shop
              </h1>
              <p className="mt-4 max-w-xl text-lg text-primary-foreground/70 leading-relaxed">
                Textbooks, past exam questions, and digital study materials for ICAG and CITG students.
              </p>
            </motion.div>
          </div>
        </section>

        <section className="bg-background section-pad">
          <div className="page-container space-y-16 md:space-y-20">
          <div>
          <div className="mb-8">
            <p className="section-label">Books Marketplace</p>
            <h2 className="section-heading-sm">Digital &amp; Physical Books</h2>
            <p className="text-muted-foreground mt-2 text-sm max-w-lg">
              Digital books are DRM-protected and readable online after purchase.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                placeholder="Search books, authors, categories"
              />
            </div>
            <Tabs value={bookType} onValueChange={(v) => setBookType(v as typeof bookType)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="digital">Digital</TabsTrigger>
                <TabsTrigger value="physical">Physical</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => <ProductCardSkeleton key={`book-skeleton-${index}`} />)
            ) : filteredBooks.length === 0 ? (
              <div className="col-span-full py-10 border rounded-lg text-center text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No books found.
              </div>
            ) : (
              filteredBooks.map((book) => (
                <CardBook key={book.id} book={book} />
              ))
            )}
          </div>
          </div>

          <div className="border-t border-border pt-16 md:pt-20">
          <div className="mb-8">
            <p className="section-label">Physical Store</p>
            <h2 className="section-heading-sm">Physical Materials</h2>
            <p className="text-muted-foreground mt-2 text-sm max-w-lg">
              Textbooks and study packs delivered to your door.
            </p>
          </div>
          <div
            className='grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
          >
            {isLoading ? (
                Array.from({ length: 4 }).map((_, index) => <ProductCardSkeleton key={index} />)
            ) : (
                products.map((product) => (
                <motion.div layout key={product.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                    <ProductCard product={product} hideCart={isAdminRole} />
                </motion.div>
                ))
            )}
          </div>
          </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function CardBook({ book }: { book: Book }) {
  const isFreeBook = Boolean(book.isFree) || Number(book.price ?? 0) <= 0;

  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div className="h-full rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow">
        <div className="relative h-44 bg-muted">
          {book.coverUrl ? (
            <Image src={resolveMediaUrl(book.coverUrl)} alt={book.title} fill className="object-cover" unoptimized />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/40" />
            </div>
          )}
        </div>
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant={book.type === 'digital' ? 'default' : 'secondary'}>{book.type}</Badge>
            <Badge variant="outline">{book.category}</Badge>
          </div>
          <h3 className="font-semibold line-clamp-2">{book.title}</h3>
          <p className="text-xs text-muted-foreground">by {book.author}</p>
          <div className="flex items-center justify-between pt-2">
            <p className="font-bold">{isFreeBook ? 'Free' : `GH₵ ${Number(book.price || 0).toFixed(2)}`}</p>
            <Button asChild size="sm">
              <Link href="/student-dashboard/books">View</Link>
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
