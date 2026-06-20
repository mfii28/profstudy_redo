'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, BookOpen, DollarSign, Shield, BarChart2, Star, TrendingUp, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
} from 'recharts';
import type { Review } from '@/lib/db';
import { useUser } from '@/firebase';
import { getAdminAnalyticsOverview } from '@/app/actions/admin-analytics';
import { useToast } from '@/hooks/use-toast';

function StatCard({ icon, title, value, description, isLoading }: { icon: React.ReactNode, title: string, value: string, description?: string, isLoading: boolean }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <div className="text-muted-foreground">{icon}</div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <Skeleton className="h-8 w-3/4" />
                ) : (
                    <>
                        <div className="text-2xl font-bold">{value}</div>
                        {description && <p className="text-xs text-muted-foreground">{description}</p>}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

const starRow = (n: number) => Array.from({ length: 5 }, (_, i) => (
    <Star key={i} size={10} className={i < n ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20'} />
));

export default function AnalyticsOverviewPage() {
    const { user, isLoading: authLoading } = useUser();
    const { toast } = useToast();
    const [stats, setStats] = useState({
        activeUsers: 0,
        avgEngagement: '0 min',
        totalSubscriptions: 0,
        retentionRate: '0%',
    });
    const [trendData, setTrendData] = useState<{ label: string; count: number }[]>([]);
    const [recentReviews, setRecentReviews] = useState<Review[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchAnalytics = useCallback(async () => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const idToken = await user.getIdToken();
            const result = await getAdminAnalyticsOverview(idToken);
            if (result.error) {
                throw new Error(result.error);
            }

            setStats({
                activeUsers: result.activeUsers,
                avgEngagement: result.avgEngagement,
                totalSubscriptions: result.totalSubscriptions,
                retentionRate: result.retentionRate,
            });

            setTrendData(result.trendData);
            setRecentReviews(result.recentReviews as Review[]);
        } catch (error) {
            console.error("Analytics fetch error:", error);
            toast({
                variant: 'destructive',
                title: 'Analytics unavailable',
                description: error instanceof Error ? error.message : 'Failed to load analytics overview.',
            });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        if (!authLoading) {
            fetchAnalytics();
        }
    }, [authLoading, fetchAnalytics]);

    const avgRating = recentReviews.length
        ? (recentReviews.reduce((s, r) => s + r.rating, 0) / recentReviews.length).toFixed(1)
        : '—';

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <BarChart2 className="h-8 w-8" />
                    <div>
                        <h1 className="text-3xl font-bold mb-1 font-headline">Analytics Overview</h1>
                        <p className="text-muted-foreground text-sm">
                            High-level view of your platform&apos;s performance and user engagement.
                        </p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={isLoading} className="gap-2">
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
                <StatCard isLoading={isLoading} icon={<Users />} title="Total Active Users" value={stats.activeUsers.toLocaleString()} description="Current active accounts" />
                <StatCard isLoading={isLoading} icon={<BookOpen />} title="Avg. Engagement Time" value={stats.avgEngagement} description="Daily average per student" />
                <StatCard isLoading={isLoading} icon={<DollarSign />} title="Total Subscriptions" value={stats.totalSubscriptions.toLocaleString()} description="Lifetime active passes" />
                <StatCard isLoading={isLoading} icon={<Shield />} title="Student Retention" value={stats.retentionRate} description="Engaged vs Registered" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><TrendingUp size={16} /> Registration Trend</CardTitle>
                        <CardDescription>New user registrations over the last 14 days.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <Skeleton className="h-48 w-full" />
                        ) : (
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={trendData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                        formatter={(v: number) => [v, 'New Users']}
                                    />
                                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Star size={16} /> Recent Review Insights</CardTitle>
                        <CardDescription>Latest course reviews · Avg rating: <strong>{avgRating}</strong></CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                        ) : recentReviews.length > 0 ? (
                            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                                {recentReviews.map(r => (
                                    <div key={r.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                                        <div className="flex gap-0.5 mt-0.5 shrink-0">{starRow(r.rating)}</div>
                                        <div className="min-w-0">
                                            <p className="text-xs text-muted-foreground truncate">{r.text}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Badge variant="outline" className="text-[9px] px-1">{r.course}</Badge>
                                                <span className="text-[10px] text-muted-foreground">{new Date(r.date).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">No reviews yet.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Real-Time Platform Performance</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        The metrics shown above are calculated directly from the platform&apos;s live user registry and financial ledger. Retention is determined by measuring the ratio of students with active course enrollments against the total user base. Engagement time is an estimation based on aggregate study streaks and historical session frequency.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
