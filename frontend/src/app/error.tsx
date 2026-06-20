
'use client' 

import { useEffect } from 'react'
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';
 
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error(error)
  }, [error])
 
  return (
    <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center bg-background px-4 py-12">
            <div className="text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                    <AlertTriangle className="h-10 w-10 text-destructive" />
                </div>
                <h1 className="mb-4 font-headline text-4xl font-bold text-destructive md:text-5xl">
                    Oops! Something went wrong.
                </h1>
                <p className="mx-auto max-w-lg text-lg text-muted-foreground">
                    We encountered an unexpected issue. Please try again, or if the problem persists, return to the homepage.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-4">
                    <Button
                        size="lg"
                        onClick={() => reset()}
                        className="rounded-lg"
                    >
                        <RefreshCw className="mr-2" /> Try Again
                    </Button>
                     <Button size="lg" variant="outline" className="rounded-lg" asChild>
                        <Link href="/">
                            <Home className="mr-2" /> Go to Homepage
                        </Link>
                    </Button>
                </div>
                 {process.env.NODE_ENV === 'development' && (
                    <div className="mt-8 text-left">
                        <h2 className="font-bold">Error Details:</h2>
                        <pre className="mt-2 rounded bg-muted p-4 text-xs">
                            <code>{error.message}</code>
                        </pre>
                    </div>
                )}
            </div>
        </main>
        <Footer />
    </div>
  )
}
