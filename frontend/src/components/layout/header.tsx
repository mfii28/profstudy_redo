'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { MobileNav } from '@/components/mobile-nav';
import { ThemeToggle } from '../theme-toggle';
import { ShoppingCart, LayoutDashboard } from 'lucide-react';
import { useCart } from '@/lib/cart-context';
import { Badge } from '../ui/badge';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getPresignedDownloadUrl } from '@/app/actions/storage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const navLinks = [
  { href: '/courses', label: 'Courses' },
  { href: '/shop', label: 'Shop' },
  { href: '/testimonials', label: 'Testimonials' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/teach', label: 'Instructor' },
  { href: '/about', label: 'About' },
];

export function Header() {
  const pathname = usePathname();
  const { cartCount, openCart } = useCart();
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const [mounted, setMounted] = React.useState(false);
  const [profile, setProfile] = React.useState<any>(null);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (user && firestore && mounted) {
      const fetchProfile = async () => {
        try {
          const snap = await getDoc(doc(firestore, 'users', user.uid));
          if (snap.exists()) {
            const data = snap.data();
            setProfile(data);
            
            // Resolve Avatar URL
            if (data.avatar) {
              if (data.avatar.startsWith('http')) {
                setResolvedAvatarUrl(data.avatar);
              } else {
                const { url } = await getPresignedDownloadUrl(data.avatar, user.uid);
                if (url) setResolvedAvatarUrl(url);
              }
            } else {
              setResolvedAvatarUrl(undefined);
            }
          }
        } catch (e) {
          console.error("Header profile fetch error:", e);
        }
      };
      fetchProfile();
    }
  }, [user, firestore, mounted]);

  const getDashboardLink = () => {
    if (!profile) return '/student-dashboard';
    const role = profile.role;
    if (role === 'admin' || role === 'superadmin' || role === 'subadmin') return '/admin';
    if (role === 'tutor') return '/tutor-dashboard';
    return '/student-dashboard';
  };

  const isAdminRole =
    profile?.role === 'admin' ||
    profile?.role === 'superadmin' ||
    profile?.role === 'subadmin';

  // SSR SAFETY: Skip rendering if we are in a dashboard sub-route or during initial server load
  if (!mounted || pathname.startsWith('/student-dashboard') || pathname.startsWith('/tutor-dashboard') || pathname.startsWith('/admin')) {
    return null; 
  }

  const userName = profile?.name || user?.displayName || 'Learner';
  const initials = userName.split(' ').map((n: any) => n[0]).join('') || 'L';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="page-container flex h-16 items-center justify-between">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-6 md:flex">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn("text-sm font-medium transition-colors hover:text-primary", {
                "text-primary": pathname === href,
                "text-muted-foreground": pathname !== href,
              })}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {!isAdminRole && (
              <Button variant="ghost" size="icon" className="relative" onClick={openCart}>
                <ShoppingCart className="h-5 w-5" />
                {cartCount > 0 && (
                  <Badge variant="destructive" className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs">
                    {cartCount}
                  </Badge>
                )}
                <span className="sr-only">Shopping Cart</span>
              </Button>
            )}
            
            <div className="hidden md:flex items-center gap-4 ml-2">
                {!isUserLoading && user ? (
                <div className="flex items-center gap-3">
                    <Button variant="default" className="gap-2 h-9" asChild>
                        <Link href={getDashboardLink()}>
                        <LayoutDashboard className="h-4 w-4" />
                        Dashboard
                        </Link>
                    </Button>
                    <Link href="/student-dashboard/settings/profile" aria-label="View profile">
                        <Avatar className="h-9 w-9 border shadow-sm hover:opacity-80 transition-opacity">
                            <AvatarImage src={resolvedAvatarUrl} />
                            <AvatarFallback className="text-[10px] font-bold">{initials}</AvatarFallback>
                        </Avatar>
                    </Link>
                </div>
                ) : !isUserLoading ? (
                <>
                    <Button variant="ghost" asChild>
                    <Link href="/login">Login</Link>
                    </Button>
                    <Button asChild>
                    <Link href="/signup">Sign Up</Link>
                    </Button>
                </>
                ) : (
                <div className="w-20 h-9 bg-muted animate-pulse rounded-md" />
                )}
            </div>
            <MobileNav navLinks={navLinks} />
          </div>
        </div>
      </div>
    </header>
  );
}
