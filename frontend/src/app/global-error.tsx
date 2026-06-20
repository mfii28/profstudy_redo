'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error Boundary]:', error);
  }, [error]);

  const handleReset = () => {
    // Hardened reset logic to prevent "reset is not a function" errors
    try {
      if (typeof reset === 'function') {
        reset();
      } else {
        window.location.reload();
      }
    } catch (e) {
      window.location.reload();
    }
  };

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center bg-background text-foreground">
          <div className="max-w-md space-y-6">
            <h1 className="text-4xl font-black font-headline tracking-tighter">Something went wrong</h1>
            <p className="text-muted-foreground leading-relaxed">
              A critical error occurred on the server. We've been notified and are looking into it.
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={handleReset} size="lg" className="font-bold">
                Try again
              </Button>
              <Button variant="outline" size="lg" onClick={() => window.location.href = '/'}>
                Back to Home
              </Button>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <pre className="mt-8 p-4 bg-muted rounded-xl text-left text-xs font-mono overflow-auto max-h-40">
                {error.message}
              </pre>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
