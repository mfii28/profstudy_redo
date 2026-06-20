'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Settings, Loader2, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Logo } from '@/components/logo';
import { QuotaBanner } from '@/components/feedback/quota-banner';
import { cn } from '@/lib/utils';
import { TutorDashboardNav } from '@/components/dashboard/tutor-dashboard-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getPresignedDownloadUrl } from '@/app/actions/storage';
import { getNotifications, markAsRead, subscribeToNotifications } from '@/lib/notifications-data';
import type { Notification } from '@/lib/db';

export default function TutorDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isLearnPage = pathname.startsWith('/tutor-dashboard/learn');
  const isClassroomRoom = pathname.startsWith('/tutor-dashboard/classroom/');
  const { user: currentUser, isLoading, logout } = useUser();
  const firestore = useFirestore();
  const [mounted, setMounted] = React.useState(false);
  const [tutorProfile, setTutorProfile] = React.useState<any>(null);
  const [isVerifying, setIsVerifying] = React.useState(true);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = React.useState<string | undefined>(undefined);
  const [unreadNotifCount, setUnreadNotifCount] = React.useState(0);
  const [recentNotifications, setRecentNotifications] = React.useState<Notification[]>([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = React.useState(true);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleMarkAsRead = React.useCallback(async (id: string) => {
    await markAsRead(id);
    setRecentNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const fetchTutorProfile = async () => {
      if (!isLoading && currentUser && mounted && firestore) {
        setVerifyError(null);
        try {
          const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
          if (cancelled) return;
          if (userDoc.exists()) {
            const profile = userDoc.data();
            if (profile.role === 'tutor') {
              setTutorProfile(profile);
              
              // Resolve Avatar URL
              if (profile.avatar) {
                if (profile.avatar.startsWith('http')) {
                  setResolvedAvatarUrl(profile.avatar);
                } else {
                  const { url } = await getPresignedDownloadUrl(profile.avatar, currentUser.uid);
                  if (url) setResolvedAvatarUrl(url);
                }
              } else {
                setResolvedAvatarUrl(undefined);
              }
            } else {
              router.replace('/student-dashboard');
            }
          } else {
              router.replace('/login');
          }
        } catch {
          const isOfflineError = !navigator.onLine;
          if (!isOfflineError) {
            // Non-offline verification error — redirect to login for safety
          }
        } finally {
          setIsVerifying(false);
        }
      } else if (!isLoading && !currentUser && mounted) {
        router.replace('/login');
        setIsVerifying(false);
      } else if (!isLoading && currentUser && mounted && !firestore) {
          setIsVerifying(false);
      }
    };
    fetchTutorProfile();
  }, [isLoading, currentUser, router, mounted, firestore]);

  // REAL-TIME NOTIFICATIONS
  React.useEffect(() => {
    if (!currentUser || !mounted) return;

    const unsubscribe = subscribeToNotifications(
      currentUser.uid,
      (notifications) => {
        setUnreadNotifCount(notifications.filter((notification) => !notification.read).length);
        setRecentNotifications(notifications.slice(0, 10));
        setIsNotificationsLoading(false);
      },
      () => {
        setIsNotificationsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser, mounted]);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  if (!mounted || isLoading || isVerifying) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    )
  }
  
  if (!currentUser) {
      return null;
  }

  if (verifyError && !tutorProfile) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background p-6">
        <Alert variant="destructive" className="max-w-md">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Profile verification failed</AlertTitle>
          <AlertDescription>{verifyError}</AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
          <Button variant="destructive" onClick={() => void handleLogout()}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  if (!tutorProfile) {
      return null;
  }

  const displayName = tutorProfile.name || currentUser.displayName || 'Instructor';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('') || 'T';

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-background">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <Link href="/tutor-dashboard">
              <Logo />
            </Link>
          </SidebarHeader>
          
          <SidebarContent className="p-2">
            <TutorDashboardNav />
          </SidebarContent>

          <SidebarFooter>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 p-2 h-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:h-auto">
                   <Avatar className="h-10 w-10 border group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
                        <AvatarImage src={resolvedAvatarUrl} alt={displayName} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left group-data-[collapsible=icon]:hidden">
                        <p className="font-semibold text-sm truncate">{displayName}</p>
                    </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mb-2">
                <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/tutor-dashboard/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex flex-col">
          <header className="sticky top-0 z-10 flex h-14 sm:h-16 md:h-20 shrink-0 items-center justify-between gap-2 sm:gap-4 border-b bg-card px-3 sm:px-4 md:px-6 md:justify-end">
            <SidebarTrigger className="flex md:hidden" />
            
            <div className="flex items-center gap-4">
                <ThemeToggle />
                <NotificationDropdown
                  currentUserId={currentUser?.uid}
                  notificationsPath="/tutor-dashboard/notifications"
                  recentNotifications={recentNotifications}
                  unreadCount={unreadNotifCount}
                  isLoading={isNotificationsLoading}
                  onMarkAsRead={handleMarkAsRead}
                />
                <Link href="/tutor-dashboard/settings">
                    <Button variant="ghost" size="icon">
                        <Settings className="h-5 w-5" />
                        <span className="sr-only">Settings</span>
                    </Button>
                </Link>
                  <Link href="/tutor-dashboard/settings">
                      <Avatar className="h-10 w-10 border">
                        <AvatarImage src={resolvedAvatarUrl} alt={displayName} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                </Link>
            </div>
          </header>
          <main className={cn("flex-1 overflow-y-auto", !isLearnPage && !isClassroomRoom && "p-3 sm:p-4 md:p-6")}>
              <QuotaBanner />
              {tutorProfile && tutorProfile.tutorApproved === false && (
                <Alert variant="default" className="mb-4 border-amber-500/40 bg-amber-500/10">
                  <ShieldAlert className="h-4 w-4 text-amber-700" />
                  <AlertTitle className="text-amber-950 dark:text-amber-100">Tutor account pending approval</AlertTitle>
                  <AlertDescription className="text-amber-900/90 dark:text-amber-50/90">
                    An administrator must activate your instructor access. You can still browse the tutor dashboard; some actions may be limited until approval.
                  </AlertDescription>
                </Alert>
              )}
              {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
