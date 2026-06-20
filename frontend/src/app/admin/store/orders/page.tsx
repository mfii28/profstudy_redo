'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Truck, MoreHorizontal, Package, CheckCircle, Loader2, Search, Filter } from "lucide-react";
import { getOrders, updateOrderStatus } from '@/lib/finance-data';
import { getUsers } from '@/lib/user-data';
import { type Order, type User, type OrderStatus } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/dashboard/empty-state';
import { useUser } from '@/firebase';
import { logAdminAction } from '@/lib/audit-data';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);
}

const getStatusVariant = (status: OrderStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
        case 'Delivered':
            return 'default';
        case 'Preparing to Ship':
            return 'secondary';
        case 'Shipped':
            return 'outline';
        case 'Cancelled':
            return 'destructive';
        default:
            return 'secondary';
    }
}

export default function AdminOrdersPage() {
  const { user: adminUser } = useUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
        const [allOrders, allUsersResult] = await Promise.all([
            getOrders(),
            getUsers()
        ]);
        setOrders(allOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setUsers(allUsersResult.users);
    } catch (error) {
        console.error("Failed to fetch order fulfillment data:", error);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (!adminUser) return;
    
    updateOrderStatus(orderId, newStatus);
    
    // 1. Audit Log
    const order = orders.find(o => o.id === orderId);
    await logAdminAction({
        actorId: adminUser.uid,
        actorName: adminUser.displayName || adminUser.email || 'Administrator',
        action: 'ORDER_STATUS_UPDATE',
        targetId: orderId,
        targetType: 'order',
        severity: 'info',
        details: `Updated order #${order?.orderId.substring(0, 8)} status to ${newStatus}.`
    });

    // 2. Optimistic UI Update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    
    toast({
        title: "Order Fulfillment Updated",
        description: `Order #${orderId.substring(0, 8)} set to ${newStatus}.`
    });
  };

  const getUserName = (userId: string) => {
      return users.find(u => u.id === userId)?.name || 'Unknown Customer';
  };

  const filteredOrders = orders.filter(o => 
    o.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getUserName(o.userId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.items.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
                <Truck className="h-8 w-8 text-primary" />
            </div>
            <div>
                <h1 className="text-3xl font-bold mb-1 font-headline">Orders & Fulfillment</h1>
                <p className="text-muted-foreground text-sm">
                    Manage the shipping lifecycle for physical textbooks and materials.
                </p>
            </div>
        </div>
        <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search by ID, User, or Item..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle>Fulfillment Queue</CardTitle>
          <CardDescription>
            Downloadable content is fulfilled automatically. Physical items require manual updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : filteredOrders.length > 0 ? (
                <Table>
                    <TableHeader className="bg-muted/10">
                        <TableRow>
                            <TableHead className="pl-6">Order ID</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredOrders.map(order => (
                            <TableRow key={order.id} className="hover:bg-muted/5 transition-colors">
                                <TableCell className="pl-6 font-mono text-xs uppercase">{order.orderId}</TableCell>
                                <TableCell className="font-medium">{getUserName(order.userId)}</TableCell>
                                <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{order.items}</TableCell>
                                <TableCell className="font-bold">{formatCurrency(order.total)}</TableCell>
                                <TableCell>
                                    <Badge variant={getStatusVariant(order.status)} className="whitespace-nowrap text-[10px] font-black uppercase">
                                        {order.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'Preparing to Ship')}>
                                                <Package className="mr-2 h-4 w-4" /> Preparing
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'Shipped')}>
                                                <Truck className="mr-2 h-4 w-4" /> Mark as Shipped
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleUpdateStatus(order.id, 'Delivered')} className="text-success focus:text-success">
                                                <CheckCircle className="mr-2 h-4 w-4" /> Mark as Delivered
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <div className="py-20">
                    <EmptyState
                        icon={<Truck className="h-16 w-16 text-muted-foreground/30" />}
                        title="No matching orders"
                        description={searchTerm ? `No results found for "${searchTerm}".` : "The fulfillment queue is currently empty."}
                    />
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
