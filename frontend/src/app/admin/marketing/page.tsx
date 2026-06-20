'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminMarketingRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/admin/marketing/announcements');
  }, [router]);

  return null;
}
