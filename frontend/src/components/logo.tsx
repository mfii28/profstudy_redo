'use client';

import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { getGlobalSettings } from '@/lib/platform-settings-data';
import Image from 'next/image';

export function Logo({ className, textClassName }: { className?: string, textClassName?: string }) {
  const [settings, setSettings] = useState({
    siteName: 'Profs Training Solutions',
    logoUrl: ''
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Dynamic logo and title synchronization from global settings
    getGlobalSettings().then(data => {
      setSettings({
        siteName: data.siteName || 'Profs Training Solutions',
        logoUrl: data.logoUrl || ''
      });
    }).catch(() => {
      // Fail gracefully to defaults
    });
  }, []);

  const { siteName, logoUrl } = settings;

  // SSR SAFETY: Render a simplified placeholder during server-side rendering
  if (!mounted) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-xl shadow-lg">P</div>
        <span className={cn('text-xl font-bold font-sans tracking-tight', textClassName)}>Profs Training Solutions</span>
      </div>
    );
  }

  if (logoUrl) {
    return (
      <div className={cn('flex items-center gap-2 group', className)}>
        <div className="relative w-10 h-10 overflow-hidden rounded-xl bg-primary flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
          <Image 
            src={logoUrl} 
            alt={siteName} 
            fill 
            className="object-cover"
            unoptimized
          />
        </div>
        <span className={cn('text-xl font-bold font-sans tracking-tight', textClassName)}>
          {siteName}
        </span>
      </div>
    );
  }

  const safeSiteName = siteName || 'Profs Training Solutions';
  const firstLetter = safeSiteName.charAt(0);
  const nameParts = safeSiteName.split(/(?=[A-Z])/);

  return (
    <div className={cn('flex items-center gap-2 group', className)}>
      <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-xl shadow-lg group-hover:scale-105 transition-transform">
        {firstLetter}
      </div>
      <span className={cn('text-xl font-bold font-sans tracking-tight', textClassName)}>
        {nameParts.length > 1 ? (
          <>
            <span className="text-primary">{nameParts[0]}</span>
            <span className="text-secondary">{nameParts.slice(1).join('')}</span>
          </>
        ) : (
          <span className="text-primary">{safeSiteName}</span>
        )}
      </span>
    </div>
  );
}
