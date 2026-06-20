'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useStudentProfile } from '@/hooks/use-student-profile';
import { getBookById, hasUserPurchasedBook } from '@/lib/book-data';
import { purchaseBook, claimFreeBook } from '@/app/actions/books';
import type { Book, UserAddress } from '@/lib/db';
import { resolveMediaUrl } from '@/lib/media-url';
import {
  BookOpen,
  Loader2,
  Package,
  Star,
  ArrowLeft,
  BookMarked,
} from 'lucide-react';

interface BookDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function BookDetailPage({ params }: BookDetailPageProps) {
  const { id: bookId } = use(params);
  const { toast } = useToast();
  const { user: currentUser, profile, isLoading: isUserLoading } = useStudentProfile();

  const [book, setBook] = useState<Book | null>(null);
  const [isOwned, setIsOwned] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Shipping address for physical books
  const [showShipping, setShowShipping] = useState(false);
  const [shipping, setShipping] = useState<UserAddress>({
    line1: '',
    line2: '',
    city: '',
    region: '',
    zip: '',
    phone: '',
  });

  useEffect(() => {
    if (isUserLoading) return;
    const load = async () => {
      setIsLoading(true);
      const [bookData, owned] = await Promise.all([
        getBookById(bookId),
        currentUser ? hasUserPurchasedBook(currentUser.uid, bookId) : Promise.resolve(false),
      ]);
      setBook(bookData);
      setIsOwned(owned);
      setIsLoading(false);
    };
    void load();
  }, [bookId, currentUser, isUserLoading]);

  // Pre-fill shipping from profile address
  useEffect(() => {
    if (profile?.address) {
      setShipping((prev) => ({ ...prev, ...profile.address }));
    }
  }, [profile]);

  const handlePurchase = async () => {
    if (!currentUser || !book) return;

    // Free digital book — claim directly, no payment flow
    if (Boolean(book.isFree) || Number(book.price ?? 0) <= 0) {
      setIsPurchasing(true);
      try {
        const idToken = await currentUser.getIdToken(true);
        const result = await claimFreeBook(bookId, idToken);
        if (result.error) {
          toast({ variant: 'destructive', title: 'Could not claim book', description: result.error });
        } else {
          setIsOwned(true);
          toast({ title: 'Book added to your library!' });
        }
      } catch {
        toast({ variant: 'destructive', title: 'An error occurred. Please try again.' });
      } finally {
        setIsPurchasing(false);
      }
      return;
    }

    if (book.type === 'physical' && !showShipping) {
      setShowShipping(true);
      return;
    }
    setIsPurchasing(true);
    try {
      const idToken = await currentUser.getIdToken(true);
      const result = await purchaseBook(
        bookId,
        idToken,
        currentUser.email ?? '',
        book.type === 'physical' ? shipping : undefined
      );
      if (result.error) {
        toast({ variant: 'destructive', title: 'Purchase Failed', description: result.error });
      } else if (result.authorization_url) {
        window.location.href = result.authorization_url;
      }
    } catch {
      toast({ variant: 'destructive', title: 'An error occurred. Please try again.' });
    } finally {
      setIsPurchasing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 col-span-1" />
          <div className="col-span-2 flex flex-col gap-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4 py-20">
        <div className="p-4 rounded-2xl bg-muted">
          <BookOpen className="h-10 w-10 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-1">Book not found</h2>
          <p className="text-sm text-muted-foreground">This book may have been removed or the link is incorrect.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/student-dashboard/books">Back to Store</Link>
        </Button>
      </div>
    );
  }

