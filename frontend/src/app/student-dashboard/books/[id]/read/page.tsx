'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { use } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudentProfile } from '@/hooks/use-student-profile';
import { getBookById } from '@/lib/book-data';
import { createBookReaderSession } from '@/app/actions/books';
import { PdfViewer } from '@/components/pdf-viewer';
import { ArrowLeft, BookOpen, Lock } from 'lucide-react';
import { ProtectedMediaShell } from '@/components/protected-media-shell';

interface ReadPageProps {
  params: Promise<{ id: string }>;
}

export default function ReadBookPage({ params }: ReadPageProps) {
  const { id: bookId } = use(params);
  const { user: currentUser, isLoading: isUserLoading } = useStudentProfile();

  const [bookTitle, setBookTitle] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (isUserLoading) return;
    const load = async () => {
      if (!currentUser) {
        setAccessDenied(true);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const [book, sessionResult] = await Promise.all([
          getBookById(bookId),
          (async () => {
            const idToken = await currentUser.getIdToken(true);
            return createBookReaderSession(bookId, idToken);
          })(),
        ]);

        if (book) {
          setBookTitle(book.title);
          if (book.type !== 'digital') {
            setAccessDenied(true);
            return;
          }
        }

        if (sessionResult.error || !sessionResult.token) {
          setAccessDenied(true);
        } else {
          setPdfUrl(`/api/books/read?token=${encodeURIComponent(sessionResult.token)}`);
        }
      } catch {
        setAccessDenied(true);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [bookId, currentUser, isUserLoading]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between shrink-0">
        <Button variant="ghost" size="sm" className="-ml-1" asChild>
          <Link href={`/student-dashboard/books/${bookId}`}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Link>
        </Button>
        {bookTitle && <h1 className="text-sm font-semibold truncate max-w-xs">{bookTitle}</h1>}
        <p className="text-xs text-muted-foreground">Secure online reader</p>
      </div>

      {/* Content */}
      {isLoading ? (
        <Skeleton className="flex-1 rounded-lg" />
      ) : accessDenied ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 border rounded-lg bg-muted/30">
          <Lock className="h-12 w-12 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">Access Required</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {currentUser
                ? 'Purchase this book to read it online.'
                : 'Sign in and purchase this book to read it online.'}
            </p>
          </div>
          <Button asChild>
            <Link href={`/student-dashboard/books/${bookId}`}>
              <BookOpen className="h-4 w-4 mr-2" />
              View Book
            </Link>
          </Button>
        </div>
      ) : pdfUrl ? (
        <div className="flex-1 rounded-lg border overflow-hidden">
          <ProtectedMediaShell watermarkText={`PROTECTED BOOK • ${currentUser?.uid || 'USER'}`}>
            <PdfViewer path={pdfUrl} watermarkText={`BOOK SESSION • ${currentUser?.uid || 'USER'}`} />
          </ProtectedMediaShell>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 border rounded-lg bg-muted/30">
          <BookOpen className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">Unable to load the book. Please try again.</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      )}
    </div>
  );
}
