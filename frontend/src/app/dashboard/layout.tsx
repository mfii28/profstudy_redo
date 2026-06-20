
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Book,
  Home,
  LineChart,
  LogOut,
  Settings,
  Users,
  Loader2,
} from 'lucide-react';

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
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
import { useUser } from '@/firebase';
import { getPresignedDownloadUrl } from '@/app/actions/storage';
import { getUserById } from '@/lib/user-data';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user: currentUser, isLoading, logout } = useUser();
  const [mounted, setMounted] = React.useState(false);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = React.useState<string | undefined>(undefined);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!currentUser) return;
    const resolveAvatar = async () => {
      try {
        const profile = await getUserById(currentUser.uid);
        if (profile?.avatar) {
          if (profile.avatar.startsWith('http')) {
            setResolvedAvatarUrl(profile.avatar);
          } else {
            const { url } = await getPresignedDownloadUrl(profile.avatar, currentUser.uid);
            if (url) setResolvedAvatarUrl(url);
          }
        } else {
          setResolvedAvatarUrl(undefined);
        }
      } catch {
        setResolvedAvatarUrl(undefined);
      }
    };
    void resolveAvatar();
  }, [currentUser]);

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  if (!mounted || isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const menuItems = [
    { href: '/dashboard', tooltip: 'Dashboard', icon: <Home />, label: 'Dashboard' },
    { href: '/dashboard/my-courses', tooltip: 'My Courses', icon: <Book />, label: 'My Courses' },
    { href: '/dashboard/analytics', tooltip: 'Analytics', icon: <LineChart />, label: 'Analytics' },
    { href: '/dashboard/community', tooltip: 'Community', icon: <Users />, label: 'Community' },
  ];

  const displayName = currentUser.displayName || 'Learner';
  const initials = displayName.charAt(0).toUpperCase() || 'U';

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <Logo />
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.tooltip}>
                    <Link href={item.href}>
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
             <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/dashboard/settings'} tooltip="Settings">
                        <Link href="/dashboard/settings">
                          <Settings />
                          <span>Settings</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
             </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex flex-col">
          <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-4 lg:px-6">
            <SidebarTrigger className="flex md:hidden" />
            <div className="w-full flex-1">
            </div>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
              <span className="sr-only">Notifications</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" className="rounded-full">
                  <Avatar>
                    <AvatarImage src={resolvedAvatarUrl} alt={displayName} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <span className="sr-only">Toggle user menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/contact">Support</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 overflow-auto bg-slate-100 p-4 dark:bg-background lg:p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
