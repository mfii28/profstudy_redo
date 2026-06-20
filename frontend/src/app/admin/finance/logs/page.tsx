'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { History, Search, ArrowUpRight, ArrowDownLeft, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getUsers } from '@/lib/user-data';
import { getOrders, getPayouts } from "@/lib/finance-data";
import { Skeleton } from '@/components/ui/skeleton';

type Transaction = {
    id: string;
    date: string;
    type: 'Sale' | 'Payout' | 'Subscription';
    amount: number;
    status: string;
    user: string;
    details: string;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-GH', { 
    style: 'currency', 
    currency: 'GHS',
    minimumFractionDigits: 2 
}).format(amount);

const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const s = (status || '').toLowerCase();
    if (['completed', 'delivered', 'paid', 'success'].includes(s)) return 'default';
    if (['pending', 'processing', 'preparing to ship', 'shipped'].includes(s)) return 'secondary';
    if (['failed', 'cancelled', 'rejected'].includes(s)) return 'destructive';
    return 'outline';
}

export default function TransactionLogsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'Sale' | 'Payout'>('all');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [{ users }, orders, payouts] = await Promise.all([
                getUsers(),
                getOrders(),
                getPayouts(),
            ]);
            
            const userMap = new Map(users.map(u => [u.id, u.name]));

            const sales: Transaction[] = orders.map(o => ({
                id: o.id,
                date: o.date,
                type: (o.items || '').toLowerCase().includes('subscription') ? 'Subscription' : 'Sale',
                amount: Number(o.total) || 0,
                status: o.status,
                user: userMap.get(o.userId) || 'Unknown Customer',
                details: o.items || `Order #${o.orderId}`
            }));

            const payoutTxs: Transaction[] = payouts.map(p => ({
                id: p.id,
                date: p.date,
                type: 'Payout',
                amount: -Number(p.amount),
                status: p.status,
                user: userMap.get(p.tutorId) || 'Unknown Tutor',
                details: `Withdrawal via ${p.method}`
            }));

            const allTransactions = [...sales, ...payoutTxs].sort((a,b) => 
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            
            setTransactions(allTransactions);
        } catch (error) {
            console.error("Failed to fetch logs:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const filteredTransactions = transactions.filter(t => {
        const matchesSearch = 
            (t.details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.user || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesType = activeFilter === 'all' || t.type === activeFilter || (activeFilter === 'Sale' && t.type === 'Subscription');
        
        return matchesSearch && matchesType;
    });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
                <History className="h-8 w-8 text-primary" />
            </div>
            <div>
                <h1 className="text-3xl font-bold mb-1 font-headline">Master Transaction Ledger</h1>
                <p className="text-muted-foreground text-sm">
                    Detailed audit trail of all platform revenue, student purchases, and instructor payouts.
                </p>
            </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Sync Logs
        </Button>
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader className="bg-muted/30 border-b p-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by User, Item, or ID..." 
                        className="pl-9 bg-background"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant={activeFilter === 'all' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setActiveFilter('all')}
                    >
                        All
                    </Button>
                    <Button 
                        variant={activeFilter === 'Sale' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setActiveFilter('Sale')}
                    >
                        Inflows
                    </Button>
                    <Button 
                        variant={activeFilter === 'Payout' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setActiveFilter('Payout')}
                    >
                        Outflows
                    </Button>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            {isLoading ? (
                <div className="p-6 space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/10">
                            <TableRow>
                                <TableHead className="pl-6">Date</TableHead>
                                <TableHead>User / Customer</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Transaction Details</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right pr-6">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTransactions.length > 0 ? (
                                filteredTransactions.map(t => (
                                    <TableRow key={t.id} className="hover:bg-muted/5 transition-colors group">
                                        <TableCell className="pl-6 text-xs font-medium">
                                            {new Date(t.date).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </TableCell>
                                        <TableCell>
                                            <p className="font-bold text-sm">{t.user}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-mono">{t.id.substring(0, 12)}</p>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {t.amount > 0 ? (
                                                    <ArrowUpRight className="h-3 w-3 text-green-500" />
                                                ) : (
                                                    <ArrowDownLeft className="h-3 w-3 text-blue-500" />
                                                )}
                                                <Badge variant={t.type === 'Payout' ? 'outline' : 'secondary'} className="text-[10px] px-1.5 h-5">
                                                    {t.type}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-[250px] truncate text-xs text-muted-foreground italic">
                                            {t.details}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={getStatusVariant(t.status)} className="text-[10px] font-bold">
                                                {t.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={`text-right pr-6 font-mono font-bold ${t.amount < 0 ? 'text-destructive' : 'text-success'}`}>
                                            {formatCurrency(t.amount)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-24">
                                        <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                        <p>No transactions found matching your filters.</p>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
