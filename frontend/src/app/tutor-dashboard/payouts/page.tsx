'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/firebase';
import { getUserById } from '@/lib/user-data';
import { submitPayoutRequest, getPayoutRequestsByTutor } from '@/lib/payout-request-data';
import type { PayoutRequest, User } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    Banknote,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2,
    AlertCircle,
    Building2,
    Smartphone,
    Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { emitUserCommunicationEvent } from '@/app/actions/communications';

function StatusBadge({ status }: { status: PayoutRequest['status'] }) {
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
    if (status === 'rejected') return <Badge className="bg-red-100 text-red-800 border-red-200"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    return <Badge className="bg-amber-100 text-amber-800 border-amber-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
}

export default function TutorPayoutsPage() {
    const { user } = useUser();
    const { toast } = useToast();

    const [profile, setProfile] = useState<User | null>(null);
    const [requests, setRequests] = useState<PayoutRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');

    const loadData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const [userProfile, history] = await Promise.all([
                getUserById(user.uid),
                getPayoutRequestsByTutor(user.uid),
            ]);
            setProfile(userProfile ?? null);
            setRequests(history);
        } catch {
            toast({ variant: 'destructive', title: 'Failed to load payout data' });
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => { loadData(); }, [loadData]);

    const tutorDetails = profile?.tutorDetails;
    const payoutMethod = tutorDetails?.payoutMethod;
    const hasPaymentInfo = !!(
        (payoutMethod === 'bank' && tutorDetails?.bankName && tutorDetails?.accountNumber) ||
        (payoutMethod === 'momo' && tutorDetails?.momoNumber)
    );

    const hasPendingRequest = requests.some(r => r.status === 'pending');

    const handleSubmit = async () => {
        if (!user || !payoutMethod) return;
        const parsedAmount = parseFloat(amount);
        if (!parsedAmount || parsedAmount <= 0) {
            toast({ variant: 'destructive', title: 'Enter a valid amount' });
            return;
        }
        if (!hasPaymentInfo) {
            toast({ variant: 'destructive', title: 'No payment method set', description: 'Add your bank or MoMo details in Settings first.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: Omit<PayoutRequest, 'id' | 'status' | 'submittedAt'> = {
                tutorId: user.uid,
                amount: parsedAmount,
                method: payoutMethod,
                note: note.trim() || undefined,
                ...(payoutMethod === 'bank'
                    ? {
                        bankName: tutorDetails?.bankName,
                        accountNumber: tutorDetails?.accountNumber,
                        accountName: tutorDetails?.bankAccountName,
                    }
                    : {
                        momoNumber: tutorDetails?.momoNumber,
                        momoNetwork: tutorDetails?.momoNetwork,
                    }),
            };
            await submitPayoutRequest(payload);
            const idToken = await user.getIdToken();
            const commResult = await emitUserCommunicationEvent({
                idToken,
                userId: user.uid,
                eventKey: 'payout_request',
                title: 'Payout request submitted',
                message: `Your payout request for GH₵${parsedAmount.toFixed(2)} has been received.`,
                metadata: {
                    payment_amount: `GH₵${parsedAmount.toFixed(2)}`,
                },
            });
            if (commResult.error) {
                console.warn('[Payout] Communication notification failed:', commResult.error);
            }
            toast({ title: 'Payout request submitted', description: 'The admin team will review and process it shortly.' });
            setAmount('');
            setNote('');
            await loadData();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Submission failed', description: err.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-3xl">
            <div>
                <h1 className="text-3xl font-black font-headline tracking-tight">Payout Requests</h1>
                <p className="text-muted-foreground text-sm mt-1">Request a withdrawal of your earnings. The admin team reviews all requests within 2-3 business days.</p>
            </div>

            {!hasPaymentInfo && (
                <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="flex gap-3 p-4">
                        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-amber-800">No payment method on file</p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                Go to <strong>Settings → Payout details</strong> and add your bank account or MoMo number before requesting a payout.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {hasPendingRequest && (
                <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="flex gap-3 p-4">
                        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-800">You already have a pending payout request. Please wait for it to be processed before submitting another.</p>
                    </CardContent>
                </Card>
            )}

            <Card className="border-none shadow-lg">
                <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="flex items-center gap-2"><Banknote className="h-5 w-5 text-primary" /> Request Payout</CardTitle>
                    <CardDescription>Funds will be sent to your registered payment method.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    {payoutMethod && (
                        <div className="p-4 rounded-xl bg-muted/30 border flex items-center gap-3">
                            {payoutMethod === 'bank' ? (
                                <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                            ) : (
                                <Smartphone className="h-5 w-5 text-muted-foreground shrink-0" />
                            )}
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {payoutMethod === 'bank' ? 'Bank Transfer' : 'Mobile Money'}
                                </p>
                                {payoutMethod === 'bank' ? (
                                    <p className="text-sm font-bold">
                                        {tutorDetails?.bankName} — ****{tutorDetails?.accountNumber?.slice(-4)}
                                        {tutorDetails?.bankAccountName && <span className="font-normal text-muted-foreground ml-2">({tutorDetails.bankAccountName})</span>}
                                    </p>
                                ) : (
                                    <p className="text-sm font-bold">
                                        {tutorDetails?.momoNetwork} — {tutorDetails?.momoNumber}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount to withdraw (GH₵)</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">GH₵</span>
                            <Input
                                id="amount"
                                type="number"
                                min={1}
                                className="pl-12 h-12 text-lg font-bold"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                disabled={!hasPaymentInfo || hasPendingRequest}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="note">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Textarea
                            id="note"
                            placeholder="Any additional notes for the admin team..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            disabled={!hasPaymentInfo || hasPendingRequest}
                            rows={3}
                        />
                    </div>

                    <Button
                        className="w-full h-12 font-black"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !hasPaymentInfo || hasPendingRequest || !amount}
                    >
                        {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Banknote className="mr-2 h-4 w-4" />}
                        Submit Payout Request
                    </Button>
                </CardContent>
            </Card>

            <div>
                <h2 className="text-xl font-bold font-headline mb-4">Request History</h2>
                {requests.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground border rounded-xl bg-muted/10">
                        <Banknote className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">No payout requests yet</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {requests.map((req) => (
                            <Card key={req.id} className="border shadow-sm">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-3">
                                                <p className="text-xl font-black">GH₵ {req.amount.toFixed(2)}</p>
                                                <StatusBadge status={req.status} />
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {req.method === 'bank' ? `Bank: ${req.bankName} ****${req.accountNumber?.slice(-4)}` : `MoMo: ${req.momoNetwork} ${req.momoNumber}`}
                                            </p>
                                            <p className="text-xs text-muted-foreground">Submitted {new Date(req.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                            {req.note && <p className="text-xs text-muted-foreground italic">"{req.note}"</p>}
                                            {req.adminNote && (
                                                <p className={cn("text-xs font-medium mt-1", req.status === 'rejected' ? 'text-destructive' : 'text-green-700')}>
                                                    Admin: {req.adminNote}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
