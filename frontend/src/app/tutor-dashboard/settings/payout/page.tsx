'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/firebase";
import { useToast } from '@/hooks/use-toast';
import { type TutorDetails } from '@/lib/db';
import { apiFetch } from '@/lib/api-client';
import { Loader2, Banknote, Smartphone, Info } from 'lucide-react';
import { savePayoutDetails } from '@/app/actions/payout';

type PayoutMethod = 'bank' | 'momo';
type MomoNetwork = 'MTN' | 'Vodafone' | 'AirtelTigo';

export default function TutorPayoutSettingsPage() {
  const { user: currentUser, isLoading: isAuthLoading } = useUser();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>('bank');
  const [bankName, setBankName] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [momoNetwork, setMomoNetwork] = useState<MomoNetwork>('MTN');
  const [payoutPhoneNumber, setPayoutPhoneNumber] = useState('');

  useEffect(() => {
    if (isAuthLoading || !currentUser) return;

    setIsLoading(true);
    apiFetch('/users/profile').then(res => res.ok ? res.json() : null).then(data => {
      if (data?.user) {
        const td = (data.user.tutorDetails || {}) as TutorDetails;
        if (td.payoutMethod) setPayoutMethod(td.payoutMethod);
        if (td.bankName) setBankName(td.bankName);
        if (td.bankAccountName) setBankAccountName(td.bankAccountName);
        if (td.accountNumber) setAccountNumber(td.accountNumber);
        if (td.momoNetwork) setMomoNetwork(td.momoNetwork);
        if (td.payoutPhoneNumber) setPayoutPhoneNumber(td.payoutPhoneNumber);
        if (td.momoNumber) setPayoutPhoneNumber((prev) => prev || td.momoNumber || '');
      }
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, [currentUser, isAuthLoading]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentUser) return;

    if (payoutMethod === 'bank') {
      if (!bankName.trim() || !bankAccountName.trim() || !accountNumber.trim()) {
        toast({ variant: 'destructive', title: 'Missing fields', description: 'Please fill in all bank details.' });
        return;
      }
    } else {
      if (!payoutPhoneNumber.trim()) {
        toast({ variant: 'destructive', title: 'Missing fields', description: 'Please enter your mobile money number.' });
        return;
      }
    }

    setIsSaving(true);
    try {
      const idToken = await currentUser.getIdToken();
      const result = await savePayoutDetails({
        idToken,
        payoutMethod,
        bankName,
        bankAccountName,
        accountNumber,
        momoNetwork,
        payoutPhoneNumber,
      });

      if (result.error) {
        toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
      } else {
        toast({ title: 'Payout Details Saved', description: 'Your payout information has been updated.' });
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Save Failed', description: err.message || 'Could not save payout details.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </CardHeader>
        <CardContent className="space-y-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </CardContent>
        <CardFooter><Skeleton className="h-10 w-24" /></CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payout Details</CardTitle>
        <CardDescription>
          Set up how you want to receive your earnings. All payouts are processed by the platform admin.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSave}>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 p-4 text-sm text-blue-800 dark:text-blue-300">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Your payout details are only visible to platform administrators. Payouts are initiated manually by the admin team after verification.
            </p>
          </div>

          <div className="space-y-3">
            <Label>Payout Method</Label>
            <RadioGroup
              value={payoutMethod}
              onValueChange={(val) => setPayoutMethod(val as PayoutMethod)}
              className="grid grid-cols-2 gap-4"
            >
              <label
                className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors ${payoutMethod === 'bank' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'}`}
              >
                <RadioGroupItem value="bank" className="sr-only" />
                <Banknote className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Bank Transfer</p>
                  <p className="text-xs text-muted-foreground">Direct to your bank account</p>
                </div>
              </label>
              <label
                className={`flex items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors ${payoutMethod === 'momo' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'}`}
              >
                <RadioGroupItem value="momo" className="sr-only" />
                <Smartphone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">Mobile Money</p>
                  <p className="text-xs text-muted-foreground">MTN, Vodafone, AirtelTigo</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {payoutMethod === 'bank' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  placeholder="e.g. GCB Bank, Ecobank, Fidelity Bank"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankAccountName">Account Name</Label>
                <Input
                  id="bankAccountName"
                  placeholder="Name as it appears on your bank account"
                  value={bankAccountName}
                  onChange={e => setBankAccountName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  placeholder="Your bank account number"
                  value={accountNumber}
                  onChange={e => setAccountNumber(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="momoNetwork">Mobile Network</Label>
                <Select value={momoNetwork} onValueChange={(val) => setMomoNetwork(val as MomoNetwork)}>
                  <SelectTrigger id="momoNetwork">
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MTN">MTN Mobile Money</SelectItem>
                    <SelectItem value="Vodafone">Vodafone Cash</SelectItem>
                    <SelectItem value="AirtelTigo">AirtelTigo Money</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payoutPhone">Mobile Money Number</Label>
                <Input
                  id="payoutPhone"
                  type="tel"
                  placeholder="e.g. 0241234567"
                  value={payoutPhoneNumber}
                  onChange={e => setPayoutPhoneNumber(e.target.value)}
                />
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSaving} className="font-bold">
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Payout Details
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
