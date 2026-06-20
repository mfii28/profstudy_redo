'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser } from '@/firebase';
import {
  listStorageObjects,
  bulkDeleteStorageObjects,
  deleteStorageObject,
  getPresignedDownloadUrl,
  type StorageObjectMeta,
} from '@/app/actions/storage';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  RefreshCw,
  ChevronDown,
  ChevronRight,
  User,
  BarChart3,
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

type FileTypeFilter = 'all' | 'image' | 'video' | 'audio' | 'document' | 'other';

function getFileTypeCategory(contentType: string): FileTypeFilter {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  if (contentType === 'application/pdf' ||
      contentType.includes('word') ||
      contentType.includes('text/') ||
      contentType === 'text/plain') return 'document';
  return 'other';
}

function FileTypeIcon({ contentType }: { contentType: string }) {
  if (contentType.startsWith('image/')) return <ImageIcon className="h-4 w-4 text-blue-500" />;
  if (contentType.startsWith('video/')) return <Film className="h-4 w-4 text-purple-500" />;
  if (contentType.startsWith('audio/')) return <Music className="h-4 w-4 text-green-500" />;
  if (contentType === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function ImageThumbnail({ storageKey, uid, idToken }: { storageKey: string; uid: string; idToken?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    getPresignedDownloadUrl(storageKey, uid, undefined, idToken).then(({ url }) => {
      if (url) setSrc(url);
    }).catch(() => {});
  }, [storageKey, uid, idToken]);

  if (!src) {
    return <div className="h-9 w-14 rounded bg-muted animate-pulse" />;
  }
  return (
    <img
      src={src}
      alt=""
      className="h-9 w-14 rounded object-cover border border-border"
      onError={() => setSrc(null)}
    />
  );
}

export default function AdminMediaLibraryPage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [objects, setObjects] = useState<StorageObjectMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [confirmSingleKey, setConfirmSingleKey] = useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
  const [nextToken, setNextToken] = useState<string | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);

  const fetchObjects = useCallback(async (reset = true) => {
    if (!user) return;
    if (reset) {
      setIsLoading(true);
      setObjects([]);
      setNextToken(undefined);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const idToken = await user.getIdToken(true);
      const result = await listStorageObjects(idToken, {
        maxKeys: 200,
        continuationToken: reset ? undefined : nextToken,
      });

      if (result.error) {
        toast({ variant: 'destructive', title: 'Failed to load media', description: result.error });
        return;
      }

      const newObjs = result.objects ?? [];
      setObjects(prev => reset ? newObjs : [...prev, ...newObjs]);
      setNextToken(result.nextToken);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [user, nextToken, toast]);

  useEffect(() => {
    void fetchObjects(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Client-side filtering
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const o = ownerFilter.toLowerCase();
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toMs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null;

    return objects.filter(obj => {
      if (q && !obj.key.toLowerCase().includes(q) && !obj.contentType.toLowerCase().includes(q)) return false;
      if (o) {
        const ownerName = obj.ownerName?.toLowerCase() ?? '';
        const ownerEmail = obj.ownerEmail?.toLowerCase() ?? '';
        if (!ownerName.includes(o) && !ownerEmail.includes(o)) return false;
      }
      if (typeFilter !== 'all' && getFileTypeCategory(obj.contentType) !== typeFilter) return false;
      if (fromMs && obj.lastModified && new Date(obj.lastModified).getTime() < fromMs) return false;
      if (toMs && obj.lastModified && new Date(obj.lastModified).getTime() > toMs) return false;
      return true;
    });
  }, [objects, searchQuery, ownerFilter, typeFilter, dateFrom, dateTo]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelected(new Set());
  }, [searchQuery, ownerFilter, typeFilter, dateFrom, dateTo]);

  // Per-tutor usage stats
  const usageByOwner = useMemo(() => {
    const map: Record<string, { name: string; email: string; size: number; count: number }> = {};
    for (const obj of objects) {
      if (!obj.ownerUid) continue;
      if (!map[obj.ownerUid]) {
        map[obj.ownerUid] = { name: obj.ownerName ?? obj.ownerUid, email: obj.ownerEmail ?? '', size: 0, count: 0 };
      }
      map[obj.ownerUid].size += obj.size;
      map[obj.ownerUid].count += 1;
    }
    return Object.entries(map)
      .map(([uid, v]) => ({ uid, ...v }))
      .sort((a, b) => b.size - a.size);
  }, [objects]);

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

  const handleDelete = async (key: string) => {
    if (!user) return;
    setDeletingKey(key);
    setConfirmSingleKey(null);
    try {
      const idToken = await user.getIdToken(true);
      const { error } = await deleteStorageObject(key, idToken);
      if (error) throw new Error(error);
      setObjects(prev => prev.filter(o => o.key !== key));
      setSelected(prev => { const next = new Set(prev); next.delete(key); return next; });
      toast({ title: 'File deleted' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Delete failed', description: err.message });
    } finally {
      setDeletingKey(null);
    }
  };

  const handleBulkDelete = async () => {
    if (!user || selected.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const idToken = await user.getIdToken(true);
      const allKeys = Array.from(selected);
      const keysToSend = allKeys.slice(0, 1000);
      const keysSet = new Set(keysToSend);
      const { error, deleted } = await bulkDeleteStorageObjects(keysToSend, idToken);
      if (error) throw new Error(error);
      setObjects(prev => prev.filter(o => !keysSet.has(o.key)));
      setSelected(prev => {
        const next = new Set(prev);
        keysSet.forEach(k => next.delete(k));
        return next;
      });
      const remaining = allKeys.length - keysToSend.length;
      toast({
        title: `${deleted ?? keysToSend.length} files deleted`,
        description: remaining > 0 ? `${remaining} files beyond the 1,000-key limit remain selected.` : undefined,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Bulk delete failed', description: err.message });
    } finally {
      setIsBulkDeleting(false);
      setConfirmBulkOpen(false);
    }
  };

  const toggleSelect = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(o => o.key)));
    }
  };

  const totalSize = objects.reduce((sum, o) => sum + o.size, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HardDrive className="h-6 w-6" />
            Media Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {objects.length} objects · {formatBytes(totalSize)} total
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmBulkOpen(true)}
              disabled={isBulkDeleting}
              className="gap-2"
              title={selected.size > 1000 ? 'Only the first 1,000 files will be deleted per operation' : undefined}
            >
              <Trash2 className="h-4 w-4" />
              Delete {Math.min(selected.size, 1000)}{selected.size > 1000 ? ' (capped)' : ''} selected
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => fetchObjects(true)} disabled={isLoading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Storage Usage Panel */}
      <Collapsible open={usageOpen} onOpenChange={setUsageOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Storage Usage
            {usageOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <div className="rounded-md border p-4 space-y-3">
            <p className="text-sm font-semibold">
              Total: {formatBytes(totalSize)} across {objects.length} files
            </p>
            {usageByOwner.length === 0 ? (
              <p className="text-xs text-muted-foreground">No owner-attributed files found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Files</TableHead>
                    <TableHead className="text-right">Usage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageByOwner.map(entry => (
                    <TableRow key={entry.uid}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{entry.name}</p>
                            {entry.email && (
                              <p className="text-[10px] text-muted-foreground">{entry.email}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">{entry.count}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatBytes(entry.size)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Filters */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by file name or type..."
            className="pl-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by owner..."
            className="pl-9"
            value={ownerFilter}
            onChange={e => setOwnerFilter(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as FileTypeFilter)}>
          <SelectTrigger>
            <SelectValue placeholder="File type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-xs" title="From date" />
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-xs" title="To date" />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <HardDrive className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No files found</p>
          {(searchQuery || ownerFilter || typeFilter !== 'all' || dateFrom || dateTo) && (
            <p className="text-sm mt-1">Try adjusting your filters</p>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="hidden md:table-cell w-16">Preview</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead className="hidden lg:table-cell">Owner</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead className="hidden sm:table-cell">Size</TableHead>
                  <TableHead className="hidden lg:table-cell">Modified</TableHead>
                  <TableHead className="w-10">Vis.</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(obj => (
                  <TableRow key={obj.key} className={selected.has(obj.key) ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(obj.key)}
                        onCheckedChange={() => toggleSelect(obj.key)}
                        aria-label="Select file"
                      />
                    </TableCell>
                    <TableCell>
                      <FileTypeIcon contentType={obj.contentType} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {obj.contentType.startsWith('image/') && user ? (
                        <ImageThumbnail storageKey={obj.key} uid={user.uid} />
                      ) : (
                        <div className="h-9 w-14 rounded bg-muted/30 flex items-center justify-center">
                          <FileTypeIcon contentType={obj.contentType} />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <p className="text-xs font-mono truncate" title={obj.key}>
                          {obj.key.split('/').pop()}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate hidden sm:block" title={obj.key}>
                          {obj.key}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {obj.ownerName ? (
                        <div>
                          <p className="text-xs font-medium truncate max-w-[140px]">{obj.ownerName}</p>
                          {obj.ownerEmail && (
                            <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">{obj.ownerEmail}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">{obj.contentType}</span>
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
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setConfirmSingleKey(obj.key)}
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

          {nextToken && (
            <div className="text-center">
              <Button variant="outline" onClick={() => fetchObjects(false)} disabled={isLoadingMore}>
                {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      {/* Single-file delete confirmation */}
      <AlertDialog open={!!confirmSingleKey} onOpenChange={(open) => { if (!open) setConfirmSingleKey(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-xs break-all">{confirmSingleKey?.split('/').pop()}</span>
              <br />
              This will permanently delete the file from cloud storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmSingleKey && handleDelete(confirmSingleKey)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirmation */}
      <AlertDialog open={confirmBulkOpen} onOpenChange={setConfirmBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} files?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selected.size} file{selected.size !== 1 ? 's' : ''} from cloud storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete {selected.size} files
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
