'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/firebase';
import { getOrders } from '@/lib/finance-data';
import { getCourseById } from '@/lib/course-data';
import type { Order } from '@/lib/db';
import type { Course } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/dashboard/empty-state';
import { ShoppingBag, BookOpen, Calendar, Receipt, ExternalLink } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';
import { ImageWithFallback } from '@/components/image-with-fallback';

type OrderWithCourses = Order & {
  resolvedCourses: Course[];
};

function PurchaseSkeleton() {
  return (
    <Card className="overflow-hidden border-none shadow-md">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row gap-0">
          <Skeleton className="h-40 sm:w-48 shrink-0" />
          <div className="p-5 space-y-3 flex-1">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-9 w-32 mt-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCurrency(amount: number) {
  return `GH₵ ${Number(amount).toFixed(2)}`;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'Delivered': return 'bg-green-100 text-green-700 border-green-200';
    case 'Processing': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'Cancelled': return 'bg-red-100 text-red-700 border-red-200';
    default: return 'bg-muted text-muted-foreground';
  }
}

export default function MyPurchasesPage() {
  const { user, isLoading: isAuthLoading } = useUser();
  const [orders, setOrders] = useState<OrderWithCourses[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAuthLoading || !user) return;

    const loadOrders = async () => {
      setIsLoading(true);
      try {
        const rawOrders = await getOrders(user.uid);

        // Enrich each order with course metadata
        const enriched = await Promise.all(
          rawOrders.map(async (order) => {
            const courseIds: string[] = Array.isArray(order.courseIds) ? order.courseIds : [];

            const resolvedCourses = (
              await Promise.all(courseIds.map(id => getCourseById(id).catch(() => undefined)))
            ).filter((c): c is Course => !!c);

            return { ...order, resolvedCourses } as OrderWithCourses;
          })
        );

        // Most recent first
        enriched.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setOrders(enriched);
      } catch (err) {
        console.error('[MyPurchases] Failed to load orders', err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadOrders();
  }, [user, isAuthLoading]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold">My Purchases</h1>
          <p className="text-muted-foreground">A record of all your course purchases and transactions.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/student-dashboard/my-learning">
            <BookOpen className="h-4 w-4 mr-2" /> My Learning
          </Link>
        </Button>
      </div>

      {isLoading || isAuthLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <PurchaseSkeleton key={i} />)}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-16 w-16 text-muted-foreground" />}
          title="No purchases yet"
          description="Your course purchases will appear here once you complete a payment."
          action={
            <Button asChild>
              <Link href="/student-dashboard/browse-courses">Browse Courses</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden border-none shadow-md">
              <CardContent className="p-0">
                {order.resolvedCourses.length > 0 ? (
                  order.resolvedCourses.map((course) => (
                    <div key={course.id} className="flex flex-col sm:flex-row border-b last:border-b-0">
                      <div className="relative sm:w-48 shrink-0 bg-muted overflow-hidden">
                        <ImageWithFallback
                          src={resolveMediaUrl(course.imageUrl)}
                          alt={course.title}
                          className="h-40 w-full object-cover sm:h-full"
                          fallbackSrc="/placeholder.svg"
                        />
                      </div>
                      <div className="p-5 flex flex-col justify-between flex-1 min-w-0">
                        <div className="space-y-1">
                          <h3 className="font-headline font-bold text-base leading-tight line-clamp-2">{course.title}</h3>
                          {course.instructor?.name && (
                            <p className="text-xs text-muted-foreground">by {course.instructor.name}</p>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{formatDate(order.date)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-semibold">
                            <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                            <span>{formatCurrency(order.total)}</span>
                          </div>
                          <Badge variant="outline" className={cn('text-[10px] font-bold uppercase tracking-wider px-2', statusColor(order.status))}>
                            {order.status}
                          </Badge>
                        </div>
                        <div className="mt-4">
                          <Button asChild size="sm" className="gap-2 font-bold rounded-full">
                            <Link href={`/student-dashboard/learn/${course.id}`}>
                              <BookOpen className="h-3.5 w-3.5" /> Open Course
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  // Order has no course IDs (e.g. book or physical product)
                  <div className="flex flex-col sm:flex-row items-start gap-4 p-5">
                    <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <Receipt className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-bold text-sm leading-tight line-clamp-2">{order.items}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{formatDate(order.date)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                          <span>{formatCurrency(order.total)}</span>
                        </div>
                        <Badge variant="outline" className={cn('text-[10px] font-bold uppercase tracking-wider px-2', statusColor(order.status))}>
                          {order.status}
                        </Badge>
                      </div>
                      {order.paymentReference && (
                        <p className="text-[10px] text-muted-foreground mt-1 font-mono">Ref: {order.paymentReference}</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
