'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { verifyTransaction } from '@/app/actions/payments';
import { useUser } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, BookOpen, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

const VERIFICATION_STEPS = [1, 2, 3, 4] as const;

function VerifyPaymentContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your payment...');
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const [verificationStep, setVerificationStep] = useState(0);
  const [purchasedCourseIds, setPurchasedCourseIds] = useState<string[]>([]);

  const finalizeFulfillment = useCallback(async () => {
    if (!reference) {
      setStatus('error');
      setMessage('Missing payment reference. Please restart checkout.');
      return;
    }
    if (isUserLoading) return;
    if (!user) {
      setStatus('error');
      setMessage('Your session has expired. Please sign in and then try again.');
      return;
    }

    try {
      setVerificationStep(1);
      setMessage('Verifying your payment with provider...');
      const idToken = await user.getIdToken();
      let result = await verifyTransaction(reference, undefined, idToken);
      let attempt = 0;
      while (
        attempt < 3 &&
        (!result.success && /in progress|temporarily|network|timeout/i.test(result.message || ''))
      ) {
        attempt += 1;
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        result = await verifyTransaction(reference, undefined, idToken);
      }
      if (!result.success || !result.metadata) {
          throw new Error(result.message || 'Payment verification failed at provider.');
      }

      const metadata = typeof result.metadata === 'string' ? JSON.parse(result.metadata) : result.metadata;
      if (user.uid !== metadata?.userId) {
          throw new Error('Account mismatch. Security policy prevents this action.');
      }

      setVerificationStep(2);
      setMessage('Finalizing your order securely...');

      const orderCourseIds = Array.isArray(result.courseIds) ? result.courseIds : [];
      setPurchasedCourseIds(orderCourseIds);
      setVerificationStep(4);
      setMessage('Your order has been confirmed.');
      setStatus('success');
      setMessage('Your payment has been verified and your order has been fulfilled successfully.');

      // Auto-redirect after a brief moment:
      // Single course → go directly to the course player
      // Multi-course → go to My Learning
      // No courses (e.g. book / physical item purchase) → go to My Purchases
      const redirectTarget =
        orderCourseIds.length === 1
          ? `/student-dashboard/learn/${orderCourseIds[0]}`
          : orderCourseIds.length > 1
          ? '/student-dashboard/my-learning'
          : '/student-dashboard/my-purchases';

      setTimeout(() => {
        router.push(redirectTarget);
      }, 2500);

    } catch (error: any) {
      console.error('[Fulfillment Flow Error]', error.message);
      setStatus('error');
      setMessage(error.message || 'An unexpected error stopped payment verification.');
    }
  }, [reference, user, isUserLoading, router]);

  useEffect(() => {
    finalizeFulfillment();
  }, [finalizeFulfillment]);


  return (
    <div className="page-container-md py-20 text-center">
      <Card className="text-center shadow-2xl border-none overflow-hidden">
        <div className={cn(
            "h-2 w-full",
            status === 'success' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-blue-500'
        )} />
        <CardContent className="pt-12 pb-12">
          {status === 'loading' && (
            <div className="space-y-6">
              <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
              <div>
                <CardTitle className="text-2xl font-headline">Finalizing Order</CardTitle>
                <CardDescription className="text-lg mt-2">{message}</CardDescription>
                <div className="mt-4 flex gap-1 justify-center">
                  {VERIFICATION_STEPS.map(step => (
                    <div
                      key={step}
                      className={`h-2 w-8 rounded-full transition-colors ${
                        step <= verificationStep ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-6 animate-in zoom-in-95 duration-500">
              <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-3xl font-headline text-green-700">Payment Verified!</CardTitle>
                <p className="text-muted-foreground mt-2 text-lg">{message}</p>
                {purchasedCourseIds.length === 1 && (
                  <p className="text-sm text-muted-foreground mt-1">Redirecting you to your course…</p>
                )}
                {purchasedCourseIds.length > 1 && (
                  <p className="text-sm text-muted-foreground mt-1">Redirecting you to My Learning…</p>
                )}
                {purchasedCourseIds.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-1">Redirecting you to My Purchases…</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                {purchasedCourseIds.length === 1 ? (
                  <Button className="w-full h-12 gap-2 font-bold sm:col-span-2" onClick={() => router.push(`/student-dashboard/learn/${purchasedCourseIds[0]}`)}>
                    <BookOpen size={18} /> Open Course Now
                  </Button>
                ) : (
                  <Button className="w-full h-12 gap-2 font-bold" onClick={() => router.push('/student-dashboard/my-learning')}>
                    <BookOpen size={18} /> My Learning
                  </Button>
                )}
                <Button variant="outline" className="w-full h-12 gap-2 font-bold" onClick={() => router.push('/student-dashboard')}>
                  <LayoutDashboard size={18} /> Dashboard
                </Button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="h-12 w-12 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-2xl font-headline text-red-700">Fulfillment Blocked</CardTitle>
                <p className="text-muted-foreground mt-2">{message}</p>
              </div>
              <div className="flex gap-4 justify-center">
                <Button variant="outline" onClick={() => router.push('/student-dashboard/cart')}>
                  Return to Cart
                </Button>
                <Button onClick={() => window.location.reload()}>
                  Retry Sync
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyPaymentPage() {
  return (
    <div className="page-container-md py-20">
      <Suspense fallback={<div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin" /></div>}>
        <VerifyPaymentContent />
      </Suspense>
    </div>
  );
}
