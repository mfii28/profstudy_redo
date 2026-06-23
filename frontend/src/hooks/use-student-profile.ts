'use client';

import { useEffect, useState } from 'react';
import type { User as AppUser } from '@/lib/db';
import { useUser } from '@/firebase';
import { buildDefaultUserProfile } from '@/lib/user-data';
import { getUserProfileAction, bootstrapUserProfile } from '@/app/actions/user';

export function useStudentProfile() {
  const { user, isLoading: isAuthLoading } = useUser();
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      setProfile(null);
      setIsProfileLoading(false);
      return;
    }

    let active = true;

    const loadProfile = async () => {
      setIsProfileLoading(true);
      try {
        // Ensure profile exists
        try {
          const idToken = await user.getIdToken();
          await bootstrapUserProfile(idToken);
        } catch (bootstrapErr) {
          console.warn('[StudentProfile] Bootstrap failed:', bootstrapErr);
        }

        const res = await getUserProfileAction();
        if (!active) return;

        if (res.success && res.user) {
          setProfile({
            ...res.user,
            uid: res.user.id,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            wishlistCourseIds: [],
          } as unknown as AppUser);
        } else {
          // Use default fallback if not found in db yet
          setProfile(buildDefaultUserProfile({
            uid: user.uid,
            displayName: user.displayName || null,
            email: user.email || null,
            photoURL: user.photoURL || null,
          }));
        }
      } catch (err) {
        console.error('[StudentProfile] Failed to load profile:', err);
      } finally {
        if (active) {
          setIsProfileLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [user, isAuthLoading]);

  return { user, profile, isLoading: isAuthLoading || isProfileLoading };
}
