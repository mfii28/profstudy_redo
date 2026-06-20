'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ThemeSettingsRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/admin/settings/general');
  }, [router]);

  return null;
}
