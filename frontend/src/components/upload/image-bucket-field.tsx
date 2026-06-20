'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { Loader2, Upload } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';

type ImageBucketFieldProps = {
  label: string;
  value?: string;
  isUploading?: boolean;
  onFileSelected: (file: File) => void;
  accept?: string;
  className?: string;
  description?: string;
  inputId?: string;
};

export function ImageBucketField({
  label,
  value,
  isUploading = false,
  onFileSelected,
  accept = 'image/*',
  className,
  description,
  inputId,
}: ImageBucketFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = inputId || `image-bucket-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      <div
        className={cn(
          'relative aspect-video rounded-lg border-2 border-dashed border-muted-foreground/30',
          'flex flex-col items-center justify-center overflow-hidden bg-muted/20 group'
        )}
      >
        {isUploading ? (
          <div className="space-y-2 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Uploading…</p>
          </div>
        ) : value ? (
          <>
            <Image src={resolveMediaUrl(value)} alt="" fill unoptimized className="object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm font-bold text-white">
                <Upload className="h-4 w-4" /> Change image
              </Label>
            </div>
          </>
        ) : (
          <Label htmlFor={id} className="cursor-pointer space-y-2 p-4 text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">Click to upload an image</p>
            <p className="text-[10px] text-muted-foreground/80">PNG, JPG, or WEBP</p>
          </Label>
        )}
        <input
          id={id}
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={accept}
          disabled={isUploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelected(file);
            if (inputRef.current) inputRef.current.value = '';
          }}
        />
      </div>
    </div>
  );
}
