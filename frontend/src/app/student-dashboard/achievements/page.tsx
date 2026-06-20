'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/firebase';
import { getAchievements } from '@/lib/achievements-data';
import type { Achievement } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Trophy, Lock, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return null; }
}

function AchievementSkeleton() {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <Skeleton className="h-12 w-12 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AchievementsPage() {
  const { user } = useUser();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    getAchievements(user.uid)
      .then(setAchievements)
      .finally(() => setIsLoading(false));
  }, [user]);

  const unlocked = achievements.filter(a => a.isUnlocked);
  const locked = achievements.filter(a => !a.isUnlocked);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold font-headline mb-1">Achievements</h1>
          <p className="text-muted-foreground text-sm">Earn badges by completing courses and reaching milestones.</p>
        </div>
        {!isLoading && achievements.length > 0 && (
          <Badge className="text-base px-4 py-1.5">
            <Trophy className="h-4 w-4 mr-1.5" />
            {unlocked.length} / {achievements.length} Unlocked
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <AchievementSkeleton key={i} />)}</div>
      ) : achievements.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-10 w-10" />}
          title="No achievements yet"
          description="Complete courses and engage with the platform to earn your first badge."
          action={<Link href="/student-dashboard/browse-courses"><Button>Browse Courses</Button></Link>}
        />
      ) : (
        <div className="space-y-3">
          {unlocked.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Unlocked</h2>
              {unlocked.map(achievement => (
                <Card key={achievement.id} className="border-none shadow-sm border-l-4 border-l-amber-400">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center text-2xl shrink-0">
                      {achievement.icon || '🏆'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold">{achievement.title}</p>
                      <p className="text-sm text-muted-foreground">{achievement.description}</p>
                      {achievement.date && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" /> Earned {formatDate(achievement.date)}
                        </p>
                      )}
                    </div>
                    <Badge className="bg-amber-500/15 text-amber-700 border-amber-200 shrink-0">Earned</Badge>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}
          {locked.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-4">Locked</h2>
              {locked.map(achievement => (
                <Card key={achievement.id} className={cn('border-none shadow-sm opacity-60')}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Lock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-muted-foreground">{achievement.title}</p>
                      <p className="text-sm text-muted-foreground">{achievement.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
