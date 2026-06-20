'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  User,
  MapPin,
  Shield,
  Palette,
} from 'lucide-react';

const settingsNav = [
  { name: 'Profile', href: '/student-dashboard/settings/profile', icon: User },
  { name: 'Address', href: '/student-dashboard/settings/address', icon: MapPin },
  { name: 'Security', href: '/student-dashboard/settings/security', icon: Shield },
  { name: 'Preferences', href: '/student-dashboard/settings/preferences', icon: Palette },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>
      <div className="grid gap-8 md:grid-cols-[200px_1fr]">
        <nav className="flex flex-col gap-1">
          {settingsNav.map((item) => (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
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
        </nav>
        <div className="grid gap-6">{children}</div>
      </div>
    </div>
  );
}
