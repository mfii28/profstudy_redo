'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LogOut,
  Settings,
  Loader2,
} from 'lucide-react';

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
import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { getPresignedDownloadUrl } from '@/app/actions/storage';
import { useStudentProfile } from '@/hooks/use-student-profile';
import { getNotifications, markAsRead, subscribeToNotifications } from '@/lib/notifications-data';
import { getAnnouncements, subscribeToAnnouncements } from '@/lib/marketing-data';
import { ANNOUNCEMENTS_SEEN_EVENT, getLastSeenAnnouncementAt, hasUnreadAnnouncements } from '@/lib/announcement-status';
import type { Notification } from '@/lib/db';

export default function StudentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isLearnPage = pathname.startsWith('/student-dashboard/learn');
  const isClassroomRoom = pathname.startsWith('/student-dashboard/classroom/');
  const { logout } = useUser();
  const { user: currentUser, profile: userProfile, isLoading } = useStudentProfile();
  const [mounted, setMounted] = React.useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = React.useState(0);
  const [recentNotifications, setRecentNotifications] = React.useState<Notification[]>([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = React.useState(true);
  const [isVerifying, setIsVerifying] = React.useState(true);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = React.useState<string | undefined>(undefined);
  const [hasNewAnnouncements, setHasNewAnnouncements] = React.useState(false);

  const enrolledCourseIds = React.useMemo(
    () => new Set((userProfile?.enrollments || []).map((enrollment) => enrollment.courseId)),
    [userProfile?.enrollments]
  );

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const handleMarkAsRead = React.useCallback(async (id: string) => {
    await markAsRead(id);
    setRecentNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  React.useEffect(() => {
    if (!mounted || isLoading) return;

    if (!currentUser) {
      router.replace('/login');
      setIsVerifying(false);
      return;
    }

    const isPreviewLearnPage =
      pathname.startsWith('/student-dashboard/learn') &&
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('preview') === '1';

    if (userProfile?.role === 'tutor' && !isPreviewLearnPage) {
      router.replace('/tutor-dashboard');
      return;
    }

    if ((userProfile?.role === 'admin' || userProfile?.role === 'subadmin' || userProfile?.role === 'superadmin') && !isPreviewLearnPage) {
      router.replace('/admin');
      return;
    }

    setIsVerifying(false);
  }, [mounted, isLoading, currentUser, userProfile, pathname, router]);

  React.useEffect(() => {
    const resolveAvatar = async () => {
      if (!currentUser) {
        setResolvedAvatarUrl(undefined);
        return;
      }

      const avatar = userProfile?.avatar || '';
      if (!avatar) {
        setResolvedAvatarUrl(undefined);
        return;
      }

      if (avatar.startsWith('http')) {
        setResolvedAvatarUrl(avatar);
        return;
      }

      const { url } = await getPresignedDownloadUrl(avatar, currentUser.uid);
      setResolvedAvatarUrl(url || undefined);
    };

    if (mounted) {
      void resolveAvatar();
    }
  }, [mounted, currentUser, userProfile]);

  React.useEffect(() => {
    if (!currentUser || !mounted) return;

    let cancelled = false;

    const syncAnnouncementStatus = async () => {
      try {
        const announcements = await getAnnouncements();
        const visibleAnnouncements = announcements.filter((announcement) => {
          if (!announcement.courseId) return true;
          return enrolledCourseIds.has(announcement.courseId);
        });

        if (!cancelled) {
          setHasNewAnnouncements(
            hasUnreadAnnouncements(visibleAnnouncements, getLastSeenAnnouncementAt(currentUser.uid))
          );
        }
      } catch {
        if (!cancelled) {
          setHasNewAnnouncements(false);
        }
      }
    };

    const handleSeenUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ userId?: string }>;
      if (customEvent.detail?.userId === currentUser.uid) {
        setHasNewAnnouncements(false);
      }
    };

    void syncAnnouncementStatus();

    const unsubscribe = subscribeToAnnouncements(
      (announcements) => {
        if (cancelled) return;
        const visibleAnnouncements = announcements.filter((announcement) => {
          if (!announcement.courseId) return true;
          return enrolledCourseIds.has(announcement.courseId);
        });

        setHasNewAnnouncements(
          hasUnreadAnnouncements(visibleAnnouncements, getLastSeenAnnouncementAt(currentUser.uid))
        );
      },
      undefined,
      () => {
        if (!cancelled) {
          setHasNewAnnouncements(false);
        }
      }
    );

    window.addEventListener(ANNOUNCEMENTS_SEEN_EVENT, handleSeenUpdate as EventListener);

    return () => {
      cancelled = true;
      window.removeEventListener(ANNOUNCEMENTS_SEEN_EVENT, handleSeenUpdate as EventListener);
      unsubscribe();
    };
  }, [currentUser, enrolledCourseIds, mounted]);

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

  if (!currentUser) return null;

  const displayProfile = userProfile || {
      name: currentUser.displayName || 'Learner'
  };

  const userName = displayProfile.name;
  const userInitials = userName.split(' ').map((n: string) => n[0]).join('') || 'U';

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-background text-foreground">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <Link href="/student-dashboard">
              <Logo />
            </Link>
          </SidebarHeader>
          
          <SidebarContent className="p-2">
            <DashboardNav hasNewAnnouncements={hasNewAnnouncements} />
          </SidebarContent>

          <SidebarFooter className="gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 p-2 h-auto group-data-[collapsible=icon]:justify-center">
                   <Avatar className="h-10 w-10 border shadow-sm">
                        <AvatarImage src={resolvedAvatarUrl} alt={userName} />
                        <AvatarFallback>{userInitials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left group-data-[collapsible=icon]:hidden">
                        <p className="font-semibold text-sm truncate text-foreground">{userName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">Student Account</p>
                    </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mb-2">
                <DropdownMenuLabel className="text-foreground">{userName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="text-foreground">
                  <Link href="/student-dashboard/settings/profile">
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
        <SidebarInset className="flex flex-col bg-slate-50 dark:bg-background">
          <header className="sticky top-0 z-10 flex h-14 sm:h-16 md:h-20 shrink-0 items-center justify-between gap-2 sm:gap-4 border-b bg-card px-3 sm:px-4 md:px-6 md:justify-end">
            <SidebarTrigger className="flex md:hidden" />
            <div className="flex items-center gap-4">
                <ThemeToggle />
                <NotificationDropdown
                  currentUserId={currentUser?.uid}
                  notificationsPath="/student-dashboard/notifications"
                  recentNotifications={recentNotifications}
                  unreadCount={unreadNotifCount}
                  isLoading={isNotificationsLoading}
                  onMarkAsRead={handleMarkAsRead}
                />
                <Link href="/student-dashboard/settings/profile">
                    <Avatar className="h-10 w-10 border shadow-sm">
                        <AvatarImage src={resolvedAvatarUrl} />
                        <AvatarFallback>{userInitials}</AvatarFallback>
                    </Avatar>
                </Link>
            </div>
          </header>
          <main className={cn("flex-1 overflow-y-auto bg-slate-50 dark:bg-background", !isLearnPage && !isClassroomRoom && "p-3 sm:p-4 md:p-6")}>
              <QuotaBanner />
              {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
