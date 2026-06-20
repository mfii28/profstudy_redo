'use client';

import { useEffect, useState, useRef } from 'react';
import { generateSignedUrl } from '@/app/actions/documents';
import { AlertTriangle, File, Loader2 } from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { useUser } from '@/firebase';
import { PdfViewer } from './pdf-viewer';

interface DocumentViewerProps {
  path: string;
  allowDownload?: boolean;
}

const getFileExtension = (path: string) => {
  const cleanPath = path.split('?')[0]?.split('#')[0] || path;
  return cleanPath.split('.').pop()?.toLowerCase();
};


const TxtViewer = ({ url }: { url: string }) => {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(url)
      .then(res => res.text())
      .then(text => {
        setContent(text);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [url]);

  if (isLoading) return <Skeleton className="h-full w-full" />;

  return <pre className="whitespace-pre-wrap p-6 text-sm">{content}</pre>;
};

const UnsupportedViewer = ({ fileType, url, allowDownload }: { fileType: string; url: string; allowDownload: boolean }) => (
  <div className="flex h-full flex-col items-center justify-center p-8 text-center">
    <File className="h-16 w-16 text-muted-foreground" />
    <h3 className="mt-4 text-xl font-bold">Preview Not Available</h3>
    <p className="mt-2 text-muted-foreground">
      Live preview for <span className="font-bold uppercase">.{fileType}</span> files is not yet supported.
    </p>
    {allowDownload ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex rounded-md border px-4 py-2 text-sm font-semibold hover:bg-muted"
      >
        Open / Download File
      </a>
    ) : (
      <p className="mt-4 text-xs text-muted-foreground">Download is disabled for this lesson type.</p>
    )}
  </div>
);


export function DocumentViewer({ path, allowDownload = false }: DocumentViewerProps) {
  const { user, isUserLoading } = useUser();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string>('');
  const [playbackToken, setPlaybackToken] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isPrivatePath = !!path && !path.startsWith('public/') && !path.startsWith('http');

    // Wait for Firebase auth to resolve before doing anything with private paths
    if (isUserLoading) {
      setIsLoading(true);
      return;
    }

    if (isPrivatePath && !user?.uid) {
      setSignedUrl(null);
      setError('Please sign in to access this document.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSignedUrl(null);
    setPlaybackToken('');
    
    (async () => {
      try {
        let token = '';
        try {
          token = user ? await user.getIdToken() : '';
        } catch (tokenErr) {
          console.error('[DocumentViewer] getIdToken failed:', tokenErr);
        }
        setIdToken(token);

        if (!path.startsWith('public/') && !path.startsWith('http') && token) {
          const playbackResponse = await fetch('/api/media/playback-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ key: path }),
          }).then((response) => response.json());
          if (playbackResponse?.token) {
            setPlaybackToken(playbackResponse.token);
          }
        }

        // For PDFs we skip the signed URL — the PdfViewer streams
        // through /api/media/stream directly.
        const fileExt = getFileExtension(path);
        if (fileExt === 'pdf') {
          if (isPrivatePath && !token) {
            setError('Please sign in to access this document.');
            return;
          }
          setSignedUrl('__pdf_proxy__');
          return;
        }

        const result = await generateSignedUrl(token, path);
        if (typeof result === 'string') {
          setSignedUrl(result);
        } else if (result && typeof result === 'object' && 'error' in result) {
          setError(result.error);
        } else {
          setError('Could not load document.');
        }
      } catch (err) {
        console.error('[DocumentViewer] Failed to load document:', err);
        setError('An unexpected error occurred.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [path, user?.uid, isUserLoading]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    
    // Disable right-click context menu
    const handleContextmenu = (e: MouseEvent) => e.preventDefault();
    
    // Disable specific keyboard shortcuts
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['p', 's', 'i'].includes(e.key.toLowerCase())) {
        if (e.shiftKey && e.key.toLowerCase() === 'i') {
           e.preventDefault(); // Ctrl+Shift+I
           return;
        }
        if (!e.shiftKey) {
            e.preventDefault(); // Ctrl+P, Ctrl+S
        }
      }
    };
    
    viewer.addEventListener('contextmenu', handleContextmenu);
    window.addEventListener('keydown', handleKeydown);

    return () => {
      viewer.removeEventListener('contextmenu', handleContextmenu);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, []);


  const renderViewer = () => {
    if (isLoading) {
      return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (error) {
      return <div className="flex h-full flex-col items-center justify-center p-4 text-center text-destructive"><AlertTriangle className="h-8 w-8 mb-2" />{error}</div>;
    }

    if (!signedUrl) {
      return <div className="flex h-full items-center justify-center text-muted-foreground">Document not available.</div>;
    }

    const fileType = getFileExtension(path);

    switch (fileType) {
      case 'pdf':
        return <PdfViewer path={path} idToken={idToken} playbackToken={playbackToken} watermarkText="PROTECTED COURSE PDF" />;
      case 'txt':
        return <TxtViewer url={signedUrl} />;
      case 'docx':
      case 'doc':
      case 'pptx':
      case 'ppt':
      case 'xlsx':
      case 'xls':
      case 'md':
        return <UnsupportedViewer fileType={fileType} url={signedUrl} allowDownload={allowDownload} />;
      default:
        return <UnsupportedViewer fileType={fileType || 'unknown'} url={signedUrl} allowDownload={allowDownload} />;
    }
  };

  return (
    <div ref={viewerRef} className="h-full w-full bg-background">
      {renderViewer()}
    </div>
  );
}