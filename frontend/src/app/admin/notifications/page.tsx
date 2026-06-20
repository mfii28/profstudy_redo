'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, Loader2, CheckCircle2, AlertCircle, Info, Star, CheckCheck } from 'lucide-react';

import { useUser } from '@/firebase';
import { markAllAsRead, markAsRead, subscribeToNotifications } from '@/lib/notifications-data';
import { type Notification } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/dashboard/empty-state';

export default function AdminNotificationsPage() {
  const { user: currentUser, isLoading: isUserLoading } = useUser();
  const { toast } = useToast();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      if (!isUserLoading) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = subscribeToNotifications(
      currentUser.uid,
      (data) => {
        setNotifications(data);
        setIsLoading(false);
      },
      (error) => {
        console.error('[Admin Notifications] Failed to subscribe to notifications:', error);
        toast({
          variant: 'destructive',
          title: 'Failed to load notifications',
          description: 'Please refresh and try again.',
        });
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentUser, isUserLoading, toast]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('[Admin Notifications] Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUser || unreadCount === 0) return;

    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setIsMarkingAll(true);
    try {
      await markAllAsRead(currentUser.uid, unreadIds);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast({ title: 'All notifications marked as read' });
    } catch (error) {
      console.error('[Admin Notifications] Failed to mark all notifications as read:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to update notifications',
      });
    } finally {
      setIsMarkingAll(false);
    }
  };

  const getIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'achievement':
        return <Star className="h-5 w-5 text-yellow-500" />;
      case 'alert':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  if (isUserLoading || isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="mb-2 h-10 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-headline mb-2 text-3xl font-bold">Admin Notifications</h1>
          <p className="text-muted-foreground">
            Monitor platform-wide alerts, moderation events, and operational updates.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAll}
            className="gap-2"
          >
            {isMarkingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
            Mark all as read
          </Button>
        )}
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Stream
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {unreadCount} New
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-4 p-6 transition-colors hover:bg-muted/20 ${
                    !item.read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => !item.read && handleMarkAsRead(item.id)}
                >
                  <div className="mt-1 flex-shrink-0 rounded-full border bg-background p-2 shadow-sm">
                    {getIcon(item.category)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="truncate font-bold text-foreground">{item.title}</p>
                      <span className="text-muted-foreground whitespace-nowrap text-xs">
                        {formatTime(item.time)}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
                    {!item.read && (
                      <Badge className="mt-3 h-5 bg-primary px-2 text-[10px]">Unread</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20">
              <EmptyState
                icon={<Bell className="h-16 w-16 text-muted-foreground/30" />}
                title="All caught up"
                description="No new notifications are pending for your account."
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
