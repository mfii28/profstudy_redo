// @ts-nocheck
'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/firebase';
import { auth as firebaseAuth } from '@/firebase/client';
import { sendEmailVerification } from 'firebase/auth';
import { Loader2, MailCheck, RefreshCw, AlertCircle } from 'lucide-react';

const RESEND_COOLDOWN = 60;

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const { toast } = useToast();

  const uid = searchParams.get('uid') || '';

  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [verified, setVerified] = useState(false);

  const cooldownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncSessionAndRedirect = useCallback(async () => {
    const currentUser = auth?.currentUser;
    if (!currentUser) return;

    const tokenResult = await currentUser.getIdTokenResult(true);
    const secure = window.location.protocol === 'https:' ? 'Secure;' : '';
    document.cookie = `__session=${tokenResult.token}; path=/; max-age=3600; SameSite=Lax; ${secure}`;

    const role = String(tokenResult.claims?.role || '').toLowerCase();
    if (role === 'admin' || role === 'superadmin' || role === 'subadmin') {
      router.replace('/admin');
      return;
    }
    if (role === 'tutor') {
      router.replace('/tutor-dashboard');
      return;
    }
    router.replace('/student-dashboard');
  }, [auth, router]);

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownTimer.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!uid) {
      router.replace('/signup');
    }
  }, [uid, router]);

  useEffect(() => {
    let active = true;

    const checkVerification = async () => {
      const currentUser = auth?.currentUser;
      if (!currentUser) return;

      try {
        await currentUser.reload();
        const tokenResult = await currentUser.getIdTokenResult(true);
        if (!active) return;

        if (tokenResult.claims?.emailVerified === true || currentUser.emailVerified) {
          setVerified(true);
          toast({ title: 'Email verified', description: 'Redirecting to your dashboard...' });
          await syncSessionAndRedirect();
        }
      } catch {
        // Ignore
      }
    };

    void checkVerification();
    const interval = setInterval(checkVerification, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [auth, syncSessionAndRedirect, toast]);

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;

    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) {
      setError('You must be signed in to resend a verification email.');
      return;
    }

    setIsResending(true);
    setError('');

    try {
      await sendEmailVerification(currentUser);
      toast({ title: 'Email resent', description: 'Check your inbox for a new verification link.' });
      startCooldown();
    } catch (e: any) {
      setError(e.message || 'Failed to resend. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  if (verified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <MailCheck className="h-16 w-16 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold">Email Verified!</h2>
          <p className="text-muted-foreground">Redirecting you to your dashboard...</p>
          <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <Card className="border-none shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <MailCheck className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="font-headline text-2xl font-black uppercase tracking-tighter">
              Verify Your Email
            </CardTitle>
            <CardDescription>
              We sent a verification link to your email address. Click the link to activate your account.
              This page will automatically refresh once verified.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Did not receive the email?</p>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleResend}
                disabled={cooldown > 0 || isResending}
              >
                {isResending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : isResending
                  ? 'Sending...'
                  : 'Resend Verification Email'}
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              Wrong account?{' '}
              <Link href="/login" className="text-primary font-bold underline">
                Sign in instead
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
