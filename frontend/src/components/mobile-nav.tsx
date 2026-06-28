'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, LayoutDashboard } from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from './ui/button';
import { Logo } from './logo';
import { useUser } from '@/firebase';
import { apiFetch } from '@/lib/api-client';

type NavLink = {
  href: string;
  label: string;
};

const defaultNavLinks: NavLink[] = [
  { href: '/courses', label: 'Courses' },
  { href: '/shop', label: 'Shop' },
  { href: '/testimonials', label: 'Testimonials' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/teach', label: 'Instructor' },
  { href: '/about', label: 'About Us' },
];

export function MobileNav({ navLinks = defaultNavLinks }: { navLinks?: NavLink[] }) {
  const [open, setOpen] = React.useState(false);
  const { user, isLoading } = useUser();
  const [role, setRole] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      apiFetch('/users/profile').then(res => res.ok ? res.json() : null).then(data => {
        if (data?.user) setRole(data.user.role ?? 'student');
      }).catch(() => {});
    }
  }, [user]);

  const getDashboardLink = () => {
    if (role === 'admin' || role === 'superadmin' || role === 'subadmin') return '/admin';
    if (role === 'tutor') return '/tutor-dashboard';
    return '/student-dashboard';
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden h-10 w-10">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] sm:w-[320px]">
        <SheetHeader className="mb-6">
          <Logo textClassName="text-xl" />
        </SheetHeader>
        <div className="flex flex-col gap-2">
          <nav aria-label="Mobile navigation" className="flex flex-col gap-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex items-center min-h-[44px] px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent/10 hover:text-accent transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
          <hr className="my-2" />
          <div className="flex flex-col gap-3">
            {!isLoading && user ? (
              <Button className="w-full gap-2 h-12" onClick={() => setOpen(false)} asChild>
                <Link href={getDashboardLink()}>
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            ) : !isLoading ? (
              <>
                <Button variant="outline" className="h-12" asChild>
                  <Link href="/login" onClick={() => setOpen(false)}>Login</Link>
                </Button>
                <Button className="h-12" asChild>
                  <Link href="/signup" onClick={() => setOpen(false)}>Sign Up</Link>
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}