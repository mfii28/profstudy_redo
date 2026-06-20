'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Settings,
  CreditCard,
  Mail,
  MessageSquareMore,
  ScrollText,
  Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

const settingsNav = [
  { name: 'General', href: '/admin/settings/general', icon: Settings },
  { name: 'Communications', href: '/admin/settings/communications', icon: MessageSquareMore },
  { name: 'Communication Logs', href: '/admin/settings/communications/logs', icon: ScrollText },
  { name: 'Payment', href: '/admin/settings/payment', icon: CreditCard },
  { name: 'Email Templates', href: '/admin/settings/email', icon: Mail },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [search, setSearch] = useState('');

  const filteredNav = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return settingsNav;
    return settingsNav.filter((item) => item.name.toLowerCase().includes(query));
  }, [search]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">Global Platform Settings</h1>
        <p className="text-muted-foreground">
          Manage global settings for the entire platform.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <nav className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Find setting..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
          {filteredNav.map((item) => (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  'flex min-w-max items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:min-w-0',
                  pathname === item.href
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </div>
            </Link>
          ))}
          </div>
        </nav>
        <div className="grid gap-6">{children}</div>
      </div>
    </div>
  );
}
