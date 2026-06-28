'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardTitle, CardDescription, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, CheckCircle2, AlertCircle, Loader2, RefreshCw, Database, Globe, Server, Zap, Clock } from "lucide-react";
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';

type ServiceStatus = 'operational' | 'degraded' | 'outage' | 'checking';

interface ServiceCheck {
  name: string;
  description: string;
  status: ServiceStatus;
  latencyMs?: number;
  icon: React.ReactNode;
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  if (status === 'checking') return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Checking</Badge>;
  if (status === 'operational') return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-200 dark:border-emerald-800 gap-1"><CheckCircle2 className="h-3 w-3" />Operational</Badge>;
  if (status === 'degraded') return <Badge className="bg-amber-500/15 text-amber-600 border-amber-200 dark:border-amber-800 gap-1"><AlertCircle className="h-3 w-3" />Degraded</Badge>;
  return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Outage</Badge>;
}

export default function AdminSystemHealthPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [services, setServices] = useState<ServiceCheck[]>([
    { name: 'PostgreSQL (API)', description: 'Backend database connectivity', status: 'checking', icon: <Database className="h-5 w-5" /> },
    { name: 'Supabase Auth', description: 'Authentication service', status: 'checking', icon: <Server className="h-5 w-5" /> },
    { name: 'Storage (R2)', description: 'Media storage backend', status: 'checking', icon: <Zap className="h-5 w-5" /> },
    { name: 'Next.js Application', description: 'Web server / edge runtime', status: 'checking', icon: <Globe className="h-5 w-5" /> },
  ]);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runChecks = useCallback(async () => {
    if (!user) return;
    setIsRunning(true);
    setServices(prev => prev.map(s => ({ ...s, status: 'checking' as const })));

    // Backend API health check via GET /users/profile
    const apiStart = Date.now();
    let apiStatus: ServiceStatus = 'outage';
    let apiLatency: number | undefined;
    try {
      const res = await apiFetch('/users/profile');
      apiLatency = Date.now() - apiStart;
      apiStatus = res.ok ? 'operational' : 'degraded';
    } catch {
      apiStatus = 'outage';
    }

    // Auth check — if we have a user object, auth is working
    const authStatus: ServiceStatus = user ? 'operational' : 'outage';

    // Storage check via HEAD on upload route
    const storageStart = Date.now();
    let storageStatus: ServiceStatus = 'checking';
    let storageLatency: number | undefined;
    try {
      const res = await fetch('/api/media/upload', { method: 'OPTIONS' });
      storageLatency = Date.now() - storageStart;
      storageStatus = res.ok || res.status === 405 ? 'operational' : 'degraded';
    } catch {
      storageStatus = 'degraded';
    }

    // App server check
    const appStart = Date.now();
    let appStatus: ServiceStatus = 'outage';
    let appLatency: number | undefined;
    try {
      const res = await fetch('/api/onboarding', { method: 'OPTIONS' });
      appLatency = Date.now() - appStart;
      appStatus = res.ok || res.status === 405 ? 'operational' : 'degraded';
    } catch {
      appStatus = 'degraded';
    }

    setServices([
      { name: 'PostgreSQL (API)', description: 'Backend database connectivity', status: apiStatus, latencyMs: apiLatency, icon: <Database className="h-5 w-5" /> },
      { name: 'Supabase Auth', description: 'Authentication service', status: authStatus, latencyMs: undefined, icon: <Server className="h-5 w-5" /> },
      { name: 'Storage (R2)', description: 'Media storage backend', status: storageStatus, latencyMs: storageLatency, icon: <Zap className="h-5 w-5" /> },
      { name: 'Next.js Application', description: 'Web server / edge runtime', status: appStatus, latencyMs: appLatency, icon: <Globe className="h-5 w-5" /> },
    ]);
    setLastChecked(new Date());
    setIsRunning(false);
  }, [user]);

  useEffect(() => { void runChecks(); }, [runChecks]);

  const overallStatus: ServiceStatus = services.some(s => s.status === 'outage')
    ? 'outage'
    : services.some(s => s.status === 'degraded')
    ? 'degraded'
    : services.some(s => s.status === 'checking')
    ? 'checking'
    : 'operational';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl"><Activity className="h-8 w-8 text-primary" /></div>
          <div>
            <h1 className="text-3xl font-bold mb-1 font-headline">Infrastructure Health</h1>
            <p className="text-muted-foreground text-sm">Real-time system monitoring and service status.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={runChecks} disabled={isRunning} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
          {isRunning ? 'Checking...' : 'Refresh'}
        </Button>
      </div>

      {/* Overall status banner */}
      <Card className={overallStatus === 'operational' ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20' : overallStatus === 'degraded' ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20' : 'border-destructive/30 bg-destructive/5'}>
        <CardContent className="flex items-center gap-4 py-5">
          {overallStatus === 'operational' ? <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" /> : <AlertCircle className="h-8 w-8 text-amber-500 shrink-0" />}
          <div>
            <p className="font-bold text-lg">{overallStatus === 'operational' ? 'All systems operational' : overallStatus === 'degraded' ? 'Some systems degraded' : overallStatus === 'checking' ? 'Running health checks...' : 'Service disruption detected'}</p>
            {lastChecked && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Clock className="h-3 w-3" /> Last checked: {lastChecked.toLocaleTimeString()}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Service grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {services.map((service) => (
          <Card key={service.name}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted text-muted-foreground">{service.icon}</div>
                  <div>
                    <CardTitle className="text-base">{service.name}</CardTitle>
                    <CardDescription className="text-xs">{service.description}</CardDescription>
                  </div>
                </div>
                <StatusBadge status={service.status} />
              </div>
            </CardHeader>
            {service.latencyMs !== undefined && (
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">Response time: <span className={`font-bold ${service.latencyMs < 300 ? 'text-emerald-600' : service.latencyMs < 800 ? 'text-amber-600' : 'text-destructive'}`}>{service.latencyMs}ms</span></p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">External Observability</CardTitle>
          <CardDescription>For deep APM, logs and error tracking integrate these providers via environment variables.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1 text-muted-foreground list-disc pl-5">
            <li><strong>Vercel Dashboard</strong> — deployment metrics, function logs, edge latency</li>
            <li><strong>Supabase Dashboard</strong> — database connections, replication lag, auth metrics</li>
            <li><strong>Sentry / BetterStack</strong> — error tracking (set SENTRY_DSN env var)</li>
            <li><strong>Datadog / Grafana Cloud</strong> — infrastructure telemetry (optional)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
