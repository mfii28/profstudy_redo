'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

/**
 * Listens for Firestore permission errors and surfaces them as toast notifications.
 * Does NOT throw — throwing during render crashes the entire dashboard segment.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Log for observability but never throw — that triggers the error boundary.
      console.error('[Firebase] Permission error:', error.message ?? error);
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'Some data could not be loaded. Please refresh the page.',
      });
    };

    errorEmitter.on('permission-error', handleError);
    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  return null;
}
