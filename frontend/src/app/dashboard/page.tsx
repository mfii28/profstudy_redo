'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { db as firestore } from '@/firebase/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { type User as AppUser } from '@/lib/db';

export default function DashboardRedirectPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();

  useEffect(() => {
    const identifyAndRedirect = async () => {
      if (!isLoading) {
        if (!user || !firestore) {
          router.replace('/login');
          return;
        }

        try {
          // Fetch the user's role and onboarding status from Firestore
          const userDoc = await getDoc(doc(firestore, 'users', user.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as AppUser;
            const role = profile.role;

            if (role === 'admin' || role === 'superadmin' || role === 'subadmin') {
              router.replace('/admin');
            } else if (role === 'tutor') {
              router.replace('/tutor-dashboard');
            } else {
              router.replace('/student-dashboard');
            }
          } else {
            // Profile missing, default to student view or landing
            router.replace('/student-dashboard');
          }
        } catch (error) {
          console.error("Dashboard identification error:", error);
          router.replace('/student-dashboard');
        }
      }
    };

    void identifyAndRedirect();
  }, [user?.uid, isLoading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground font-medium">Identifying your dashboard...</p>
      </div>
    </div>
  );
}
