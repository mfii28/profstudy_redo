'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';

export default function ClassroomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user: currentUser, isLoading } = useUser();
  const firestore = useFirestore();
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

    if (!firestore) {
      setIsVerifying(false);
      return;
    }

    const verifyAdminAccess = async () => {
      try {
        const userRef = doc(firestore, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        
        if (!['admin', 'subadmin', 'superadmin'].includes(userData?.role || '')) {
          router.replace('/student-dashboard');
          return;
        }
        
        setAdminProfile(userData);
        setIsVerifying(false);
      } catch (error) {
        console.error('Error verifying admin profile:', error);
        router.replace('/student-dashboard');
      }
    };

    void verifyAdminAccess();
  }, [mounted, isLoading, currentUser, firestore, router]);

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
