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
import { Loader2, MailCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { verifyOtp, sendOtpEmail } from '@/app/actions/otp';

const DIGIT_COUNT = 6;
const RESEND_COOLDOWN = 60;

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const { toast } = useToast();

  const uid = searchParams.get('uid') || '';

  const [digits, setDigits] = useState<string[]>(Array(DIGIT_COUNT).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [verified, setVerified] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
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

    const bypassIfAlreadyVerified = async () => {
      const currentUser = auth?.currentUser;
      if (!currentUser) return;

      try {
        const tokenResult = await currentUser.getIdTokenResult(true);
        if (!active) return;

        if (tokenResult.claims?.emailVerified === true) {
          setVerified(true);
          toast({ title: 'Email already verified', description: 'Redirecting to your dashboard...' });
          await syncSessionAndRedirect();
        }
      } catch {
        // Ignore and let manual OTP flow continue.
      }
    };

    void bypassIfAlreadyVerified();

    return () => {
      active = false;
    };
  }, [auth, syncSessionAndRedirect, toast]);

  const handleDigitChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setError('');

    if (char && index < DIGIT_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      setDigits(next);
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, DIGIT_COUNT);
    if (!pasted) return;
    const next = Array(DIGIT_COUNT).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, DIGIT_COUNT - 1)]?.focus();
  };

  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length < DIGIT_COUNT) {
      setError('Please enter all 6 digits.');
      return;
    }

    // Use the authenticated user's UID and token — never the URL param — to prevent
    // a logged-in attacker from verifying a victim's account.
    const currentUser = auth?.currentUser;
    if (!currentUser) {
      setError('You must be signed in to verify your email.');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const callerIdToken = await currentUser.getIdToken();
      const result = await verifyOtp({ uid: currentUser.uid, code, callerIdToken });

      if (result.success) {
        setVerified(true);
        toast({
          title: result.alreadyVerified ? 'Email already verified' : 'Email verified!',
          description: 'Your account is now fully active.',
        });
        await syncSessionAndRedirect();
      } else {
        setError(result.error || 'Verification failed. Please try again.');
        if (result.locked) {
          setDigits(Array(DIGIT_COUNT).fill(''));
        }
      }
    } catch {
      setError('Unexpected error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;

    // Use the authenticated user's UID — never the URL param — to prevent
    // a logged-in user from triggering OTP resend for a different account.
    const resendUser = auth?.currentUser;
    if (!resendUser) {
      setError('You must be signed in to resend a verification code.');
      return;
    }

    setIsResending(true);
    setError('');
    setDigits(Array(DIGIT_COUNT).fill(''));

    try {
      const callerIdToken = await resendUser.getIdToken();
      const callerUid = resendUser.uid;
      // Email/name are loaded server-side from Firestore — callerIdToken proves identity
      const result = await sendOtpEmail({ uid: callerUid, callerIdToken });
      if (result.success) {
        if (result.alreadyVerified) {
          setVerified(true);
          toast({ title: 'Email already verified', description: 'Redirecting to your dashboard...' });
          await syncSessionAndRedirect();
          return;
        }
        toast({ title: 'Code resent', description: 'Check your inbox for a new verification code.' });
        startCooldown();
        inputRefs.current[0]?.focus();
      } else {
        setError(result.error || 'Failed to resend. Please try again.');
      }
    } catch {
      setError('Failed to resend. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const isComplete = digits.every(d => d !== '');

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
              We sent a 6-digit code to your email address. Enter it below to activate your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div
              className="flex justify-center gap-2"
              onPaste={handlePaste}
            >
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  disabled={isVerifying}
                  aria-label={`Digit ${i + 1}`}
                  className={`h-14 w-11 rounded-lg border-2 bg-background text-center text-xl font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
                    error ? 'border-destructive' : 'border-input'
                  } ${isVerifying ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              ))}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <Button
              className="w-full h-12 font-bold text-base"
              onClick={handleVerify}
              disabled={!isComplete || isVerifying}
            >
              {isVerifying ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
              ) : (
                'Verify Email'
              )}
            </Button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Did not receive the code?</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={cooldown > 0 || isResending || isVerifying}
                className="gap-2"
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
                  : 'Resend Code'}
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
