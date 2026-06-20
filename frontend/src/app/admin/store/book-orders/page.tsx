'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PackageSearch, Search, Truck } from 'lucide-react';
import type { BookPurchase, BookDeliveryStatus } from '@/lib/db';

const STATUS_OPTIONS: BookDeliveryStatus[] = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];

function statusVariant(status?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (!status) return 'secondary';
  if (status === 'Delivered') return 'default';
  if (status === 'Cancelled') return 'destructive';
  if (status === 'Shipped') return 'outline';
  return 'secondary';
}

export default function AdminBookOrdersPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [orders, setOrders] = useState<BookPurchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingId, setIsUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchOrders = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch('/api/book-orders?scope=all', {
        headers: { Authorization: `Bearer ${idToken}` },
        cache: 'no-store',
      });
      const data = await res.json();
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchOrders();
  }, [user?.uid]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return orders;
    return orders.filter((order) => {
      return (
        (order.bookTitle || '').toLowerCase().includes(q) ||
        (order.userId || '').toLowerCase().includes(q) ||
        (order.orderReference || '').toLowerCase().includes(q) ||
        (order.receiptCode || '').toLowerCase().includes(q)
      );
    });
  }, [orders, search]);

  const updateStatus = async (order: BookPurchase, deliveryStatus: BookDeliveryStatus) => {
    if (!user) return;
    setIsUpdatingId(order.id);
    try {
      const idToken = await user.getIdToken(true);
      const res = await fetch(`/api/book-orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ deliveryStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update order.');

      setOrders((prev) => prev.map((it) => (it.id === order.id ? { ...it, ...data.order } : it)));
      toast({ title: 'Order updated', description: `${order.orderReference || order.id} is now ${deliveryStatus}.` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update failed', description: error?.message });
    } finally {
      setIsUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold font-headline">Book Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track physical fulfillment using order, receipt, and tracking references.
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search order/ref/user" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fulfillment Queue</CardTitle>
          <CardDescription>
            Only physical books require status updates. Digital books are auto-fulfilled after payment.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="h-56 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="h-56 flex flex-col gap-2 items-center justify-center text-muted-foreground">
              <PackageSearch className="h-8 w-8" />
              <p>No book orders found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Book</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Order Ref</TableHead>
                  <TableHead>REC Code</TableHead>
                  <TableHead>Tracking Ref</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="pl-6">
                      <p className="font-medium">{order.bookTitle}</p>
                      <p className="text-xs text-muted-foreground">{order.bookType}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{order.userId}</TableCell>
                    <TableCell className="font-mono text-xs">{order.orderReference || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{order.receiptCode || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{order.trackingReference || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(order.deliveryStatus)}>{order.deliveryStatus || 'Paid'}</Badge>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="flex justify-end gap-1">
                        {STATUS_OPTIONS.map((status) => (
                          <Button
                            key={status}
                            size="sm"
                            variant={order.deliveryStatus === status ? 'default' : 'outline'}
                            disabled={isUpdatingId === order.id}
                            onClick={() => void updateStatus(order, status)}
                          >
                            {isUpdatingId === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : status}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
