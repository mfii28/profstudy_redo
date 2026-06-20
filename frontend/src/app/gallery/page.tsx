'use client';

import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GALLERY_GROUPS, getPublishedGalleryItems, type GalleryItemDocument } from '@/lib/gallery-data';
import type { GalleryGroup } from '@/lib/db';
import { GalleryMediaTile } from '@/components/gallery-media-tile';

function groupLabel(group: GalleryGroup): string {
  return GALLERY_GROUPS.find((g) => g.value === group)?.label ?? group;
}

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItemDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterGroup, setFilterGroup] = useState<GalleryGroup | 'all'>('all');

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getPublishedGalleryItems(filterGroup === 'all' ? undefined : filterGroup);
      setItems(data);
    } finally {
      setIsLoading(false);
    }
  }, [filterGroup]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="bg-primary text-primary-foreground overflow-hidden">
          <div className="page-container hero-pad">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-3xl"
            >
              <div className="mb-8 flex items-center gap-3">
                <span className="h-px w-10 bg-accent" aria-hidden />
                <span className="section-label !mb-0">Campus Life</span>
              </div>
              <h1 className="font-headline text-[clamp(2.5rem,5vw,4rem)] font-black leading-[1.02] tracking-tight">
                Gallery
              </h1>
              <p className="mt-6 max-w-[50ch] text-lg leading-relaxed text-primary-foreground/70">
                Photos and videos from classes, graduations, and events across our ICAG and CITG programs.
              </p>
            </motion.div>
          </div>
        </section>

        <section className="bg-background section-pad-lg">
          <div className="page-container">
            <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="section-label">Media</p>
                <h2 className="section-heading">Browse by group</h2>
              </div>
              <Select
                value={filterGroup}
                onValueChange={(v) => setFilterGroup(v as GalleryGroup | 'all')}
              >
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue placeholder="Filter gallery" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  {GALLERY_GROUPS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : items.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item, idx) => (
                  <motion.article
                    key={item.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.04 }}
                    className="overflow-hidden rounded-xl border bg-card"
                  >
                    <GalleryMediaTile item={item} className="rounded-none" />
                    <div className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-headline text-base font-bold text-primary">{item.title}</h3>
                        <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
                          {item.mediaType}
                        </Badge>
                      </div>
                      {item.caption ? (
                        <p className="text-sm leading-relaxed text-muted-foreground">{item.caption}</p>
                      ) : null}
                      <Badge variant="outline" className="text-xs">{groupLabel(item.group)}</Badge>
                    </div>
                  </motion.article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-surface py-16 text-center text-muted-foreground">
                <p className="font-medium">No gallery items published yet.</p>
                <p className="mt-2 text-sm">Check back soon for photos and videos from our community.</p>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