  const isDigital = book.type === 'digital';
  const isFreeBook = Boolean(book.isFree) || Number(book.price ?? 0) <= 0;
  const isOutOfStock = !isDigital && book.stockCount != null && book.stockCount <= 0;

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <Button variant="ghost" size="sm" className="w-fit -ml-1" asChild>
        <Link href="/student-dashboard/books">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Store
        </Link>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cover */}
        <div className="flex flex-col gap-4">
          <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted border">
            {book.coverUrl ? (
              <Image src={resolveMediaUrl(book.coverUrl)} alt={book.title} fill className="object-cover" unoptimized />
            ) : (
              <div className="flex items-center justify-center h-full">
                <BookMarked className="h-16 w-16 text-muted-foreground/40" />
              </div>
            )}
          </div>

          {/* Action buttons */}
          {isOwned ? (
            <div className="flex flex-col gap-2">
              {isDigital && (
                <Button asChild>
                  <Link href={`/student-dashboard/books/${bookId}/read`}>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Read Online
                  </Link>
                </Button>
              )}
              {!isDigital && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 border rounded-lg bg-muted/50">
                  <Package className="h-4 w-4 shrink-0" />
                  Physical copy ordered — check your delivery status in{' '}
                  <Link href="/student-dashboard/transactions" className="text-primary underline">
                    Transactions
                  </Link>
                  .
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {showShipping && book.type === 'physical' && (
                <ShippingForm shipping={shipping} setShipping={setShipping} />
              )}
              <Button onClick={handlePurchase} disabled={isPurchasing || isOutOfStock} size="lg">
                {isPurchasing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                {isOutOfStock
                  ? 'Out of Stock'
                  : isFreeBook
                  ? 'Claim Free Book'
                  : showShipping
                  ? `Pay GH₵ ${(book.price ?? 0).toFixed(2)}`
                  : `Buy — GH₵ ${(book.price ?? 0).toFixed(2)}`}
              </Button>
              {!currentUser && (
                <p className="text-xs text-muted-foreground text-center">
                  <Link href="/login" className="text-primary underline">Sign in</Link> to purchase
                </p>
              )}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={isDigital ? 'default' : 'secondary'}>
                {isDigital ? 'Digital' : 'Physical'}
              </Badge>
              <Badge variant="outline">{book.category}</Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-tight">{book.title}</h1>
            <p className="text-muted-foreground mt-1">by {book.author}</p>
            {book.rating != null && (
              <div className="flex items-center gap-1 mt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < Math.round(book.rating!) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'
                    }`}
                  />
                ))}
                <span className="text-sm text-muted-foreground ml-1">
                  {book.rating.toFixed(1)} ({book.reviewsCount ?? 0} reviews)
                </span>
              </div>
            )}
          </div>

          <Separator />

          <div>
            <h2 className="font-semibold mb-2">About this book</h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{book.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {book.pages && (
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">Pages</span>
                <span className="font-medium">{book.pages}</span>
              </div>
            )}
            {book.isbn && (
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">ISBN</span>
                <span className="font-medium">{book.isbn}</span>
              </div>
            )}
            {!isDigital && book.shippingEst && (
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">Delivery estimate</span>
                <span className="font-medium">{book.shippingEst}</span>
              </div>
            )}
            {!isDigital && book.stockCount != null && (
              <div className="flex flex-col">
                <span className="text-muted-foreground text-xs">In stock</span>
                <span className={`font-medium ${book.stockCount < 5 ? 'text-destructive' : ''}`}>
                  {book.stockCount > 0 ? `${book.stockCount} left` : 'Out of stock'}
                </span>
              </div>
            )}
          </div>

          {book.tags && book.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {book.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {isDigital && isOwned && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-green-700 dark:text-green-400">
                  You own this book
                </CardTitle>
              </CardHeader>
              <CardContent className="flex gap-3 items-center">
                <Button asChild size="sm">
                  <Link href={`/student-dashboard/books/${bookId}/read`}>
                    <BookOpen className="h-4 w-4 mr-2" /> Read Online
                  </Link>
                </Button>
                <p className="text-xs text-muted-foreground">Download is disabled for protected digital books.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ShippingForm({
  shipping,
  setShipping,
}: {
  shipping: UserAddress;
  setShipping: React.Dispatch<React.SetStateAction<UserAddress>>;
}) {
  const field = (label: string, key: keyof UserAddress, placeholder?: string) => (
    <div className="flex flex-col gap-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={shipping[key] ?? ''}
        onChange={(e) => setShipping((prev) => ({ ...prev, [key]: e.target.value }))}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
    </div>
  );

  return (
    <Card className="p-4 border-dashed">
      <p className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Package className="h-4 w-4" /> Shipping Address
      </p>
      <div className="flex flex-col gap-2">
        {field('Street Address', 'line1', '123 Main St')}
        {field('Apartment / Unit (optional)', 'line2', 'Apt 4B')}
        {field('City', 'city', 'Accra')}
        {field('Region', 'region', 'Greater Accra')}
        {field('Phone Number', 'phone', '+233 20 000 0000')}
      </div>
    </Card>
  );
}
