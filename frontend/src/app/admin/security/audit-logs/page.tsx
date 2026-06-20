'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollText, Search, Loader2, ShieldCheck, AlertTriangle, Info, RefreshCw, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getAuditLogs } from '@/lib/audit-data';
import { type AuditLog } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/dashboard/empty-state';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'info' | 'warn' | 'critical'>('all');

  const fetchData = async () => {
    setIsLoading(true);
    const data = await getAuditLogs();
    setLogs(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getSeverityIcon = (severity: AuditLog['severity']) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'warn': return <Info className="h-4 w-4 text-yellow-500" />;
      default: return <ShieldCheck className="h-4 w-4 text-green-500" />;
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
    
    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="space-y-8">
       <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
                <ScrollText className="h-8 w-8 text-primary" />
            </div>
            <div>
                <h1 className="text-3xl font-bold mb-1 font-headline">Security Audit Trail</h1>
                <p className="text-muted-foreground text-sm">
                    Complete immutable log of all administrative actions sitewide.
                </p>
            </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search actions or staff..." 
                    className="pl-9 bg-background"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Select value={severityFilter} onValueChange={(v: any) => setSeverityFilter(v)}>
                <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="All Severities" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="info">Info Only</SelectItem>
                    <SelectItem value="warn">Warnings</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchData} disabled={isLoading}>
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
        </div>
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle>Master Audit Ledger</CardTitle>
          <CardDescription>
            Records are retained for compliance. Non-repudiation is enforced for financial and security operations.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
             {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Pulling Ledger Records...</p>
                </div>
             ) : filteredLogs.length > 0 ? (
                <Table>
                    <TableHeader className="bg-muted/10">
                        <TableRow>
                            <TableHead className="pl-6">Timestamp</TableHead>
                            <TableHead>Administrator</TableHead>
                            <TableHead>Operation</TableHead>
                            <TableHead>Target</TableHead>
                            <TableHead>Outcome Details</TableHead>
                            <TableHead className="text-right pr-6">Severity</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLogs.map(log => (
                            <TableRow key={log.id} className="hover:bg-muted/5 transition-colors group">
                                <TableCell className="pl-6 text-xs font-mono">
                                    {new Date(log.timestamp).toLocaleString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </TableCell>
                                <TableCell>
                                    <p className="font-bold text-sm">{log.actorName}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase font-mono">{log.actorId.substring(0, 8)}</p>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="capitalize text-[10px] font-bold">
                                        {log.action.replace(/_/g, ' ')}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">{log.targetType}</span>
                                        <span className="text-xs font-mono text-primary font-bold">{log.targetId.substring(0, 12)}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground italic">
                                    {log.details}
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                    <div className="flex justify-end">
                                        {getSeverityIcon(log.severity)}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             ) : (
                <div className="py-32">
                    <EmptyState 
                        icon={<ScrollText className="h-16 w-16 text-muted-foreground/20" />}
                        title="No audit entries found"
                        description={searchTerm || severityFilter !== 'all' ? "Try adjusting your filters to see more results." : "The audit ledger is currently empty."}
                    />
                </div>
             )}
        </CardContent>
      </Card>
    </div>
  );
}
