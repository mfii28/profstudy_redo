'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudentProfile } from '@/hooks/use-student-profile';
import { getOrders, getBillingHistory } from '@/lib/finance-data';
import type { BillingHistory, BookPurchase, Order } from '@/lib/db';
import { EmptyState } from '@/components/dashboard/empty-state';
import { ReceiptText, BookMarked, GraduationCap, Sparkles } from 'lucide-react';

type TxType = 'course' | 'book' | 'subscription';

type TransactionItem = {
  id: string;
  date: string;
  amount: number;
  status: string;
  type: TxType;
  title: string;
  details?: string;
};

export default function TransactionsPage() {
  const { user: currentUser, isLoading: isUserLoading } = useStudentProfile();

  const [orders, setOrders] = useState<Order[]>([]);
  const [bookPurchases, setBookPurchases] = useState<BookPurchase[]>([]);
  const [billing, setBilling] = useState<BillingHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<'all' | TxType>('all');

  useEffect(() => {
    if (isUserLoading) return;
    const load = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      const idToken = await currentUser.getIdToken(true);
      const [ordersData, booksDataResponse, billingData] = await Promise.all([
        getOrders(currentUser.uid),
        fetch('/api/book-orders', {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: 'no-store',
        }),
        getBillingHistory(currentUser.uid),
      ]);
      const booksData = await booksDataResponse.json();
      setOrders(ordersData);
      setBookPurchases(Array.isArray(booksData.orders) ? booksData.orders : []);
      setBilling(billingData);
      setIsLoading(false);
    };
    void load();
  }, [currentUser, isUserLoading]);

  const transactions = useMemo<TransactionItem[]>(() => {
    const orderTx: TransactionItem[] = orders.map((o) => {
      const items = (o.items || '').toLowerCase();
      const inferredType: TxType = items.includes('course') ? 'course' : 'course';
      return {
        id: `order-${o.id}`,
        date: o.date,
        amount: Number(o.total || 0),
        status: o.status,
        type: inferredType,
        title: o.items || 'Course Purchase',
        details: `Reference: ${o.orderId}`,
      };
    });

    const bookTx: TransactionItem[] = bookPurchases.map((b) => ({
      id: `book-${b.id}`,
      date: b.purchasedAt,
      amount: Number(b.amount || 0),
      status: b.deliveryStatus || 'Paid',
      type: 'book',
      title: b.bookTitle,
      details:
        b.bookType === 'physical'
          ? `Physical • ${b.deliveryStatus || 'Processing'} • ${b.orderReference || '-'} • ${b.receiptCode || '-'}`
          : `Digital • Protected online reader • ${b.receiptCode || '-'}`,
    }));

    const subTx: TransactionItem[] = billing.map((b) => ({
      id: `bill-${b.id ?? b.invoiceId}`,
      date: b.date,
      amount: Number(b.amount || 0),
      status: b.status,
      type: 'subscription',
      title: b.description || 'Subscription Payment',
      details: `${b.paymentMethod || 'Card'} • Invoice ${b.invoiceId}`,
    }));

    return [...orderTx, ...bookTx, ...subTx].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [orders, bookPurchases, billing]);

  const filtered = transactions.filter((t) => (tab === 'all' ? true : t.type === tab));

  const totalSpent = filtered.reduce((sum, t) => sum + (Number.isFinite(t.amount) ? t.amount : 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transaction History</h1>
          <p className="text-muted-foreground mt-1">
            View your course purchases, book purchases, and subscription payments.
          </p>
        </div>
        <Card className="w-full sm:w-auto">
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">Total ({tab === 'all' ? 'All' : tab})</p>
            <p className="text-xl font-bold">GH₵ {totalSpent.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="course">Courses</TabsTrigger>
          <TabsTrigger value="book">Books</TabsTrigger>
          <TabsTrigger value="subscription">Subscriptions</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="h-10 w-10 text-muted-foreground" />}
          title="No transactions yet"
          description="Your purchases and subscriptions will appear here once you make a payment."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((tx) => (
            <Card key={tx.id}>
              <CardContent className="py-4 px-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <TxIcon type={tx.type} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold leading-tight truncate">{tx.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(tx.date).toLocaleString()} {tx.details ? `• ${tx.details}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold">GH₵ {tx.amount.toFixed(2)}</p>
                  <Badge
                    variant={
                      tx.status.toLowerCase().includes('paid') ||
                      tx.status.toLowerCase().includes('delivered')
                        ? 'default'
                        : tx.status.toLowerCase().includes('failed') || tx.status.toLowerCase().includes('cancel')
                        ? 'destructive'
                        : 'secondary'
                    }
                    className="mt-1"
                  >
                    {tx.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TxIcon({ type }: { type: TxType }) {
  if (type === 'course') return <GraduationCap className="h-4 w-4" />;
  if (type === 'book') return <BookMarked className="h-4 w-4" />;
  return <Sparkles className="h-4 w-4" />;
}
