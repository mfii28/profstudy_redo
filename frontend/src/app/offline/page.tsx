import Link from 'next/link';
import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <WifiOff className="h-8 w-8 text-muted-foreground" aria-hidden />
      </div>
      <div className="max-w-md space-y-2">
        <h1 className="font-headline text-2xl font-bold">You are offline</h1>
        <p className="text-sm text-muted-foreground">
          This page is not available without a connection. Reconnect to continue learning, or open
          a page you visited recently while online.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/student-dashboard">Student dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
