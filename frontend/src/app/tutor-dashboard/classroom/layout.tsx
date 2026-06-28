'use client';

import React from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

export default function ClassroomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user: currentUser, isLoading } = useUser();
  const [mounted, setMounted] = React.useState(false);
  const [tutorProfile, setTutorProfile] = React.useState<Record<string, unknown> | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(true);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);

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

    let cancelled = false;

    const verifyCourseAuthor = async () => {
      setVerifyError(null);
      try {
        const res = await apiFetch('/users/profile');
        if (cancelled) return;

        if (!res.ok) {
          router.replace('/login');
          return;
        }

        const data = await res.json();
        const userData = data.user;

        if (userData?.role !== 'tutor') {
          router.replace('/student-dashboard');
          return;
        }

        setTutorProfile(userData);
        setIsVerifying(false);
      } catch {
        if (!cancelled) {
          setVerifyError("We couldn't verify your instructor access. Please retry.");
          setIsVerifying(false);
        }
      }
    };

    void verifyCourseAuthor();

    return () => {
      cancelled = true;
    };
  }, [mounted, isLoading, currentUser, router]);

  if (!mounted || isLoading || isVerifying) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (verifyError && !tutorProfile) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background p-6">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Classroom access unavailable</AlertTitle>
          <AlertDescription>{verifyError}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!currentUser || !tutorProfile) return null;

  return (
    <div className="h-screen w-full bg-background">
      {children}
    </div>
  );
}
