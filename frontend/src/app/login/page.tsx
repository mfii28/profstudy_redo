'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase-client';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { getRoleDashboardPath } from '@/lib/auth-verification';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Login Failed',
          description: error.message || 'Invalid email or password.',
        });
        setIsLoading(false);
        return;
      }

      const user = data.user;
      if (!user) throw new Error('No user data returned.');

      const role = user.user_metadata?.role || 'student';

      // Set cookie for compatibility
      const secure = window.location.protocol === 'https:' ? 'Secure;' : '';
      const emailVerified = !!user.email_confirmed_at;
      const mockSessionToken = btoa(JSON.stringify({ uid: user.id, role, emailVerified }));
      document.cookie = `__session=${mockSessionToken}; path=/; max-age=3600; SameSite=Lax; ${secure}`;

      toast({
        title: 'Login Successful',
        description: 'Redirecting to your dashboard...',
      });
      router.replace(getRoleDashboardPath(role));
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message || 'An unexpected error occurred.',
      });
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Google Login Failed', description: error.message });
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please enter your email address.',
      });
      return;
    }
    setIsResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.toLowerCase().trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: 'Success',
        description: 'Password reset link has been sent to your email.',
      });
      setIsResetDialogOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Could not send reset email. Please try again.',
      });
    } finally {
      setIsResetting(false);
      setResetEmail('');
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary flex-col justify-between p-12 relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent/10 rounded-full translate-x-1/2 translate-y-1/2" />
        </div>
        <Link href="/">
          <Logo textClassName="text-primary-foreground" />
        </Link>
        <div className="relative">
          <div className="flex items-center gap-3 mb-6">
            <span className="h-px w-8 bg-accent" aria-hidden />
            <span className="section-label !mb-0">Welcome back</span>
          </div>
          <h2 className="font-headline font-black text-[clamp(2rem,3.5vw,3rem)] text-primary-foreground leading-tight">
            Continue your<br />journey to<br />qualification.
          </h2>
          <p className="mt-5 text-primary-foreground/60 text-base leading-relaxed max-w-xs">
            Thousands of ICAG and CITG students trust Profs Training Solutions to reach their goals.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/30 relative">
          © {new Date().getFullYear()} Profs Training Solutions
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        {/* Mobile logo */}
        <Link href="/" className="mb-8 lg:hidden">
          <Logo />
        </Link>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="font-headline font-black text-2xl text-primary tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter your credentials to access your account.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Password</Label>
                <Link
                  href="#"
                  onClick={(e) => { e.preventDefault(); setIsResetDialogOpen(true); }}
                  className="text-xs text-accent font-semibold hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
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
              {isLoading ? <Loader2 className="animate-spin h-4 w-4" /> : 'Sign In'}
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full h-11 font-semibold gap-2"
              onClick={handleGoogleLogin}
              type="button"
              disabled={isLoading}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            No account yet?{' '}
            <Link href="/signup" className="text-primary font-bold hover:underline">
              Create one
            </Link>
            <span className="mx-2 text-border">·</span>
            <Link href="/signup?tutor=1" className="text-primary font-bold hover:underline">
              Tutor signup
            </Link>
          </p>
        </div>
      </div>

      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we&apos;ll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="you@example.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)}>Cancel</Button>
            <Button onClick={handlePasswordReset} disabled={isResetting}>
              {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Reset Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function tokenPlaceholder(session: any) {
  // Signs a mock payload using a simplified scheme for client compatibility
  if (!session?.user) return '';
  const payload = { uid: session.user.id, role: session.user.role };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}
