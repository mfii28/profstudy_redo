'use client';

import { useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

export function PwaNetworkStatus() {
  const { toast } = useToast();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const notifyOffline = () => {
      wasOffline.current = true;
      toast({
        title: 'You are offline',
        description: 'Some features need a connection. Cached pages may still be available.',
      });
    };

    const notifyOnline = () => {
      if (!wasOffline.current) return;
      wasOffline.current = false;
      toast({
        title: 'Back online',
        description: 'Your connection was restored.',
      });
    };

    if (!navigator.onLine) {
      wasOffline.current = true;
    }

    window.addEventListener('offline', notifyOffline);
    window.addEventListener('online', notifyOnline);
    return () => {
      window.removeEventListener('offline', notifyOffline);
      window.removeEventListener('online', notifyOnline);
    };
  }, [toast]);

  return null;
}
