'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/firebase';
import { getOrders } from '@/lib/finance-data';
import type { Order } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ShoppingBag, Calendar, CreditCard, Hash } from 'lucide-react';

function formatCurrency(amount: number) {
  return `GH₵ ${Number(amount).toFixed(2)}`;
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'Completed' || status === 'paid') return 'default';
  if (status === 'Pending' || status === 'pending') return 'secondary';
  if (status === 'Failed' || status === 'failed') return 'destructive';
  return 'outline';
}

function OrderSkeleton() {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-5 space-y-3">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
      </CardContent>
    </Card>
  );
}

export default function OrdersPage() {
  const { user } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    getOrders(user.uid)
      .then(setOrders)
      .finally(() => setIsLoading(false));
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline mb-1">Order History</h1>
        <p className="text-muted-foreground text-sm">All your course and book purchases.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <OrderSkeleton key={i} />)}</div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-10 w-10" />}
          title="No orders yet"
          description="Your purchase history will appear here."
          action={<Link href="/student-dashboard/browse-courses"><Button>Browse Courses</Button></Link>}
        />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <p className="font-semibold text-base leading-tight">{order.items}</p>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(order.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Hash className="h-3.5 w-3.5" />
                        {order.orderId}
                      </span>
                      {order.paymentMethod && (
                        <span className="flex items-center gap-1">
                          <CreditCard className="h-3.5 w-3.5" />
                          {order.paymentMethod}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-2">
                    <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                    <Badge variant={statusVariant(order.status)}>{order.status}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
