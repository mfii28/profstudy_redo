'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background">
      {/* Clean Header */}
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="page-container flex items-center gap-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Shopping Cart</h1>
        </div>
      </header>

      {/* Main Content - Full Width */}
      <main className="page-container py-8 md:py-12">
        {children}
      </main>
    </div>
  );
}
