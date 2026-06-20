'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { getSubscriptions } from "@/lib/subscription-data";
import { type Subscription } from "@/lib/db";
import { EmptyState } from "@/components/dashboard/empty-state";
import { CreditCard, Calendar, CheckCircle2 } from "lucide-react";
import { useStudentProfile } from "@/hooks/use-student-profile";

export default function BillingPage() {
  const { user: currentUser, isLoading: isUserLoading } = useStudentProfile();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSubscriptionsData = async () => {
      if (currentUser) {
        setIsLoading(true);
        try {
          const userSubs = await getSubscriptions(currentUser.uid);
          setSubscriptions(userSubs);
        } catch (error) {
          console.error('Failed to fetch subscriptions:', error);
        } finally {
          setIsLoading(false);
        }
      } else if (!isUserLoading) {
        setIsLoading(false);
      }
    };
    fetchSubscriptionsData();
  }, [currentUser, isUserLoading]);

  if (isUserLoading || isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-1/3" />
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 font-headline">Billing</h1>
        <p className="text-muted-foreground">
          View your course purchases and payment records.
        </p>
      </div>

      <Card className="border-2 border-primary/10 bg-primary/5">
        <CardContent className="p-6 flex items-start gap-4">
          <div className="p-3 rounded-full bg-primary/10 text-primary shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-black uppercase text-xs tracking-widest text-primary mb-1">All AI Features Are Free</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every AI tool on Profs Training Solutions — the Study Tutor, Flashcards, Study Planner — is completely free for all enrolled students. No subscription required.
            </p>
          </div>
        </CardContent>
      </Card>

      {subscriptions.length > 0 ? (
        <div className="grid gap-6">
          {subscriptions.map(sub => (
            <Card key={sub.id} className="overflow-hidden">
              <div className="bg-primary h-2 w-full" />
              <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={sub.status === 'Active' ? 'default' : 'secondary'}>{sub.status}</Badge>
                  </div>
                  <CardTitle className="text-2xl">{sub.planName}</CardTitle>
                  <CardDescription className="flex items-center gap-1.5 mt-1">
                    <CreditCard className="h-3 w-3" /> Billed at {sub.price} / month
                  </CardDescription>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-semibold flex items-center sm:justify-end gap-1.5">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Next billing date
                  </p>
                  <p className="text-xl font-bold">{new Date(sub.nextPaymentDate).toLocaleDateString()}</p>
                </div>
              </CardHeader>
              <CardFooter className="bg-muted/20 border-t justify-end gap-3">
                <Button variant="outline" asChild>
                  <Link href="/contact">Contact Billing Support</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<CreditCard className="h-16 w-16 text-muted-foreground/50" />}
          title="No billing records"
          description="Your course purchase records will appear here."
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Billing Policy</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• Course purchases are one-time payments processed securely via Paystack.</p>
          <p>• Refund requests are handled through our support team within 7 days of purchase.</p>
          <p>• Contact support for any billing disputes or payment issues.</p>
        </CardContent>
      </Card>
    </div>
  );
}
