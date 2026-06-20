'use client';

import { useEffect, useState } from 'react';
import type { User as AppUser } from '@/lib/db';
import { useUser, useFirestore } from '@/firebase';
import { buildDefaultUserProfile } from '@/lib/user-data';
import { doc, onSnapshot } from 'firebase/firestore';
import { bootstrapUserProfile } from '@/app/actions/user';

export function useStudentProfile() {
  const { user, isLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // On first mount, ensure the Firestore profile exists via a server action.
  // The server action creates the profile using Admin SDK and fires the welcome
  // email entirely server-side (no client-side secret exposure, no bypass risk).
  useEffect(() => {
    if (isAuthLoading || !user) return;
    void (async () => {
      try {
        const idToken = await user.getIdToken();
        await bootstrapUserProfile(idToken);
      } catch {
        // Failure is non-fatal — the real-time subscription below keeps the UI working
      }
    })();
  }, [user, isAuthLoading]);

  // Real-time subscription so server-side enrollment updates (Paystack webhook) reflect immediately
  useEffect(() => {
    if (isAuthLoading) return;

    if (!user || !firestore) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);
    const userRef = doc(firestore, 'users', user.uid);

    const unsubscribe = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as AppUser);
        } else {
          // Document not yet created – use a local default while the bootstrap runs
          setProfile(buildDefaultUserProfile({
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
          }));
        }
        setIsProfileLoading(false);
      },
      (error) => {
        console.error('[StudentProfile] Firestore subscription error:', error);
        setIsProfileLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, isAuthLoading, firestore]);

  return { user, profile, isLoading: isAuthLoading || isProfileLoading };
}
