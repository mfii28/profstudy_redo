'use client';

import { Logo } from '@/components/logo';
import Link from 'next/link';

export default function PaymentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-background">
      {/* Minimal Header */}
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="page-container py-4">
          <Link href="/">
            <Logo className="h-8" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-card text-muted-foreground text-sm">
        <div className="page-container py-6">
          <p className="text-center">
            🔒 Secure payment processing
          </p>
        </div>
      </footer>
    </div>
  );
}
