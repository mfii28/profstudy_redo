'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Filter, Loader2, Info, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUsers } from '@/lib/user-data';
import { format, startOfWeek, subWeeks, differenceInWeeks, parseISO } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

type CohortRow = {
    date: Date;
    week: string;
    total: number;
    retention: number[]; // Index represents weeks since signup
}

export default function CohortAnalysisPage() {
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const calculateCohorts = useCallback(async () => {
    setIsLoading(true);
    try {
        const { users } = await getUsers();
        const now = new Date();
        const numWeeks = 8; // Analyze the last 8 weeks
        
        const rows: CohortRow[] = [];
        
        // 1. Generate cohort start dates (Mondays)
        for (let i = 0; i < numWeeks; i++) {
            const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
            const weekEnd = subWeeks(now, i - 1); // Not inclusive of next week start
            
            // Users who joined this specific week
            const cohortUsers = users.filter(u => {
                const signup = u.createdAt ? parseISO(u.createdAt) : new Date(0); 
                return signup >= weekStart && signup < weekEnd;
            });

            if (cohortUsers.length === 0) continue;

            const retention: number[] = [];
            // Calculate retention for subsequent weeks (0 to 7)
            for (let weekOffset = 0; weekOffset < numWeeks; weekOffset++) {
                const targetWeekStart = startOfWeek(subWeeks(now, i - weekOffset), { weekStartsOn: 1 });
                
                if (targetWeekStart > now) {
                    retention.push(-1); // Future week
                    continue;
                }

                const activeUsersInWeek = cohortUsers.filter(u => {
                    if (!u.lastActive) return false;
                    const lastActive = parseISO(u.lastActive);
                    // User is retained if they were active AT OR AFTER this week offset
                    const weeksActiveSinceSignup = differenceInWeeks(lastActive, weekStart);
                    return weeksActiveSinceSignup >= weekOffset;
                }).length;

                retention.push(Math.round((activeUsersInWeek / cohortUsers.length) * 100));
            }

            rows.push({
                date: weekStart,
                week: format(weekStart, 'MMM dd'),
                total: cohortUsers.length,
                retention
            });
        }

        // Sort by date (descending)
        const sortedRows = rows.sort((a, b) => b.date.getTime() - a.date.getTime());
        setCohorts(sortedRows);

        // Prepare Chart Data (Average retention per week since signup)
        const trendData = Array.from({ length: numWeeks }).map((_, weekIdx) => {
            const activeCohorts = sortedRows.filter(r => r.retention[weekIdx] !== -1);
            const avg = activeCohorts.length > 0 
                ? activeCohorts.reduce((sum, r) => sum + r.retention[weekIdx], 0) / activeCohorts.length
                : 0;
            return {
                week: `Week ${weekIdx}`,
                retention: Math.round(avg)
            }
        });
        setChartData(trendData);

    } catch (error) {
        console.error("Cohort calculation error:", error);
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    calculateCohorts();
  }, [calculateCohorts]);

  const getHeatmapColor = (value: number) => {
      if (value === -1) return 'bg-transparent';
      if (value >= 80) return 'bg-green-600 text-white';
      if (value >= 60) return 'bg-green-500/80 text-white';
      if (value >= 40) return 'bg-green-400/60 text-green-950';
      if (value >= 20) return 'bg-green-200 text-green-900';
      if (value > 0) return 'bg-green-50 text-green-800';
      return 'bg-slate-100 text-slate-400';
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
                <Users className="h-8 w-8" />
            </div>
            <div>
                <h1 className="text-3xl font-bold mb-1 font-headline">Cohort Analysis</h1>
                <p className="text-muted-foreground text-sm">
                    Measure user &quot;stickiness&quot; by tracking how cohorts return to Profs Training Solutions week after week.
                </p>
            </div>
        </div>
        <Button variant="outline" className="gap-2" disabled={isLoading}>
            <Filter size={16} />
            Filter by Date Range
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8">
        <div className="space-y-8">
            <Card className="border-none shadow-lg overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="flex items-center gap-2">
                        <TrendingUp size={18} className="text-primary" />
                        Average Retention Curve
                    </CardTitle>
                    <CardDescription>Visualizing how many students remain active over an 8-week lifecycle.</CardDescription>
                </CardHeader>
                <CardContent className="pt-10">
                    <div className="h-[300px] w-full">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                                    <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        formatter={(v) => [`${v}%`, 'Retention']}
                                    />
                                    <Line type="monotone" dataKey="retention" stroke="hsl(var(--primary))" strokeWidth={4} dot={{ r: 6, fill: 'white', strokeWidth: 2, stroke: 'hsl(var(--primary))' }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-lg overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                    <CardTitle>User Retention by Signup Week</CardTitle>
                    <CardDescription>Heatmap showing percentage of active users relative to their signup cohort size.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    {isLoading ? (
                        <div className="p-20 flex justify-center items-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-muted/10">
                                <TableRow>
                                    <TableHead className="pl-6 w-[150px]">Cohort</TableHead>
                                    <TableHead className="w-[100px]">Size</TableHead>
                                    {[...Array(8)].map((_, i) => (
                                        <TableHead key={i} className="text-center font-mono text-[10px] uppercase">Week {i}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cohorts.map((row, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="pl-6 font-bold text-sm">{row.week}</TableCell>
                                        <TableCell className="text-muted-foreground">{row.total} users</TableCell>
                                        {row.retention.map((val, weekIdx) => (
                                            <TableCell key={weekIdx} className="p-1">
                                                <div className={cn(
                                                    "h-10 w-full flex items-center justify-center text-xs font-bold rounded-sm transition-all",
                                                    getHeatmapColor(val)
                                                )}>
                                                    {val !== -1 ? `${val}%` : '-'}
                                                </div>
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>

        <aside className="space-y-6">
            <Card className="bg-slate-900 text-white border-none shadow-xl">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Info size={18} className="text-accent" />
                        Analytic Insight
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs leading-relaxed text-slate-300">
                    <p>A cohort is defined as all students who signed up within the same calendar week.</p>
                    <p><strong>Retention</strong> is the percentage of users from a cohort who performed at least one action (logged in, studied, or purchased) during or after the target week.</p>
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10 italic">
                        &quot;Healthy platforms typically see a Week 4 retention of &gt;35%. If your heatmap shows deep reds in the later weeks, consider sending an AI-powered re-engagement broadcast.&quot;
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-bold">Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-xs text-muted-foreground">Highest Retention</span>
                        <span className="font-bold text-success text-sm">
                            {cohorts.length > 0 ? Math.max(...cohorts.flatMap(c => c.retention.filter(v => v !== -1))) : 0}%
                        </span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-2">
                        <span className="text-xs text-muted-foreground">Avg. Week 1 Drop-off</span>
                        <span className="font-bold text-destructive text-sm">
                            {chartData.length > 1 ? (100 - chartData[1].retention) : 0}%
                        </span>
                    </div>
                </CardContent>
            </Card>
        </aside>
      </div>
    </div>
  );
}
