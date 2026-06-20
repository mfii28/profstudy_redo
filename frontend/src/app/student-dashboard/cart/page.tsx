'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CartPanelContent } from '@/components/cart/cart-panel-content';
import { Loader2 } from 'lucide-react';

const ADMIN_ROLES = ['admin', 'superadmin', 'subadmin'] as const;

export default function CartPage() {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isChecking, setIsChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user || !firestore) {
      setIsChecking(false);
      setIsAllowed(true);
      return;
    }
    getDoc(doc(firestore, 'users', user.uid))
      .then((snap) => {
        const role = snap.data()?.role as string | undefined;
        if (role && (ADMIN_ROLES as readonly string[]).includes(role)) {
          router.replace('/admin');
        } else {
          setIsAllowed(true);
        }
      })
      .catch(() => setIsAllowed(true))
      .finally(() => setIsChecking(false));
  }, [user, firestore, isUserLoading, router]);

  if (isChecking || isUserLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAllowed) return null;

  return <CartPanelContent mode="page" />;
}
