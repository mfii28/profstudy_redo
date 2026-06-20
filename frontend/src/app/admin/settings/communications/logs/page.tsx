'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, ScrollText } from 'lucide-react';
import { getCommunicationAttempts } from '@/app/actions/communications';

type Attempt = {
  id: string;
  eventId?: string;
  channel?: string;
  status?: string;
  error?: string | null;
  createdAt?: string;
};

const STATUS_FILTERS = ['all', 'sent', 'failed', 'delegated'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function statusBadgeVariant(status?: string): 'destructive' | 'secondary' | 'outline' {
  if (status === 'failed') return 'destructive';
  if (status === 'sent') return 'secondary';
  return 'outline';
}

export default function CommunicationLogsPage() {
  const { user } = useUser();
  const [items, setItems] = useState<Attempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const idToken = await user.getIdToken(true);
      const result = await getCommunicationAttempts({ idToken, limit: 500 });
      if ('error' in result && result.error) {
        setItems([]);
        return;
      }
      setItems((('items' in result ? result.items : []) || []) as Attempt[]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const statusHit = statusFilter === 'all' || item.status === statusFilter;
      if (!statusHit) return false;
      if (!query) return true;
      return (
        item.id.toLowerCase().includes(query) ||
        String(item.eventId || '').toLowerCase().includes(query) ||
        String(item.channel || '').toLowerCase().includes(query) ||
        String(item.error || '').toLowerCase().includes(query)
      );
    });
  }, [items, search, statusFilter]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-4 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ScrollText className="h-5 w-5 text-muted-foreground" aria-hidden />
              Delivery logs
            </CardTitle>
            <CardDescription>SMS, WhatsApp, email delegation, retries, and failures.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Input
              placeholder="Search by id, event, channel, or error..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="lg:max-w-md"
            />
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={statusFilter === value ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(value)}
                >
                  {value}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {isLoading ? 'Loading attempts...' : `${filtered.length} of ${items.length} shown`}
          </p>
        </CardContent>
        <CardContent className="p-0">
          <div className="overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {isLoading &&
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={`skeleton-${index}`} className="border-t">
                      <td className="px-4 py-3" colSpan={5}>
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))}
                {!isLoading &&
                  filtered.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="whitespace-nowrap px-4 py-3">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                      </td>
                      <td className="max-w-[12rem] truncate px-4 py-3 font-mono text-xs" title={item.eventId || item.id}>
                        {item.eventId || item.id}
                      </td>
                      <td className="px-4 py-3 capitalize">{item.channel || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadgeVariant(item.status)}>{item.status || 'unknown'}</Badge>
                      </td>
                      <td className="max-w-md px-4 py-3 text-xs text-muted-foreground">{item.error || '—'}</td>
                    </tr>
                  ))}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted-foreground" colSpan={5}>
                      No logs match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
