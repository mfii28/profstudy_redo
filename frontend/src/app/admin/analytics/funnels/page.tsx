'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { TrendingUp, Loader2, ArrowRight, MousePointer2, RefreshCw, AlertCircle } from "lucide-react";
import {
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { getFunnelData } from "@/lib/analytics-data";
import { useEffect, useState, useCallback } from "react";
import { FunnelDataPoint } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function FunnelAnalysisPage() {
  const [data, setData] = useState<FunnelDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const funnelData = await getFunnelData();
    setData(funnelData);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
      setIsLoading(true);
      fetchData();
  }, [fetchData]);

  const calculateConversion = (currentIndex: number) => {
      if (currentIndex === 0 || data.length === 0) return 100;
      const prevValue = data[currentIndex - 1].value;
      const currentValue = data[currentIndex].value;
      if (prevValue === 0) return 0;
      return Math.round((currentValue / prevValue) * 100);
  };

  const getOverallConversion = () => {
      if (data.length < 2) return 0;
      const start = data[0].value;
      const end = data[data.length - 1].value;
      if (start === 0) return 0;
      return ((end / start) * 100).toFixed(2);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
                <TrendingUp className="h-8 w-8 text-primary" />
            </div>
            <div>
                <h1 className="text-3xl font-bold mb-1 font-headline">Content Performance Funnels</h1>
                <p className="text-muted-foreground text-sm">
                    Visualize the student journey from course discovery to completion.
                </p>
            </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading} className="gap-2">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Sync Metrics
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8">
        <div className="space-y-8">
            <Card className="border-none shadow-lg overflow-hidden">
                <CardHeader className="bg-muted/30 border-b p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Course Enrollment Funnel</CardTitle>
                            <CardDescription>
                                Conversion rate tracking from discovery to successful enrollment.
                            </CardDescription>
                        </div>
                        <Badge variant="secondary" className="px-3 py-1 font-bold">
                            Overall CR: {getOverallConversion()}%
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-10">
                    <div className="w-full h-[450px]">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4">
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                <p className="text-sm text-muted-foreground animate-pulse font-bold uppercase">Aggregating Ledger Events...</p>
                            </div>
                        ) : (
                            <ResponsiveContainer>
                                <FunnelChart>
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: number) => [value.toLocaleString(), 'Users']}
                                    />
                                    <Funnel
                                        dataKey="value"
                                        data={data}
                                        isAnimationActive
                                    >
                                        <LabelList 
                                            position="right" 
                                            fill="hsl(var(--foreground))" 
                                            stroke="none" 
                                            dataKey="name" 
                                            style={{ fontSize: '12px', fontWeight: 'bold' }}
                                        />
                                        {data.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Funnel>
                                </FunnelChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <MousePointer2 size={16} className="text-accent" />
                            Discovery Strength
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-black">{data.length > 2 ? calculateConversion(2) : 0}%</p>
                        <p className="text-xs text-muted-foreground mt-1">Users moving from signup to exploring courses.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <ArrowRight size={16} className="text-success" />
                            Enrollment Velocity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-black">{data.length > 3 ? calculateConversion(3) : 0}%</p>
                        <p className="text-xs text-muted-foreground mt-1">Conversion from discovery to paid enrollment.</p>
                    </CardContent>
                </Card>
            </div>
        </div>

        <aside className="space-y-6">
            <Card className="bg-slate-900 text-white border-none shadow-xl">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle size={18} className="text-accent" />
                        Conversion Analytics
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-white/5">
                        {!isLoading && data.map((step, idx) => (
                            <div key={idx} className="p-4 px-6">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{step.name}</span>
                                    <span className="text-sm font-mono font-bold">{step.value.toLocaleString()}</span>
                                </div>
                                {idx > 0 && (
                                    <div className="flex items-center gap-2">
                                        <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-accent" 
                                                style={{ width: `${calculateConversion(idx)}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-black text-accent">{calculateConversion(idx)}% Yield</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-primary text-primary-foreground border-none relative overflow-hidden">
                <div className="absolute right-0 top-0 p-8 opacity-10">
                    <TrendingUp size={100} />
                </div>
                <CardHeader>
                    <CardTitle className="text-sm font-bold">Optimization Tips</CardTitle>
                </CardHeader>
                <CardContent className="text-[11px] space-y-3 text-primary-foreground/70 leading-relaxed">
                    <p>• If <strong>Discovery</strong> is low, consider improving the &quot;New Course&quot; onboarding cards.</p>
                    <p>• If <strong>Enrollment</strong> is low, review the pricing strategy or offer a trial period for ICAG modules.</p>
                    <p>• High traffic with low signups suggests the landing page value proposition needs refinement.</p>
                </CardContent>
            </Card>
        </aside>
      </div>
    </div>
  );
}
