'use client';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { useEffect, useState } from 'react';
import { getLegalDocuments, type LegalDocument } from '@/lib/legal-data';
import { Skeleton } from '@/components/ui/skeleton';
import { sanitizeHtml } from '@/lib/sanitize';

function LegalPageSkeleton() {
  return (
    <div className="page-container-narrow section-pad">
      <Skeleton className="h-10 w-1/2 mb-3" />
      <Skeleton className="h-4 w-1/4 mb-12" />
      <div className="space-y-5">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-6 w-1/3 mt-4" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}

export default function RefundPolicyPage() {
  const [doc, setDoc] = useState<LegalDocument | null>(null);

  useEffect(() => {
    getLegalDocuments().then(documents => setDoc(documents.refund));
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {doc ? (
          <>
            <section className="bg-primary text-primary-foreground">
              <div className="page-container-narrow section-pad">
                <p className="section-label">Legal</p>
                <h1 className="font-headline font-black text-[clamp(2rem,4vw,3rem)] leading-tight">{doc.title}</h1>
                <p className="mt-3 text-sm text-primary-foreground/50">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            </section>
            <div className="page-container-narrow section-pad">
              <div
                className="prose prose-neutral max-w-none prose-headings:font-headline prose-headings:font-bold prose-a:text-accent"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(doc.content) }}
              />
            </div>
          </>
        ) : (
          <LegalPageSkeleton />
        )}
      </main>
      <Footer />
    </div>
  );
}
