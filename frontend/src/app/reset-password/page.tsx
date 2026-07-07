'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/firebase/client';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { validatePassword } from '@/lib/password-validation';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const oobCode = searchParams.get('oobCode');
  
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidCode, setIsValidCode] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!oobCode) {
      setIsValidCode(false);
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setEmail(email);
        setIsValidCode(true);
      })
      .catch(() => {
        setIsValidCode(false);
      });
  }, [oobCode]);

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const passCheck = validatePassword(password);
    if (!passCheck.isValid) {
        toast({ variant: 'destructive', title: 'Weak Password', description: passCheck.error });
        return;
    }

    if (!oobCode) return;

    setIsLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      toast({
        title: 'Success',
        description: 'Your password has been reset successfully. You can now log in.',
      });
      router.replace('/login');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to reset password.',
      });
      setIsLoading(false);
    }
  };

  if (isValidCode === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isValidCode === false) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <Logo className="mb-8" />
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-destructive mb-2">Invalid or Expired Link</h2>
          <p className="text-muted-foreground mb-6">
            The password reset link is invalid or has expired. Please request a new one from the login page.
          </p>
          <Button onClick={() => router.replace('/login')} className="w-full">
            Return to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>
      
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-headline font-black text-2xl text-primary tracking-tight">Reset Password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Setting a new password for <br />
            <span className="font-semibold text-foreground">{email}</span>
          </p>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">New Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                className="h-11 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Button type="submit" className="w-full h-11 font-bold" disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : 'Reset Password'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
