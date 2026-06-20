'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Loader2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// React-PDF docs: configure worker in the same module where <Document>/<Page> are used.
// Use a bundler-resolved worker URL so the worker version matches the pdfjs API version.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PdfViewerProps {
  /** R2 object key (e.g. "private/courses/…/file.pdf") or full URL */
  path: string;
  /** Firebase ID token — required for private paths */
  idToken?: string;
  playbackToken?: string;
  watermarkText?: string;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const SCALE_STEP = 0.25;
const DEFAULT_SCALE = 1.0;

/** Build the source object that react-pdf understands. */
function buildFileSource(path: string, idToken?: string, playbackToken?: string) {
  // Already a browser-loadable URL (external, same-origin API, blob, or data URL) — use directly
  if (
    path.startsWith('http://')
    || path.startsWith('https://')
    || path.startsWith('/')
    || path.startsWith('blob:')
    || path.startsWith('data:')
  ) {
    return path;
  }

  // R2 key — stream through our same-origin proxy to avoid CORS
  const proxyUrl = `/api/media/stream?key=${encodeURIComponent(path)}${playbackToken ? `&pt=${encodeURIComponent(playbackToken)}` : ''}`;

  // Private keys need auth
  if (!path.startsWith('public/') && idToken) {
    return {
      url: proxyUrl,
      httpHeaders: { Authorization: `Bearer ${idToken}` },
    };
  }

  return proxyUrl;
}

export function PdfViewer({ path, idToken, playbackToken, watermarkText = 'PROTECTED PDF' }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);

  const fileSource = useMemo(() => buildFileSource(path, idToken, playbackToken), [path, idToken, playbackToken]);
  // Keep options stable across renders (react-pdf compares by reference).
  // Avoid external CDNs here to prevent CSP/CORS regressions; add cmaps/fonts later only if you need them.
  const options = useMemo(
    () => ({
      // Error handling
      withCredentials: false,
      stopAtErrors: false,
    }),
    [],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);

  // Measure container width for responsive page sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Listen for native fullscreen changes (e.g. user presses Escape)
  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // Only capture keys when the viewer is focused or in fullscreen
      const el = fullscreenRef.current;
      if (!el?.contains(document.activeElement) && !isFullscreen) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          setCurrentPage((prev) => Math.max(1, prev - 1));
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          setCurrentPage((prev) => Math.min(numPages || 1, prev + 1));
          break;
        case '+':
        case '=':
          e.preventDefault();
          setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP));
          break;
        case '-':
          e.preventDefault();
          setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP));
          break;
        case '0':
          e.preventDefault();
          setScale(DEFAULT_SCALE);
          break;
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [numPages, isFullscreen]);

  const onDocumentLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    setCurrentPage(1);
    setIsLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback(async (error: any) => {
    setError('Failed to load PDF. Please try refreshing the page.');
    setIsLoading(false);
  }, []);

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP));
  const resetZoom = () => setScale(DEFAULT_SCALE);

  const toggleFullscreen = async () => {
    const el = fullscreenRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      await el.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  };

  // Keep a stable base width and let react-pdf handle zoom via scale.
  const basePageWidth = containerWidth
    ? Math.max(280, Math.min(containerWidth - 32, 900))
    : 900;

  return (
    <div
      ref={fullscreenRef}
      className={cn(
        'relative flex flex-col h-full w-full bg-muted/30',
        isFullscreen && 'bg-background',
      )}
      tabIndex={0}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b bg-background/95 backdrop-blur px-3 py-2 shrink-0 flex-wrap">
        <div className="text-xs font-semibold tabular-nums min-w-[110px] text-center select-none">
          {numPages ? `Page ${currentPage} / ${numPages}` : 'Loading pages...'}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <button
            onClick={resetZoom}
            className="text-[10px] font-bold min-w-[44px] text-center hover:bg-muted rounded px-1 py-0.5 transition-colors"
            title="Reset zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentPage((prev) => Math.min(numPages || 1, prev + 1))}
            disabled={!numPages || currentPage >= numPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex justify-center"
      >
        {error ? (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center h-full">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <p className="text-sm font-medium text-destructive">{error}</p>
          </div>
        ) : (
          <Document
            file={fileSource}
            options={options}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex flex-col items-center justify-center gap-3 p-12 h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  Loading PDF…
                </p>
              </div>
            }
            className="py-4"
          >
            {isLoading ? null : (
              <div key={`pdf-page-${currentPage}`} className="mb-4">
                <Page
                  pageNumber={currentPage}
                  width={basePageWidth}
                  scale={scale}
                  loading={
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  }
                  className="shadow-lg mx-auto"
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                />
              </div>
            )}
          </Document>
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-wrap content-center justify-center gap-8 select-none">
        {Array.from({ length: 10 }).map((_, index) => (
          <span key={`pdf-wm-${index}`} className="text-[10px] font-bold opacity-15">
            {watermarkText}
          </span>
        ))}
      </div>
    </div>
  );
}
