'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPayouts, updatePayoutStatus } from '@/lib/finance-data';
import { getAllPayoutRequests, updatePayoutRequestStatus } from '@/lib/payout-request-data';
import { type Payout, type PayoutRequest, type User } from '@/lib/db';
import { getUsers, getUserById } from '@/lib/user-data';
import { hasPermission } from '@/lib/rbac-data';
import { useToast } from "@/hooks/use-toast";
import { Check, X, Loader2, Banknote, History, Clock, RefreshCw, MoreVertical, CreditCard, Copy, CheckCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from '@/components/dashboard/empty-state';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from '@/firebase';
import { logAdminAction } from '@/lib/audit-data';
import { emitUserCommunicationEvent } from '@/app/actions/communications';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);
}

const getStatusVariant = (status: Payout['status']): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
        case 'Completed': return 'default';
        case 'Pending': return 'secondary';
        case 'Processing': return 'outline';
        case 'Failed': return 'destructive';
        default: return 'secondary';
    }
}

export default function AdminPayoutsPage() {
    const { user: adminUser } = useUser();
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentTab, setCurrentTab] = useState('requests');
    const { toast } = useToast();
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedId(label);
            setTimeout(() => setCopiedId(null), 2000);
            toast({ title: `Copied: ${text}` });
        } catch {
            toast({ variant: 'destructive', title: 'Copy failed' });
        }
    };

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [payoutData, requestData, { users: userData }] = await Promise.all([getPayouts(), getAllPayoutRequests(), getUsers()]);
            setPayouts(payoutData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setPayoutRequests(requestData);
            setUsers(userData);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Fetch Error' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUpdateStatus = async (payoutId: string, status: Payout['status']) => {
        if (!adminUser) return;

        const actingUser = await getUserById(adminUser.uid);
        const canApprovePayouts = await hasPermission(actingUser, 'finance:approve:payouts');
        if (!canApprovePayouts) {
            toast({
                variant: 'destructive',
                title: 'Permission denied',
                description: 'You do not have permission to approve payout requests.',
            });
            return;
        }

        const targetPayout = payouts.find(p => p.id === payoutId);
        const tutorName = users.find(u => u.id === targetPayout?.tutorId)?.name || 'Unknown';

        // Persist change
        updatePayoutStatus(payoutId, status);
        
        // Security Audit
        await logAdminAction({
            actorId: adminUser.uid,
            actorName: adminUser.displayName || adminUser.email || 'Administrator',
            action: 'PAYOUT_SETTLEMENT',
            targetId: payoutId,
            targetType: 'payout',
            severity: status === 'Completed' ? 'info' : 'critical',
            details: `Admin processed ${status} for ${tutorName} (${formatCurrency(targetPayout?.amount || 0)}).`
        });

        setPayouts(prev => prev.map(p => p.id === payoutId ? { ...p, status } : p));
        toast({ title: `Payout ${status}` });
    };

    const handleRequestAction = async (requestId: string, action: 'approved' | 'rejected', adminNote?: string) => {
        if (!adminUser) return;
        const actingUser = await getUserById(adminUser.uid);
        const canApprovePayouts = await hasPermission(actingUser, 'finance:approve:payouts');
        if (!canApprovePayouts) {
            toast({ variant: 'destructive', title: 'Permission denied', description: 'You do not have permission to manage payout requests.' });
            return;
        }
        try {
            await updatePayoutRequestStatus(requestId, action, adminNote);
            const targetReq = payoutRequests.find((r) => r.id === requestId);
            if (targetReq) {
                const idToken = await adminUser.getIdToken();
                await emitUserCommunicationEvent({
                    idToken,
                    userId: targetReq.tutorId,
                    eventKey: 'payout_status',
                    title: 'Payout request update',
                    message: `Your payout request has been ${action}.`,
                    metadata: {
                        payout_status: action,
                        payment_amount: formatCurrency(targetReq.amount),
                    },
                }).catch(() => undefined);
            }
            setPayoutRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: action, reviewedAt: new Date().toISOString() } : r));
            toast({ title: `Request ${action === 'approved' ? 'Approved' : 'Rejected'}` });
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Action failed', description: err.message });
        }
    };

    const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'Unknown Tutor';
    
    const filteredPayouts = payouts.filter(p => {
        if (currentTab === 'pending') return p.status === 'Pending' || p.status === 'Processing';
        return p.status === 'Completed' || p.status === 'Failed';
    });
    const pendingRequests = payoutRequests.filter(r => r.status === 'pending');

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl"><Banknote className="h-8 w-8 text-primary" /></div>
            <div>
                <h1 className="text-3xl font-bold mb-1 font-headline">Payout Registry</h1>
                <p className="text-muted-foreground text-sm">Review and authorize instructor earnings settlements.</p>
            </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading} className="gap-2">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Sync
        </Button>
      </div>

      <Tabs value={currentTab} onValueChange={setCurrentTab}>
        <TabsList>
            <TabsTrigger value="requests" className="gap-2"><Banknote size={14}/> Tutor Requests{pendingRequests.length > 0 && <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">{pendingRequests.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="pending" className="gap-2"><Clock size={14}/> Settlement Queue</TabsTrigger>
            <TabsTrigger value="history" className="gap-2"><History size={14}/> Archive</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
            <Card className="border-none shadow-lg overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                    <CardTitle>Tutor Payout Requests</CardTitle>
                    <CardDescription>Incoming withdrawal requests from instructors. Approve or reject each one.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-primary" /></div>
                    ) : payoutRequests.length > 0 ? (
                        <Table>
                            <TableHeader className="bg-muted/10">
                                <TableRow>
                                    <TableHead className="pl-6">Submitted</TableHead>
                                    <TableHead>Tutor</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Method</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {payoutRequests.map(req => (
                                    <TableRow key={req.id} className="hover:bg-muted/5">
                                        <TableCell className="pl-6 text-[10px] text-muted-foreground uppercase font-mono">{new Date(req.submittedAt).toLocaleDateString()}</TableCell>
                                        <TableCell className="font-bold text-sm">{getUserName(req.tutorId)}</TableCell>
                                        <TableCell className="font-mono font-bold text-primary">{formatCurrency(req.amount)}</TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5">
                                                    <CreditCard size={12} className="text-muted-foreground" />
                                                    <span className="text-[10px] font-bold uppercase">{req.method === 'bank' ? 'Bank' : 'MoMo'}</span>
                                                </div>
                                                {req.method === 'bank' ? (
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[10px] text-muted-foreground">{req.bankName}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[10px] font-mono">{req.accountNumber}</span>
                                                            <button
                                                                onClick={() => copyToClipboard(req.accountNumber || '', `acct-${req.id}`)}
                                                                className="text-muted-foreground hover:text-primary transition-colors"
                                                                title="Copy account number"
                                                            >
                                                                {copiedId === `acct-${req.id}` ? <CheckCheck size={10} className="text-green-600" /> : <Copy size={10} />}
                                                            </button>
                                                        </div>
                                                        {req.accountName && <p className="text-[10px] text-muted-foreground">{req.accountName}</p>}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] font-mono">{req.momoNetwork} · {req.momoNumber}</span>
                                                        <button
                                                            onClick={() => copyToClipboard(req.momoNumber || '', `momo-${req.id}`)}
                                                            className="text-muted-foreground hover:text-primary transition-colors"
                                                            title="Copy MoMo number"
                                                        >
                                                            {copiedId === `momo-${req.id}` ? <CheckCheck size={10} className="text-green-600" /> : <Copy size={10} />}
                                                        </button>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => copyToClipboard(getUserName(req.tutorId), `name-${req.id}`)}
                                                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                                                    title="Copy tutor name"
                                                >
                                                    {getUserName(req.tutorId)}
                                                    {copiedId === `name-${req.id}` ? <CheckCheck size={9} className="text-green-600" /> : <Copy size={9} />}
                                                </button>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {req.status === 'approved' && <Badge className="bg-green-100 text-green-800 text-[10px]">Approved</Badge>}
                                            {req.status === 'rejected' && <Badge variant="destructive" className="text-[10px]">Rejected</Badge>}
                                            {req.status === 'pending' && <Badge variant="outline" className="text-[10px]">Pending</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            {req.status === 'pending' ? (
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" variant="outline" className="h-8 text-[10px] font-black text-destructive hover:bg-destructive/10 border-destructive/20" onClick={() => handleRequestAction(req.id, 'rejected')}>REJECT</Button>
                                                    <Button size="sm" className="h-8 text-[10px] font-black" onClick={() => handleRequestAction(req.id, 'approved')}>APPROVE</Button>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground uppercase font-bold">Finalized</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : <div className="py-24"><EmptyState title="No requests" description="No tutor payout requests yet." icon={<Banknote className="h-12 w-12 text-muted-foreground/20"/>} /></div>}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="pending">
            <Card className="border-none shadow-lg overflow-hidden">
                <CardContent className="p-0 overflow-x-auto">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-primary" /></div>
                    ) : filteredPayouts.length > 0 ? (
                        <Table>
                            <TableHeader className="bg-muted/10">
                                <TableRow>
                                    <TableHead className="pl-6">Date</TableHead>
                                    <TableHead>Tutor</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Method</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right pr-6">Management</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPayouts.map(payout => (
                                    <TableRow key={payout.id} className="hover:bg-muted/5">
                                        <TableCell className="pl-6 text-[10px] text-muted-foreground uppercase font-mono">{new Date(payout.date).toLocaleDateString()}</TableCell>
                                        <TableCell className="font-bold text-sm">{getUserName(payout.tutorId)}</TableCell>
                                        <TableCell className="font-mono font-bold text-primary">{formatCurrency(payout.amount)}</TableCell>
                                        <TableCell><div className="flex items-center gap-2"><CreditCard size={14} className="text-muted-foreground" /><span className="text-[10px] font-bold uppercase">{payout.method}</span></div></TableCell>
                                        <TableCell><Badge variant={getStatusVariant(payout.status)} className="text-[10px]">{payout.status}</Badge></TableCell>
                                        <TableCell className="text-right pr-6">
                                            {(payout.status === 'Pending' || payout.status === 'Processing') ? (
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(payout.id, 'Processing')} disabled={payout.status === 'Processing'}>Process</Button>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical size={14}/></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => handleUpdateStatus(payout.id, 'Completed')} className="text-success">Confirm Payment</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleUpdateStatus(payout.id, 'Failed')} className="text-destructive">Reject/Fail Request</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            ) : <span className="text-[10px] text-muted-foreground uppercase font-bold">Finalized</span>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : <div className="py-24"><EmptyState title="Queue clear" description="All requests have been processed." icon={<Clock className="h-12 w-12 text-muted-foreground/20"/>} /></div>}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="history">
            <Card className="border-none shadow-lg overflow-hidden">
                <CardContent className="p-0 overflow-x-auto">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-primary" /></div>
                    ) : filteredPayouts.length > 0 ? (
                        <Table>
                            <TableHeader className="bg-muted/10">
                                <TableRow>
                                    <TableHead className="pl-6">Date</TableHead>
                                    <TableHead>Tutor</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Method</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPayouts.map(payout => (
                                    <TableRow key={payout.id} className="hover:bg-muted/5">
                                        <TableCell className="pl-6 text-[10px] text-muted-foreground uppercase font-mono">{new Date(payout.date).toLocaleDateString()}</TableCell>
                                        <TableCell className="font-bold text-sm">{getUserName(payout.tutorId)}</TableCell>
                                        <TableCell className="font-mono font-bold text-primary">{formatCurrency(payout.amount)}</TableCell>
                                        <TableCell><div className="flex items-center gap-2"><CreditCard size={14} className="text-muted-foreground" /><span className="text-[10px] font-bold uppercase">{payout.method}</span></div></TableCell>
                                        <TableCell><Badge variant={getStatusVariant(payout.status)} className="text-[10px]">{payout.status}</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : <div className="py-24"><EmptyState title="No history" description="No completed payouts in archive." icon={<History className="h-12 w-12 text-muted-foreground/20"/>} /></div>}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}