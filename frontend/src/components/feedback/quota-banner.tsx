'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  dismissQuotaBanner,
  getQuotaBannerState,
  subscribeQuotaState,
} from '@/lib/feedback/quota-state';

export function QuotaBanner() {
  const [state, setState] = useState(() => getQuotaBannerState());

  useEffect(() => {
    const sync = () => setState(getQuotaBannerState());
    const unsubscribe = subscribeQuotaState(sync);
    const interval = window.setInterval(sync, 5_000);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, []);

  if (!state.visible) return null;

  return (
    <Alert className="mb-4 border-amber-500/40 bg-amber-500/10">
      <AlertCircle className="h-4 w-4 text-amber-700" />
      <div className="flex flex-1 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <AlertTitle className="text-amber-950 dark:text-amber-100">Service busy</AlertTitle>
          <AlertDescription className="text-amber-900/90 dark:text-amber-50/90">
            {state.message}
          </AlertDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => {
            dismissQuotaBanner();
            setState(getQuotaBannerState());
          }}
          aria-label="Dismiss quota notice"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Alert>
  );
}
