'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

export default function StudentDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Student Dashboard Error]', error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="mb-2 font-headline text-2xl font-bold">Dashboard Error</h2>
        <p className="mb-6 text-muted-foreground">
          Something went wrong loading this page. Your data is safe — try refreshing.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} variant="default" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Try Again
          </Button>
          <Button variant="outline" className="gap-2" asChild>
            <Link href="/student-dashboard">
              <LayoutDashboard className="h-4 w-4" /> Back to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
