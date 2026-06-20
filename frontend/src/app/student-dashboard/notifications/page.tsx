'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Loader2, CheckCircle2, AlertCircle, Info, Star, CheckCheck } from 'lucide-react';
import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';
import { getNotifications, markAsRead, markAllAsRead, subscribeToNotifications } from '@/lib/notifications-data';
import { type Notification } from '@/lib/db';
import { EmptyState } from '@/components/dashboard/empty-state';
import { useToast } from '@/hooks/use-toast';

export default function NotificationsPage() {
  const { user: currentUser, isLoading: isUserLoading } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarking, setIsMarking] = useState(false);
  const { toast } = useToast();

  const fetchNotificationsData = async () => {
    if (!currentUser) {
      if (!isUserLoading) setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const data = await getNotifications(currentUser.uid);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser || isUserLoading) return;

    const unsubscribe = subscribeToNotifications(
      currentUser.uid,
      (data) => {
        setNotifications(data);
        setIsLoading(false);
      },
      (error) => {
        console.error('Notifications subscription error:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser, isUserLoading]);

  const handleMarkAllRead = async () => {
    if (!currentUser || notifications.length === 0) return;
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;

    setIsMarking(true);
    try {
        await markAllAsRead(currentUser.uid, unreadIds);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        toast({ title: "Notifications cleared" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Error updating notifications" });
    } finally {
        setIsMarking(false);
    }
  };

  const handleMarkOneRead = async (id: string) => {
      await markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const getIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'achievement': return <Star className="h-5 w-5 text-yellow-500" />;
      case 'alert': return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'success': return <CheckCircle2 className="h-5 w-5 text-success" />;
      default: return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  if (isUserLoading || isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-10 w-1/3 mb-2" />
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

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold mb-2 font-headline">Notifications</h1>
            <p className="text-muted-foreground">
            Stay updated with your course progress, upcoming exams, and platform news.
            </p>
        </div>
        {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={isMarking} className="gap-2">
                {isMarking ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCheck className="h-4 w-4" />}
                Mark all as read
            </Button>
        )}
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Recent Alerts {unreadCount > 0 && <Badge variant="secondary" className="ml-2">{unreadCount} New</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((item) => (
                <div 
                  key={item.id} 
                  className={`flex items-start gap-4 p-6 transition-colors hover:bg-muted/20 cursor-pointer ${!item.read ? 'bg-primary/5' : ''}`}
                  onClick={() => !item.read && handleMarkOneRead(item.id)}
                >
                  <div className="flex-shrink-0 mt-1 p-2 rounded-full bg-background border shadow-sm">
                    {getIcon(item.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-bold text-foreground truncate">{item.title}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                    {!item.read && (
                      <Badge className="mt-3 bg-primary text-[10px] h-5 px-2">Unread</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20">
              <EmptyState
                icon={<Bell className="h-16 w-16 text-muted-foreground/30" />}
                title="All caught up!"
                description="You don't have any new notifications at the moment. We'll let you know when something important happens."
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
