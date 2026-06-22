'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Loader2 } from 'lucide-react';

export default function DashboardRedirectPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/login');
        return;
      }

      const role = user.role || 'student';
      if (role === 'admin' || role === 'superadmin' || role === 'subadmin') {
        router.replace('/admin');
      } else if (role === 'tutor') {
        router.replace('/tutor-dashboard');
      } else {
        router.replace('/student-dashboard');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground font-medium">Redirecting you to your dashboard...</p>
      </div>
    </div>
  );
}
