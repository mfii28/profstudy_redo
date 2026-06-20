'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, Calendar, Clock, Tv, Loader2, ExternalLink } from 'lucide-react';
import { getLiveClassesForStudent } from '@/lib/live-class-data';
import { getLiveSessionJoinUrlApi } from '@/lib/live-session-api';
import { useEffect, useState } from 'react';
import { type LiveClass } from '@/lib/db';
import { isLiveSessionJoinable, resolveLiveSessionUiStatus } from '@/lib/live-session-status';
import { useFirestore, useUser } from '@/firebase';
import { useStudentProfile } from '@/hooks/use-student-profile';
import { useToast } from '@/hooks/use-toast';

export default function LiveClassesPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { profile, isLoading: isProfileLoading } = useStudentProfile();
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);

  useEffect(() => {
    const fetchLiveClasses = async () => {
      if (!firestore || !profile) return;
      setIsLoading(true);
      try {
        const data = await getLiveClassesForStudent(
          firestore,
          (profile.enrollments || []).map((enrollment) => enrollment.courseId)
        );
        setLiveClasses(data);
      } catch (error) {
        console.error('Failed to fetch live classes:', error);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchLiveClasses();
  }, [firestore, profile]);

  const handleJoin = async (session: LiveClass) => {
    if (!user) return;
    setJoiningSessionId(session.id);
    try {
      const idToken = await user.getIdToken();
      const result = await getLiveSessionJoinUrlApi(idToken, session.id);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to get meeting link. Please try again.' });
    } finally {
      setJoiningSessionId(null);
    }
  };
  
  const nowMs = Date.now();

  const liveNowClasses = liveClasses
    .filter((c) => isLiveSessionJoinable(c, nowMs))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const scheduledClasses = liveClasses
    .filter((c) => resolveLiveSessionUiStatus(c, nowMs) === 'scheduled')
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const pastClasses = liveClasses
    .filter((c) => resolveLiveSessionUiStatus(c, nowMs) === 'ended')
    .sort((a, b) => b.startTime.localeCompare(a.startTime));

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return {
      date: date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      }),
    };
  };

  if (isLoading || isProfileLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 font-headline">Live Classes</h1>
        <p className="text-muted-foreground">
          Join real-time sessions and review your past class history.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live &amp; scheduled</CardTitle>
          <CardDescription>
            <strong>Join Session</strong> is only enabled during the live time window. Scheduled sessions show &quot;No active session&quot; until then.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {liveNowClasses.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Live now</p>
              {liveNowClasses.map((item) => {
                const { date, time } = formatDateTime(item.startTime);
                return (
                  <Card
                    key={item.id}
                    className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-emerald-500/30 bg-emerald-500/5"
                  >
                    <div>
                      <p className="font-bold text-lg">{item.title}</p>
                      <p className="text-sm text-muted-foreground">with {item.instructor}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" /> {date}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" /> {time}
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleJoin(item)}
                      disabled={joiningSessionId === item.id}
                      className="gap-2"
                    >
                      {joiningSessionId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ExternalLink className="h-4 w-4" />
                      )}
                      Join Session
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
          <div className="space-y-3">
            {scheduledClasses.length > 0 ? (
              scheduledClasses.map((item) => {
                const { date, time } = formatDateTime(item.startTime);
                return (
                  <Card
                    key={item.id}
                    className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                  >
                    <div>
                      <p className="font-bold text-lg">{item.title}</p>
                      <p className="text-sm text-muted-foreground">with {item.instructor}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-4 w-4" /> {date}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" /> {time}
                        </span>
                      </div>
                    </div>
                    <Button type="button" variant="secondary" disabled className="cursor-not-allowed">
                      No active session
                    </Button>
                  </Card>
                );
              })
            ) : liveNowClasses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="mx-auto h-12 w-12 mb-4" />
                <p>No live or scheduled sessions for your courses.</p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Past Classes</CardTitle>
          <CardDescription>
            A log of all completed sessions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pastClasses.length > 0 ? (
            pastClasses.map((item) => {
              const { date, time } = formatDateTime(item.startTime);
              return (
                <Card
                  key={item.id}
                  className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                >
                  <div>
                    <p className="font-bold text-lg">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      with {item.instructor}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" /> {date}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" /> {time}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary">Completed</Badge>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Tv className="mx-auto h-12 w-12 mb-4" />
              <p>No past classes yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
