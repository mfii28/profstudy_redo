'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getOrders, getPayouts } from "@/lib/finance-data";
import { getUsers } from '@/lib/user-data';
import { Banknote, ShoppingCart, DollarSign, Loader2 } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';

type Transaction = {
    id: string;
    date: string;
    type: 'Sale' | 'Payout';
    amount: number;
    status: string;
    user: string;
    details: string;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);

function StatCard({ icon, title, value, isLoading }: { icon: React.ReactNode, title: string, value: string, isLoading: boolean }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <div className="text-muted-foreground">{icon}</div>
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">{value}</div>}
            </CardContent>
        </Card>
    );
}

const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
        case 'Completed':
        case 'Delivered':
        case 'Paid':
            return 'default';
        case 'Pending':
        case 'Processing':
            return 'secondary';
        case 'Failed':
        case 'Cancelled':
        case 'Rejected':
            return 'destructive';
        default:
            return 'outline';
    }
}


export default function AdminFinancePage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchTransactions = async () => {
            setIsLoading(true);
            try {
                const [orders, payouts, { users }] = await Promise.all([
                    getOrders(),
                    getPayouts(),
                    getUsers()
                ]);

                const userMap = new Map(users.map(u => [u.id, u.name]));

                const sales: Transaction[] = orders.map(o => {
                    const totalAmount = typeof o.total === 'number' ? o.total : parseFloat(String(o.total).replace(/[^0-9.]/g, ''));
                    return {
                        id: o.id,
                        date: o.date,
                        type: 'Sale',
                        amount: totalAmount || 0,
                        status: o.status,
                        user: userMap.get(o.userId) || 'Unknown',
                        details: `Order #${o.orderId}`
                    };
                });

                const payoutTxs: Transaction[] = payouts.map(p => ({
                    id: p.id,
                    date: p.date,
                    type: 'Payout',
                    amount: -p.amount,
                    status: p.status,
                    user: userMap.get(p.tutorId) || 'Unknown Tutor',
                    details: `Payout via ${p.method}`
                }));

                const allTransactions = [...sales, ...payoutTxs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setTransactions(allTransactions);
            } catch (error) {
                console.error("Finance Error:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTransactions();
    }, []);

    const totalRevenue = transactions.filter(t => t.type === 'Sale').reduce((sum, t) => sum + t.amount, 0);
    const totalPayouts = transactions.filter(t => t.type === 'Payout').reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 font-headline">Financial Oversight</h1>
        <p className="text-muted-foreground">
          Master ledger of all platform revenue, fees, and instructor payouts.
        </p>
      </div>

       <div className="grid gap-6 md:grid-cols-3">
          <StatCard isLoading={isLoading} icon={<DollarSign />} title="Total Revenue" value={formatCurrency(totalRevenue)} />
          <StatCard isLoading={isLoading} icon={<Banknote />} title="Total Payouts" value={formatCurrency(totalPayouts)} />
          <StatCard isLoading={isLoading} icon={<ShoppingCart />} title="Total Transactions" value={transactions.length.toString()} />
       </div>

       <Card>
        <CardHeader>
            <CardTitle>Global Revenue Ledger</CardTitle>
            <CardDescription>A complete audit trail of all financial transactions on the platform.</CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactions.map(t => (
                            <TableRow key={t.id}>
                                <TableCell>{new Date(t.date).toLocaleDateString()}</TableCell>
                                <TableCell>{t.user}</TableCell>
                                <TableCell><Badge variant={t.type === 'Sale' ? 'secondary' : 'outline'}>{t.type}</Badge></TableCell>
                                <TableCell className="text-muted-foreground text-xs">{t.details}</TableCell>
                                <TableCell><Badge variant={getStatusVariant(t.status)}>{t.status}</Badge></TableCell>
                                <TableCell className={`text-right font-medium ${t.amount < 0 ? 'text-destructive' : 'text-success'}`}>{formatCurrency(t.amount)}</TableCell>
                            </TableRow>
                        ))}
                        {transactions.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                    No financial records found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
