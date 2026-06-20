'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Monitor,
  Tv,
  DollarSign,
  Settings,
  ChevronRight,
  Store,
  CheckCheck,
  Ticket,
  HardDrive,
  BarChart2,
  Megaphone,
  FileText,
  Tag,
  Download,
  Star,
  UserCircle,
  Shield,
  Activity,
  Database,
  TrendingUp,
  Building2,
  Package,
  Search,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUser } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/firestore';
import type { User as UserProfile } from '@/lib/db';
import { ADMIN_MVP_NAV_CONFIG, type AdminNavIconKey } from '@/lib/admin-mvp-config';
import { Input } from '@/components/ui/input';

const iconMap: Record<AdminNavIconKey, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  users: Users,
  bookOpen: BookOpen,
  tv: Tv,
  store: Store,
  dollarSign: DollarSign,
  ticket: Ticket,
  settings: Settings,
  checkCheck: CheckCheck,
  hardDrive: HardDrive,
  monitor: Monitor,
  barChart: BarChart2,
  megaphone: Megaphone,
  fileText: FileText,
  tag: Tag,
  download: Download,
  star: Star,
  userCircle: UserCircle,
  shield: Shield,
  activity: Activity,
  database: Database,
  trendingUp: TrendingUp,
  building: Building2,
  package: Package,
};

export function AdminDashboardNav() {
  const pathname = usePathname();
  const { user: currentUser, isLoading: isUserLoading } = useUser();
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = React.useState(true);
  const [openItems, setOpenItems] = React.useState<Record<string, boolean>>({});
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    const fetchUserProfile = async () => {
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUserProfile(userDocSnap.data() as UserProfile);
        }
      }
      setIsProfileLoading(false);
    };
    if (!isUserLoading) {
      fetchUserProfile();
    }
  }, [currentUser, isUserLoading]);

  // Sync open states with current path
  React.useEffect(() => {
    const newOpenItems: Record<string, boolean> = {};
    ADMIN_MVP_NAV_CONFIG.forEach(group => {
        group.items.forEach(item => {
            if (item.subItems && item.href && pathname.startsWith(item.href)) {
                newOpenItems[item.name] = true;
            }
        });
    });
    setOpenItems(newOpenItems);
  }, [pathname]);

  const handleOpenChange = (itemName: string, isOpen: boolean) => {
    setOpenItems(prev => ({...prev, [itemName]: isOpen}));
  }

  if (isUserLoading || isProfileLoading) {
    // You can render a loading skeleton here
    return <div className="grid items-start gap-2"></div>;
  }

  return (
    <nav className="grid items-start gap-2">
      <div className="relative px-2 group-data-[collapsible=icon]:hidden">
        <Search className="absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find admin page..."
          className="h-8 pl-8 text-xs"
        />
      </div>
            {ADMIN_MVP_NAV_CONFIG.map((group, groupIndex) => {
        if (group.role && group.role !== userProfile?.role) {
            return null;
        }
        const query = search.trim().toLowerCase();
        const visibleItems = group.items.filter((item) => {
          if (!query) return true;
          if (item.name.toLowerCase().includes(query)) return true;
          return (item.subItems || []).some((sub) => sub.name.toLowerCase().includes(query));
        });
        if (visibleItems.length === 0) return null;
        
        return (
            <div key={groupIndex} className="grid gap-1">
                {group.title && (
                    <h3 className="mb-2 mt-4 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground group-data-[collapsible=icon]:hidden">
                        {group.title}
                    </h3>
                )}
                {visibleItems.map((item, itemIndex) => {
                    const Icon = iconMap[item.iconKey];
                    const isParentActive = item.href ? pathname.startsWith(item.href) : false;

                    const NavItemContent = (
                        <div className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0',
                            (item.subItems ? isParentActive && !openItems[item.name] : pathname === item.href)
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            isParentActive && openItems[item.name] && 'bg-muted'
                        )}>
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1 truncate group-data-[collapsible=icon]:hidden">{item.name}</span>
                            {item.subItems && (
                                <ChevronRight 
                                    className={cn(
                                        "h-4 w-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden",
                                        openItems[item.name] && "rotate-90"
                                    )} 
                                />
                            )}
                        </div>
                    );

                    const NavItemWrapper = ({ children }: { children: React.ReactNode }) => (
                        <TooltipProvider delayDuration={0}>
                            <Tooltip>
                                <TooltipTrigger asChild>{children}</TooltipTrigger>
                                <TooltipContent side="right" className="flex items-center gap-4">
                                    {item.name}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    );

                    return (
                        <NavItemWrapper key={itemIndex}>
                            {item.subItems ? (
                                <Collapsible open={openItems[item.name] || false} onOpenChange={(isOpen) => handleOpenChange(item.name, isOpen)}>
                                    <CollapsibleTrigger asChild>
                                        <div className="cursor-pointer">{NavItemContent}</div>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="py-1 group-data-[collapsible=icon]:hidden">
                                        <div className="ml-5 space-y-1 border-l border-border pl-4">
                                        {item.subItems.map((subItem) => (
                                            <Link key={subItem.name} href={subItem.href}>
                                                <div
                                                    className={cn(
                                                    'block rounded-md px-3 py-2 text-xs font-medium transition-colors',
                                                    pathname === subItem.href
                                                        ? 'text-primary font-bold'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                    )}
                                                >
                                                    {subItem.name}
                                                </div>
                                            </Link>
                                        ))}
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            ) : (
                                <Link href={item.href || '#'}>
                                    {NavItemContent}
                                </Link>
                            )}
                        </NavItemWrapper>
                    )
                })}
            </div>
        )
      })}
    </nav>
  );
}
