'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  BookOpen,
  Monitor,
  Users,
  Star,
  Megaphone,
  Tv,
  Settings,
  Banknote,
  ChevronRight,
  HardDrive,
  Ticket,
  type LucideIcon,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TUTOR_NAV_CONFIG, type TutorNavIconKey } from '@/lib/tutor-mvp-config';

const iconMap: Record<TutorNavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  bookOpen: BookOpen,
  tv: Tv,
  users: Users,
  star: Star,
  megaphone: Megaphone,
  settings: Settings,
  banknote: Banknote,
  hardDrive: HardDrive,
  monitor: Monitor,
  ticket: Ticket,
};


export function TutorDashboardNav() {
  const pathname = usePathname();
  const [openItems, setOpenItems] = React.useState<Record<string, boolean>>({});

   React.useEffect(() => {
    const newOpenItems: Record<string, boolean> = {};
    TUTOR_NAV_CONFIG.forEach(group => {
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
    <nav className="grid items-start gap-2">
      {TUTOR_NAV_CONFIG.map((group, groupIndex) => (
        <div key={groupIndex} className="grid gap-1">
            {group.title && <h3 className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground group-data-[collapsible=icon]:hidden">{group.title}</h3>}
                {group.items.map((item, itemIndex) => {
                    const Icon = iconMap[item.iconKey];
                    const isParentActive = item.href ? pathname.startsWith(item.href) : false;

                    const NavItemContent = (
                        <div className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0',
                             (item.subItems ? isParentActive && !openItems[item.name] : pathname === item.href)
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                            isParentActive && openItems[item.name] && 'bg-muted'
                        )}>
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1 truncate group-data-[collapsible=icon]:hidden">{item.name}</span>
                            {item.subItems && <ChevronRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden" style={{ transform: openItems[item.name] ? 'rotate(90deg)' : 'none' }} />}
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
                                                    'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
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
      ))}
    </nav>
  );
}