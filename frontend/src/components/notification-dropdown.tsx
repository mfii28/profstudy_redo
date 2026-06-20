'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell, Loader2, CheckCircle2, AlertCircle, Info, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Notification } from '@/lib/db';

interface NotificationDropdownProps {
  currentUserId?: string;
  notificationsPath: string; // e.g., '/student-dashboard/notifications' or '/tutor-dashboard/notifications'
  recentNotifications: Notification[];
  unreadCount: number;
  isLoading?: boolean;
  onMarkAsRead?: (notificationId: string) => void;
}

export function NotificationDropdown({
  currentUserId,
  notificationsPath,
  recentNotifications = [],
  unreadCount = 0,
  isLoading = false,
  onMarkAsRead,
}: NotificationDropdownProps) {
  const displayedNotifs = recentNotifications.slice(0, 5);
  const hasMore = recentNotifications.length > 5;

  const getIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'achievement':
        return <Star className="h-4 w-4 text-yellow-500 flex-shrink-0" />;
      case 'alert':
        return <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-emergreen-600 flex-shrink-0" />;
      default:
        return <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
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
    } catch {
      return 'recently';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-foreground hover:bg-muted">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-card"
              aria-hidden="true"
            />
          )}
          <span className="sr-only">Notifications ({unreadCount})</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-foreground" />
            <DropdownMenuLabel className="text-base font-semibold m-0 p-0">
              Notifications
            </DropdownMenuLabel>
            {unreadCount > 0 && <span className="h-2.5 w-2.5 rounded-full bg-destructive" aria-hidden="true" />}
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : displayedNotifs.length > 0 ? (
          <>
            <div className="max-h-96 overflow-y-auto">
              {displayedNotifs.map((notification) => (
                <div
                  key={notification.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    'px-4 py-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors cursor-pointer',
                    !notification.read && 'bg-primary/5'
                  )}
                  onClick={() => {
                    if (!notification.read && onMarkAsRead) {
                      onMarkAsRead(notification.id);
                    }
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !notification.read && onMarkAsRead) {
                      e.preventDefault();
                      onMarkAsRead(notification.id);
                    }
                  }}
                >
                  <div className="flex gap-3">
                    <div className="mt-1">
                      {getIcon(notification.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-sm text-foreground leading-tight">
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="h-2 w-2 rounded-full bg-destructive flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
                        {notification.description}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(notification.time)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer with View All button */}
            <DropdownMenuSeparator className="m-0" />
            <div className="p-2">
              <Link href={notificationsPath} className="block">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-center text-primary hover:text-primary hover:bg-primary/10"
                >
                  {hasMore ? 'View all notifications' : 'View all'}
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <div className="py-8 px-4 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-medium">No notifications</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              You're all caught up!
            </p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
