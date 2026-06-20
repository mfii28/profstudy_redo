import Link from 'next/link';
import { Button } from './ui/button';
import { ArrowRight } from 'lucide-react';

export function BecomeATutorBanner() {
  return (
    <section className="bg-background section-pad">
        <div className="page-container">
            <div className="rounded-xl bg-primary p-8 text-center text-primary-foreground shadow-lg md:p-12 lg:p-14">
                 <h2 className="font-headline text-3xl font-bold md:text-4xl">
                    Scale Your Impact.
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-lg text-primary-foreground/80">
                    Join professional chartered accountants teaching on Profs Training Solutions and share your expertise with thousands of learners across the globe.
                </p>
                <div className="mt-8">
                     <Button size="lg" className="rounded-lg bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                        <Link href="/teach">
                            Apply as Instructor
                            <ArrowRight className="ml-2" />
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    </section>
  );
}
