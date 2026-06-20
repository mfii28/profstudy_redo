'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { ImageOff } from 'lucide-react';

interface ImageWithFallbackProps {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  fallbackSrc?: string;
}

export function ImageWithFallback({
  src,
  alt,
  fill,
  className,
  sizes,
  priority = false,
  width,
  height,
  fallbackSrc = '/placeholder.svg',
}: ImageWithFallbackProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);
  const r2PublicDomain = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || '';
  const r2PublicHost = (() => {
    if (!r2PublicDomain) return '';
    try {
      return new URL(r2PublicDomain).hostname;
    } catch {
      return r2PublicDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    }
  })();

  useEffect(() => {
    if (src) {
      setImgSrc(src);
      setHasError(false);
    }
  }, [src]);

  const isR2Url =
    imgSrc.includes('.r2.dev/') ||
    imgSrc.includes('.r2.cloudflarestorage.com/') ||
    imgSrc.includes('cdn.mytestingdomain.icu/') ||
    (r2PublicHost ? imgSrc.includes(`${r2PublicHost}/`) : false) ||
    imgSrc.startsWith('/api/media/file?');

  const handleError = () => {
    if (imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
    } else {
      setHasError(true);
    }
  };

  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-muted ${className || ''}`}
        style={fill ? { position: 'absolute', inset: 0 } : undefined}
      >
        <ImageOff className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  if (fill) {
    return (
      <Image
        src={imgSrc}
        alt={alt}
        fill
        className={className}
        sizes={sizes}
        priority={priority}
        unoptimized={isR2Url}
        onError={handleError}
      />
    );
  }

  return (
    <Image
      src={imgSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      unoptimized={isR2Url}
      onError={handleError}
    />
  );
}
