'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LogOut,
  Settings,
  Loader2,
  Camera,
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
import { cn } from '@/lib/utils';
import { AdminDashboardNav } from '@/components/dashboard/admin-dashboard-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationDropdown } from '@/components/notification-dropdown';
import { useUser } from '@/firebase';
import { getPresignedDownloadUrl, getPresignedUploadUrl } from '@/app/actions/storage';
import { markAsRead, subscribeToNotifications } from '@/lib/notifications-data';
import { syncAdminSessionClaims, getUserProfileAction, updateUserProfileAction } from '@/app/actions/user';
import { useToast } from '@/hooks/use-toast';
import type { Notification } from '@/lib/db';

const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user: currentUser, isLoading, logout } = useUser();
  const { toast } = useToast();
  const [mounted, setMounted] = React.useState(false);
  const [adminProfile, setAdminProfile] = React.useState<any>(null);
  const [isVerifying, setIsVerifying] = React.useState(true);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = React.useState<string | undefined>(undefined);
  const [unreadNotifCount, setUnreadNotifCount] = React.useState(0);
  const [recentNotifications, setRecentNotifications] = React.useState<Notification[]>([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = React.useState(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = React.useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const checkAdminStatus = async () => {
      if (!isLoading && mounted && currentUser) {
        if (pathname === '/admin/login') {
            setIsVerifying(false);
            return;
        }

        try {
          const res = await getUserProfileAction();
          if (res.success && res.user) {
            const profile = res.user;
            const role = String(profile.role || '').trim().toLowerCase();
            if (role === 'admin' || role === 'superadmin' || role === 'subadmin') {
              setAdminProfile(profile);

              try {
                const idToken = await currentUser.getIdToken();
                await syncAdminSessionClaims(idToken);
                await currentUser.getIdToken(true);
              } catch (syncError) {
                console.warn('[Admin] Failed to sync role claims:', syncError);
              }

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
        } catch (err) {
          const isOfflineError = !navigator.onLine;
          if (!isOfflineError) {
            // Non-offline verification error — redirect to login for safety
          }
        } finally {
          setIsVerifying(false);
        }
      } else if (!isLoading && !currentUser && mounted) {
        if (pathname !== '/admin/login') {
            router.replace('/admin/login');
        }
        setIsVerifying(false);
      }
    };
    checkAdminStatus();
  }, [isLoading, currentUser, router, pathname, mounted]);

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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      toast({ variant: 'destructive', title: 'Invalid file type', description: 'Please upload a JPEG, PNG, or WebP image.' });
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Avatar must be 5 MB or smaller.' });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const idToken = await currentUser.getIdToken(true);
      const { url: uploadUrl, key, error: urlErr } = await getPresignedUploadUrl(
        currentUser.uid,
        'avatar',
        file.name,
        file.type,
        undefined,
        idToken,
      );

      if (urlErr || !uploadUrl || !key) {
        toast({ variant: 'destructive', title: 'Upload failed', description: urlErr || 'Could not get upload URL.' });
        return;
      }

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadRes.ok) {
        toast({ variant: 'destructive', title: 'Upload failed', description: 'File could not be saved to storage.' });
        return;
      }

      const updateRes = await updateUserProfileAction({ avatar: key });
      if (updateRes.error) {
        toast({ variant: 'destructive', title: 'Upload failed', description: updateRes.error });
        return;
      }
      setAdminProfile((prev: any) => ({ ...prev, avatar: key }));

      const objectUrl = URL.createObjectURL(file);
      setResolvedAvatarUrl(objectUrl);

      toast({ title: 'Avatar updated', description: 'Your profile picture has been saved.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };
  
  if (!mounted || (isLoading && pathname !== '/admin/login') || (isVerifying && pathname !== '/admin/login')) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (!currentUser || !adminProfile) {
    return null;
  }

  const displayName = adminProfile?.name || currentUser.displayName || 'Administrator';
  const initials = displayName.charAt(0);

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-background">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <Link href="/admin">
              <Logo />
            </Link>
          </SidebarHeader>
          
          <SidebarContent className="p-2">
            <AdminDashboardNav />
          </SidebarContent>

          <SidebarFooter>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 p-2 h-auto group-data-[collapsible=icon]:justify-center">
                   <Avatar className="h-10 w-10 border">
                        <AvatarImage src={resolvedAvatarUrl} alt={displayName} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left group-data-[collapsible=icon]:hidden">
                        <p className="font-semibold text-sm truncate">{displayName}</p>
                        <p className="text-[10px] text-muted-foreground truncate uppercase">{adminProfile?.role}</p>
                    </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mb-2">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings/general">
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
          <header className="sticky top-0 z-10 flex h-14 sm:h-16 md:h-20 shrink-0 items-center justify-between gap-2 sm:gap-4 border-b bg-card px-3 sm:px-4 md:px-6">
            <SidebarTrigger className="flex md:hidden" />
            
            <div className="flex flex-1 items-center justify-end gap-4">
                <ThemeToggle />
                <NotificationDropdown
                  currentUserId={currentUser?.uid}
                  notificationsPath="/admin/notifications"
                  recentNotifications={recentNotifications}
                  unreadCount={unreadNotifCount}
                  isLoading={isNotificationsLoading}
                  onMarkAsRead={markAsRead}
                />
                {/* Avatar with edit affordance */}
                <div className="relative group">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarChange}
                    disabled={isUploadingAvatar}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="relative block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    title="Change profile picture"
                  >
                    <Avatar className="h-10 w-10 border">
                      <AvatarImage src={resolvedAvatarUrl} alt={displayName} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isUploadingAvatar ? (
                        <Loader2 className="h-4 w-4 text-white animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4 text-white" />
                      )}
                    </span>
                  </button>
                </div>
            </div>
          </header>
          <main className={cn("flex-1 overflow-y-auto", !pathname.startsWith('/admin/classroom/') && "p-3 sm:p-4 md:p-6")}>
              <QuotaBanner />
              {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
