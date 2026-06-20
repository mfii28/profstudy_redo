'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Film, Loader2 } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/media-url';
import type { GalleryItemDocument } from '@/lib/gallery-data';
import { cn } from '@/lib/utils';

type GalleryMediaTileProps = {
  item: GalleryItemDocument;
  className?: string;
};

export function GalleryMediaTile({ item, className }: GalleryMediaTileProps) {
  const [videoError, setVideoError] = useState(false);
  const src = resolveMediaUrl(item.mediaUrl);

  if (item.mediaType === 'video') {
    return (
      <div className={cn('relative aspect-[4/3] overflow-hidden rounded-xl bg-muted', className)}>
        {!videoError && src ? (
          <video
            src={src}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
            onError={() => setVideoError(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Film className="h-10 w-10 opacity-40" />
            <span className="text-xs">Video unavailable</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('relative aspect-[4/3] overflow-hidden rounded-xl bg-muted', className)}>
      {src ? (
        <Image src={src} alt={item.title} fill unoptimized className="object-cover transition-transform duration-500 hover:scale-105" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
