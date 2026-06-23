'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { getUserProfileAction } from '@/app/actions/user';

export default function ClassroomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user: currentUser, isLoading } = useUser();
  const [mounted, setMounted] = React.useState(false);
  const [adminProfile, setAdminProfile] = React.useState<any>(null);
  const [isVerifying, setIsVerifying] = React.useState(true);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted || isLoading) return;

    if (!currentUser) {
      router.replace('/login');
      setIsVerifying(false);
      return;
    }

    const verifyAdminAccess = async () => {
      try {
        const res = await getUserProfileAction();
        if (res.success && res.user) {
          const profile = res.user;
          const role = String(profile.role || '').trim().toLowerCase();
          if (['admin', 'subadmin', 'superadmin'].includes(role)) {
            setAdminProfile(profile);
            setIsVerifying(false);
            return;
          }
        }
        router.replace('/student-dashboard');
      } catch (error) {
        console.error('Error verifying admin profile:', error);
        router.replace('/student-dashboard');
      }
    };

    void verifyAdminAccess();
  }, [mounted, isLoading, currentUser, router]);

  if (!mounted || isLoading || isVerifying) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser || !adminProfile) return null;

  return (
    <div className="h-screen w-full bg-background">
      {children}
    </div>
  );
}
