'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { CheckCheck, Copy, Gift, History, Link2, Loader2, Percent, Users } from 'lucide-react';
import type { User } from '@/lib/db';
import { DEFAULT_REFERRAL_REWARD_PERCENT, MAX_AFFILIATE_DISCOUNT_PERCENT } from '@/lib/affiliate-discount';
import { apiFetch } from '@/lib/api-client';

export default function AffiliateDashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useUser();
  const { toast } = useToast();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<'link' | 'code' | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/login?redirect=/affiliate');
      return;
    }
    fetchProfile();
  }, [user, authLoading, router]);

  const fetchProfile = async () => {
    try {
      const res = await apiFetch('/users/profile');
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      const userData = data.user as User;
      setProfile(userData);
      if (userData.role !== 'student') {
        const dest = userData.role === 'tutor' ? '/tutor-dashboard' : '/admin';
        router.replace(dest);
        return;
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const rewards = profile?.affiliateDiscountRewards;
  const history = useMemo(() => [...(rewards?.history || [])].reverse(), [rewards?.history]);
  const affiliateCode = useMemo(() => {
    const code = profile?.affiliateProfile?.id || profile?.id || '';
    return code.trim();
  }, [profile]);
  const referralBaseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || 'https://profstrainingsolutions.com';
  const referralLink = useMemo(() => {
    const existing = profile?.affiliate_link?.trim();
    if (existing) return existing;
    if (!affiliateCode) return '';
    return `${referralBaseUrl.replace(/\/$/, '')}/ref/${encodeURIComponent(affiliateCode)}`;
  }, [affiliateCode, profile?.affiliate_link, referralBaseUrl]);

  const copyValue = async (value: string, field: 'link' | 'code') => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 2000);
      toast({ title: field === 'link' ? 'Referral link copied' : 'Referral code copied' });
    } catch {
      toast({ variant: 'destructive', title: `Could not copy referral ${field}` });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 py-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">Affiliate rewards</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Earn <strong>{DEFAULT_REFERRAL_REWARD_PERCENT}%</strong> cashback credit for each referred student who completes a paid course enrollment (up to{' '}
            {MAX_AFFILIATE_DISCOUNT_PERCENT}% stacked). This replaces cash commissions — cashback is redeemed automatically on your next checkout.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/student-dashboard">Back to dashboard</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5" /> Share your referral
          </CardTitle>
          <CardDescription>
            Copy your referral URL or code and send it to new students. Qualified paid enrollments automatically add discount credit to your next checkout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Referral URL</p>
              <div className="flex gap-2">
                <Input value={referralLink} readOnly aria-label="Referral URL" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyValue(referralLink, 'link')}
                  disabled={!referralLink}
                >
                  {copiedField === 'link' ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span className="ml-2 hidden sm:inline">{copiedField === 'link' ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Referral code</p>
              <div className="flex gap-2">
                <Input value={affiliateCode} readOnly aria-label="Referral code" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copyValue(affiliateCode, 'code')}
                  disabled={!affiliateCode}
                >
                  {copiedField === 'code' ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span className="ml-2 hidden sm:inline">{copiedField === 'code' ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Anyone can use the link directly, or you can share just the code and add it to the referral path.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total referrals credited</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{rewards?.totalReferrals ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cashback earned (lifetime)</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {Math.min(MAX_AFFILIATE_DISCOUNT_PERCENT, (rewards?.history || []).filter((h) => h.kind === 'referral_purchase').reduce((s, h) => s + (h.percentDelta || 0), 0))}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">From referral purchases only</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available cashback on next checkout</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{rewards?.discountPercentAvailable ?? 0}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" /> Cashback history
          </CardTitle>
          <CardDescription>Referral cashback credit and redemption activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet. Share your referral link from your profile or signup flow.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <div>
                    <Badge variant={entry.kind === 'referral_purchase' ? 'default' : 'secondary'} className="mb-1 text-[10px] uppercase">
                      {entry.kind === 'referral_purchase' ? 'Earned' : 'Applied'}
                    </Badge>
                    <p className="font-medium">{entry.note || entry.kind}</p>
                    <p className="text-xs text-muted-foreground">{new Date(entry.at).toLocaleString()}</p>
                  </div>
                  <span className="font-mono font-bold text-primary">
                    {entry.percentDelta > 0 ? '+' : ''}
                    {entry.percentDelta}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
