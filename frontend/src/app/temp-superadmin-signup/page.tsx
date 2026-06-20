'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createTempSuperadminAccount, isTempSuperadminSignupEnabled } from '@/app/actions/superadmin-temp-signup';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';

export default function TempSuperadminSignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const isEnabled = await isTempSuperadminSignupEnabled();
      setEnabled(isEnabled);
    })();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await createTempSuperadminAccount({ name, email, password, setupKey });
      if (result.error) {
        toast({ variant: 'destructive', title: 'Signup failed', description: result.error });
        return;
      }
      toast({ title: 'Superadmin created', description: 'You can now sign in from admin login.' });
      router.push('/admin/login');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (enabled === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Temporary Signup Disabled</CardTitle>
            <CardDescription>This endpoint has been disabled by a superadmin.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/login">Go to Admin Login</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <Logo />
          <CardTitle>Temporary Superadmin Signup</CardTitle>
          <CardDescription>
            Emergency/bootstrap path. Disable this from the Super Admin dashboard after use.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setupKey">Setup key</Label>
              <Input id="setupKey" type="password" value={setupKey} onChange={(e) => setSetupKey(e.target.value)} required />
            </div>
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create Superadmin
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
