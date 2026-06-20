
import Link from 'next/link'
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { FileSearch, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center bg-background px-4 py-12">
            <div className="text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
                    <FileSearch className="h-10 w-10 text-accent" />
                </div>
                <h1 className="mb-4 font-headline text-4xl font-bold md:text-5xl">
                    404 - Page Not Found
                </h1>
                <p className="mx-auto max-w-lg text-lg text-muted-foreground">
                    Sorry, the page you are looking for doesn't exist or has been moved. Let's get you back on track.
                </p>
                <div className="mt-8">
                    <Button size="lg" className="rounded-lg" asChild>
                        <Link href="/">
                            <Home className="mr-2" /> Go to Homepage
                        </Link>
                    </Button>
                </div>
            </div>
        </main>
        <Footer />
    </div>
  )
}
