'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/firebase';
import {
  listStorageObjects,
  deleteStorageObject,
  getPresignedDownloadUrl,
  type StorageObjectMeta,
} from '@/app/actions/storage';
import { useToast } from '@/hooks/use-toast';
import { isQuotaError } from '@/lib/service-errors';
import { reportQuotaError } from '@/lib/feedback/quota-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  HardDrive,
  Trash2,
  Search,
  ExternalLink,
  Loader2,
  ImageIcon,
  FileText,
  Film,
  Music,
  File,
  Copy,
  RefreshCw,
  Check,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function FileTypeIcon({ contentType }: { contentType: string }) {
  if (contentType.startsWith('image/')) return <ImageIcon className="h-4 w-4 text-blue-500" />;
  if (contentType.startsWith('video/')) return <Film className="h-4 w-4 text-purple-500" />;
  if (contentType.startsWith('audio/')) return <Music className="h-4 w-4 text-green-500" />;
  if (contentType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

export default function TutorMediaLibraryPage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [objects, setObjects] = useState<StorageObjectMeta[]>([]);
  const [filtered, setFiltered] = useState<StorageObjectMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [nextToken, setNextToken] = useState<string | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchObjects = useCallback(
    async (options?: { append?: boolean; continuationToken?: string }) => {
      if (!user) return;
      const append = options?.append ?? false;
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setObjects([]);
        setNextToken(undefined);
      }

      try {
        const idToken = await user.getIdToken(true);
        const result = await listStorageObjects(idToken, {
          maxKeys: 200,
          continuationToken: options?.continuationToken,
        });

        if (result.error) {
          const loadErr = new Error(result.error);
          if (isQuotaError(loadErr)) {
            reportQuotaError(loadErr);
          }
          toast({ variant: 'destructive', title: 'Failed to load media', description: result.error });
          return;
        }

        const batch = result.objects ?? [];
        setObjects((prev) => (append ? [...prev, ...batch] : batch));
        setNextToken(result.nextToken);
      } finally {
        if (append) {
          setIsLoadingMore(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [user, toast]
  );

  useEffect(() => {
    void fetchObjects();
  }, [fetchObjects]);

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    setFiltered(
      objects.filter(obj =>
        obj.key.toLowerCase().includes(q) || obj.contentType.toLowerCase().includes(q)
      )
    );
  }, [searchQuery, objects]);

  const handleView = async (obj: StorageObjectMeta) => {
    if (!user) return;
    const idToken = await user.getIdToken(true);
    const { url, error } = await getPresignedDownloadUrl(obj.key, user.uid, undefined, idToken);
    if (error || !url) {
      toast({ variant: 'destructive', title: 'Could not open file' });
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyUrl = async (obj: StorageObjectMeta) => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken(true);
      const { url, error } = await getPresignedDownloadUrl(obj.key, user.uid, undefined, idToken);
      if (error || !url) throw new Error(error);
      await navigator.clipboard.writeText(url);
      setCopiedKey(obj.key);
      setTimeout(() => setCopiedKey(null), 2000);
      toast({ title: 'Signed URL copied to clipboard', description: 'Valid for 15 minutes.' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy URL' });
    }
  };

  const handleDelete = async (key: string) => {
    if (!user) return;
    setDeletingKey(key);
    setConfirmDeleteKey(null);
    try {
      const idToken = await user.getIdToken(true);
      const { error } = await deleteStorageObject(key, idToken);
      if (error) throw new Error(error);
      setObjects(prev => prev.filter(o => o.key !== key));
      toast({ title: 'File deleted' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Delete failed', description: err.message });
    } finally {
      setDeletingKey(null);
    }
  };

  const totalSize = objects.reduce((sum, o) => sum + o.size, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="h-6 w-6" />
            My Media Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {objects.length} files · {formatBytes(totalSize)} total
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchObjects()} disabled={isLoading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by file name or type..."
          className="pl-9"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No files found</p>
          {searchQuery ? (
            <p className="text-sm mt-1">Try a different search term</p>
          ) : (
            <p className="text-sm mt-1">Files you upload to lessons and courses appear here</p>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="hidden sm:table-cell">Size</TableHead>
                  <TableHead className="hidden lg:table-cell">Uploaded</TableHead>
                  <TableHead className="w-10">Vis.</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(obj => (
                  <TableRow key={obj.key}>
                    <TableCell>
                      <FileTypeIcon contentType={obj.contentType} />
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="text-xs font-mono truncate" title={obj.key}>
                          {obj.key.split('/').pop()}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate hidden md:block" title={obj.key}>
                          {obj.key}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs">{formatBytes(obj.size)}</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-xs">{formatDate(obj.lastModified)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={obj.isPublic ? 'secondary' : 'outline'} className="text-[10px] px-1">
                        {obj.isPublic ? 'pub' : 'priv'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleView(obj)}
                          title="View file"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(obj.key);
                              setCopiedKey(`key-${obj.key}`);
                              setTimeout(() => setCopiedKey(null), 2000);
                              toast({ title: 'R2 key copied', description: 'Paste it in the lesson editor → Upload to Vault → Reuse from Media Library.' });
                            } catch {
                              toast({ variant: 'destructive', title: 'Could not copy key' });
                            }
                          }}
                          title="Copy R2 key (for reuse in lesson editor)"
                        >
                          {copiedKey === `key-${obj.key}` ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleCopyUrl(obj)}
                          title="Copy signed download URL (15 min TTL)"
                        >
                          {copiedKey === obj.key ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <ExternalLink className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDeleteKey(obj.key)}
                          disabled={deletingKey === obj.key}
                          title="Delete file"
                        >
                          {deletingKey === obj.key ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {nextToken ? (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => void fetchObjects({ append: true, continuationToken: nextToken })}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <AlertDialog open={!!confirmDeleteKey} onOpenChange={(open) => { if (!open) setConfirmDeleteKey(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-xs break-all">{confirmDeleteKey?.split('/').pop()}</span>
              <br />
              This will permanently remove the file from cloud storage. Lessons using this file will be broken. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDeleteKey && handleDelete(confirmDeleteKey)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
