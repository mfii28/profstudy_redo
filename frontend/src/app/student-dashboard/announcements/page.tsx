'use client';

import { useEffect, useMemo, useState } from 'react';
import { Megaphone, Info, AlertTriangle, PartyPopper, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/dashboard/empty-state';
import { subscribeToAnnouncements } from '@/lib/marketing-data';
import type { Announcement } from '@/lib/db';
import { useEnrolledCourses } from '@/hooks/use-enrolled-courses';
import { getLastSeenAnnouncementAt, isAnnouncementNew, markAnnouncementsSeen } from '@/lib/announcement-status';

export default function StudentAnnouncementsPage() {
  const { user, profile, isLoading: isProfileLoading } = useEnrolledCourses();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSeenBeforeOpen, setLastSeenBeforeOpen] = useState<string | null>(null);

  const enrolledCourseIds = useMemo(() => {
    return new Set((profile?.enrollments || []).map((enrollment) => enrollment.courseId));
  }, [profile?.enrollments]);

  useEffect(() => {
    if (!user?.uid) return;

    const previousLastSeen = getLastSeenAnnouncementAt(user.uid);
    setLastSeenBeforeOpen(previousLastSeen);
    markAnnouncementsSeen(user.uid);
  }, [user?.uid]);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = subscribeToAnnouncements(
      (allAnnouncements) => {
        if (cancelled) return;
        const filtered = allAnnouncements.filter((announcement) => {
          if (!announcement.courseId) return true;
          return enrolledCourseIds.has(announcement.courseId);
        });
        setAnnouncements(filtered);
        setIsLoading(false);
      },
      undefined,
      () => {
        if (!cancelled) {
          setAnnouncements([]);
          setIsLoading(false);
        }
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [enrolledCourseIds]);

  const getTypeIcon = (type: Announcement['type']) => {
    switch (type) {
      case 'Warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'Promotion':
        return <PartyPopper className="h-4 w-4 text-emerald-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getTypeBadgeVariant = (type: Announcement['type']) => {
    switch (type) {
      case 'Warning':
        return 'secondary';
      case 'Promotion':
        return 'default';
      default:
        return 'outline';
    }
  };

  if (isLoading || isProfileLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline">Announcements</h1>
        <p className="text-muted-foreground mt-1">Latest platform and course updates for your learning.</p>
      </div>

      <Card className="border-none shadow-lg">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Updates Feed
          </CardTitle>
          <CardDescription>Important announcements from tutors and platform admins.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {announcements.length > 0 ? (
            <div className="divide-y">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="p-5 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getTypeIcon(announcement.type)}
                      <p className="font-bold text-sm truncate">{announcement.title}</p>
                      {isAnnouncementNew(announcement.date, lastSeenBeforeOpen) && (
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-destructive" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isAnnouncementNew(announcement.date, lastSeenBeforeOpen) && (
                        <Badge variant="destructive" className="text-[10px] font-bold uppercase">
                          New
                        </Badge>
                      )}
                      <Badge variant={getTypeBadgeVariant(announcement.type)} className="text-[10px] font-bold">
                        {announcement.type}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{announcement.message}</p>
                  <p className="text-[10px] mt-3 text-muted-foreground uppercase tracking-wide">
                    {new Date(announcement.date).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16">
              <EmptyState
                icon={<Megaphone className="h-12 w-12 text-muted-foreground/30" />}
                title="No announcements yet"
                description="You will see updates from your tutors and the platform here."
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
