'use client';

import { useEffect, useMemo } from 'react';

type ProtectedMediaShellProps = {
  children: React.ReactNode;
  watermarkText?: string;
  className?: string;
};

export function ProtectedMediaShell({
  children,
  watermarkText = 'PROTECTED CONTENT',
  className = '',
}: ProtectedMediaShellProps) {
  useEffect(() => {
    const onContext = (event: MouseEvent) => event.preventDefault();
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const blocked =
        (event.ctrlKey || event.metaKey) && ['s', 'p', 'u', 'i', 'j'].includes(key);
      if (blocked) event.preventDefault();
      if (key === 'printscreen') event.preventDefault();
    };
    window.addEventListener('contextmenu', onContext);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('contextmenu', onContext);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const watermarkNodes = useMemo(() => {
    return Array.from({ length: 12 }).map((_, index) => (
      <span key={`wm-${index}`} className="text-[11px] font-bold opacity-20 whitespace-nowrap">
        {watermarkText}
      </span>
    ));
  }, [watermarkText]);

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      {children}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-wrap content-center justify-center gap-8 select-none">
        {watermarkNodes}
      </div>
    </div>
  );
}

