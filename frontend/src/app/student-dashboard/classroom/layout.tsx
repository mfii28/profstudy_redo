'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useUser } from '@/firebase';
import { useStudentProfile } from '@/hooks/use-student-profile';
import { useRouter } from 'next/navigation';

export default function ClassroomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user: currentUser } = useUser();
  const { profile: userProfile, isLoading } = useStudentProfile();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted || isLoading) return;

    if (!currentUser) {
      router.replace('/login');
      return;
    }

    if (userProfile?.role === 'tutor') {
      router.replace('/tutor-dashboard');
      return;
    }

    if (userProfile?.role === 'admin' || userProfile?.role === 'subadmin' || userProfile?.role === 'superadmin') {
      router.replace('/admin');
      return;
    }
  }, [mounted, isLoading, currentUser, userProfile, router]);

  if (!mounted || isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="h-screen w-full bg-background">
      {children}
    </div>
  );
}
