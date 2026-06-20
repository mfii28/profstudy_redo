'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
    BookMarked,
    BookOpen,
    ChevronRight,
    CreditCard,
    LayoutDashboard,
    Monitor,
    Receipt,
    Search,
    Settings,
    Sparkles,
    Tv,
    Megaphone,
    Star,
    Ticket,
    TrendingUp,
    type LucideIcon,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { STUDENT_NAV_CONFIG, type StudentNavIconKey } from '@/lib/student-mvp-config';

const iconMap: Record<StudentNavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  search: Search,
  bookOpen: BookOpen,
  megaphone: Megaphone,
  bookMarked: BookMarked,
  tv: Tv,
  sparkles: Sparkles,
  creditCard: CreditCard,
  receipt: Receipt,
  settings: Settings,
  monitor: Monitor,
  star: Star,
  ticket: Ticket,
  trendingUp: TrendingUp,
};

export function DashboardNav({ hasNewAnnouncements = false }: { hasNewAnnouncements?: boolean }) {
  const pathname = usePathname();
  const [openItems, setOpenItems] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const newOpenItems: Record<string, boolean> = {};
    STUDENT_NAV_CONFIG.forEach(group => {
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

  return (
    <nav className="grid items-start gap-1 pb-10">
      {STUDENT_NAV_CONFIG.map((group, groupIndex) => (
        <div key={groupIndex} className="grid gap-1">
            {group.title && (
              <h3 className="mb-1 mt-4 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground group-data-[collapsible=icon]:hidden">
                {group.title}
              </h3>
            )}
                {group.items.map((item, itemIndex) => {
                    const Icon = iconMap[item.iconKey];
                    const isParentActive = item.href ? pathname.startsWith(item.href) : false;
                    const showAnnouncementDot = item.href === '/student-dashboard/announcements' && hasNewAnnouncements;

                    const NavItemContent = (
                        <div className={cn(
                            'relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0',
                             (item.subItems ? isParentActive && !openItems[item.name] : pathname === item.href)
                                ? 'bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            isParentActive && openItems[item.name] && 'bg-muted'
                        )}>
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1 truncate group-data-[collapsible=icon]:hidden">{item.name}</span>
                            {showAnnouncementDot && (
                                <span
                                  className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background group-data-[collapsible=icon]:right-1.5 group-data-[collapsible=icon]:top-1.5"
                                  aria-hidden="true"
                                />
                            )}
                            {item.badge && <Badge variant="secondary" className="ml-auto text-[8px] h-4 px-1 group-data-[collapsible=icon]:hidden font-black bg-accent text-accent-foreground">{item.badge}</Badge>}
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
                                        <div className="ml-5 space-y-1 border-l-2 border-primary/10 pl-4 mt-1">
                                        {item.subItems.map((subItem) => {
                                            const SubIcon = subItem.iconKey ? iconMap[subItem.iconKey] : undefined;
                                            const isSubActive = pathname === subItem.href;
                                            return (
                                                <Link key={subItem.name} href={subItem.href}>
                                                    <div
                                                        className={cn(
                                                        'flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold transition-all',
                                                        isSubActive
                                                            ? 'text-primary bg-primary/5'
                                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                                        )}
                                                    >
                                                        {SubIcon && <SubIcon className={cn("h-3.5 w-3.5 shrink-0", isSubActive ? "text-primary" : "text-muted-foreground/50")} />}
                                                        <span className="flex-1 truncate">{subItem.name}</span>
                                                        {subItem.badge && <Badge variant="secondary" className="text-[8px] h-4 px-1">{subItem.badge}</Badge>}
                                                    </div>
                                                </Link>
                                            )
                                        })}
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
      ))}
    </nav>
  );
}
