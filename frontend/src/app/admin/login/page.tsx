'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import { useAuth, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { type User } from '@/lib/db';

export default function AdminLoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!auth || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Configuration Error',
        description: 'Firebase authentication is not yet initialized. Please try again in a moment.',
      });
      return;
    }
    
    setIsLoading(true);

    let currentFirebaseUser: any = null;

    try {
        const userCredential = await signInWithEmailAndPassword(auth!, email, password);
        currentFirebaseUser = userCredential.user;

        // Fetch user profile by UID
        const userRef = doc(firestore!, 'users', currentFirebaseUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const appUser = userSnap.data() as User;
          
          if (['admin', 'superadmin', 'subadmin'].includes(appUser.role)) {
            toast({
              title: 'Login Successful',
              description: 'Redirecting to your dashboard...',
            });
            router.replace('/admin');
          } else {
            await auth!.signOut(); 
            toast({
                variant: 'destructive',
                title: 'Access Denied',
                description: 'You do not have administrative privileges.',
            });
            setIsLoading(false);
          }
        } else {
          await auth!.signOut();
          toast({
              variant: 'destructive',
              title: 'Profile Error',
              description: 'Your administrator profile could not be found.',
          });
          setIsLoading(false);
        }

    } catch (error: any) {
        if (error.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: `users/${currentFirebaseUser?.uid || 'unknown'}`,
                operation: 'get',
            });
            errorEmitter.emit('permission-error', permissionError);
            setIsLoading(false);
            return;
        }

        let description = 'Invalid email or password.';
        if (error.code === 'auth/too-many-requests') {
            description = 'Too many failed attempts. Please wait a few minutes before trying again.';
        }
         toast({
            variant: 'destructive',
            title: 'Login Failed',
            description,
        });
        setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <Card>
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="font-headline text-2xl">Administrator Login</CardTitle>
            <CardDescription>
              Enter your credentials to access the admin dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
              <div className="grid gap-2">
                 <Label htmlFor="password">Password</Label>
                 <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                 </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Login'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
