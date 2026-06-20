
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  AlertCircle, 
  Lock, 
  Loader2, 
  ArrowRight,
  PlusCircle,
  Trash2,
  Globe
} from "lucide-react";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogFooter, 
    DialogHeader, 
    DialogTitle 
} from "@/components/ui/dialog";
import {
  getAdminSecurityTelemetry,
  blockIpAdmin,
  unblockIpAdmin,
} from '@/app/actions/admin-security';
import { type User, type Order, type IpBlock } from '@/lib/db';
import { useUser } from '@/firebase';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { logAdminAction } from '@/lib/audit-data';

export default function AdminSecurityPage() {
  const { user: admin, isLoading: authLoading } = useUser();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [failedOrders, setFailedOrders] = useState<Order[]>([]);
  const [blocklist, setBlocklist] = useState<IpBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Block Modal State
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!admin) {
      setIsLoading(false);
      return;
    }

    const fetchSecurityData = async () => {
      setIsLoading(true);
      try {
        const idToken = await admin.getIdToken(true);
        const result = await getAdminSecurityTelemetry(idToken);
        if (result.error) {
          throw new Error(result.error);
        }

        setUsers(result.users);
        setBlocklist(result.blocklist);
        setFailedOrders(result.failedOrders);
      } catch (error) {
        console.error('Security data fetch error:', error);
        toast({
          variant: 'destructive',
          title: 'Security data unavailable',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to load security telemetry. Please refresh.',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSecurityData();
  }, [admin, authLoading, toast]);

  const handleBlockIp = async () => {
      if (!newIp || !admin) return;
      setIsBlocking(true);
      try {
          const idToken = await admin.getIdToken();
          const result = await blockIpAdmin(idToken, newIp, blockReason, admin.uid);
          if (!result.ok) {
            throw new Error(result.error);
          }

          await logAdminAction({
              actorId: admin.uid,
              actorName: admin.displayName || admin.email || 'Administrator',
              action: 'IP_BLOCK_CREATE',
              targetId: newIp,
              targetType: 'setting',
              severity: 'critical',
              details: `Banned IP address ${newIp}. Reason: ${blockReason || 'Unspecified security violation'}.`
          });

          toast({ title: 'IP Restricted', description: `${newIp} has been added to the firewall.` });
          setIsBlockDialogOpen(false);
          setNewIp('');
          setBlockReason('');
          setBlocklist((prev) => [result.block, ...prev]);
      } catch (e) {
          toast({
            variant: 'destructive',
            title: 'Rule Update Failed',
            description: e instanceof Error ? e.message : 'Could not block this IP.',
          });
      } finally {
          setIsBlocking(false);
      }
  };

  const handleUnblock = async (id: string) => {
      if (!admin) return;
      const block = blocklist.find(b => b.id === id);
      try {
        const idToken = await admin.getIdToken();
        const result = await unblockIpAdmin(idToken, id);
        if (!result.ok) {
          throw new Error(result.error);
        }

        await logAdminAction({
            actorId: admin.uid,
            actorName: admin.displayName || admin.email || 'Administrator',
            action: 'IP_BLOCK_REMOVE',
            targetId: block?.ip || id,
            targetType: 'setting',
            severity: 'warn',
            details: `Removed firewall restriction for IP: ${block?.ip || id}.`
        });

        setBlocklist(prev => prev.filter(b => b.id !== id));
        toast({ title: 'Rule Removed', variant: 'destructive' });
      } catch (e) {
        toast({
          variant: 'destructive',
          title: 'Rule Update Failed',
          description: e instanceof Error ? e.message : 'Could not remove this block.',
        });
      }
  };

  const suspendedCount = users.filter(u => u.status === 'suspended').length;
  const activeWithin24hCount = users.filter((user) => {
    if (!user.lastActive) return false;
    const lastActiveTime = new Date(user.lastActive).getTime();
    if (Number.isNaN(lastActiveTime)) return false;
    return Date.now() - lastActiveTime <= 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 font-headline tracking-tight">Security Command</h1>
          <p className="text-muted-foreground text-sm">Real-time platform integrity monitoring and firewall management.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={suspendedCount > 0 ? "destructive" : "outline"} className="h-8 px-3 gap-2">
            <ShieldAlert size={14} /> {suspendedCount} Suspended
          </Badge>
          <Badge variant="outline" className="h-8 px-3 gap-2 bg-green-50 text-green-700 border-green-200 font-bold">
            <ShieldCheck size={14} /> Monitoring Active
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900 text-white border-none shadow-xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
            <Lock size={80} />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-400">Policy Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <p className="text-xs text-slate-300 leading-relaxed">Centralized safety toggles and data retention policies for all Profs Training Solutions users.</p>
            <Button variant="outline" size="sm" className="w-full text-xs font-bold h-10 border-white/20 hover:bg-white/10" asChild>
              <Link href="/admin/settings/general">Configure Policies <ArrowRight size={14} className="ml-2"/></Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Session Audit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-black">{activeWithin24hCount}</p>
              <p className="text-xs text-muted-foreground pb-1 font-bold">Active (24h)</p>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <Button variant="outline" size="sm" className="w-full text-[10px] font-black h-8 uppercase" asChild>
              <Link href="/admin/security/devices">Open Device Map</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Blocked Traffic</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-black text-destructive">{blocklist.length}</p>
              <p className="text-xs text-muted-foreground pb-1 font-bold">Banned IPs</p>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <Button variant="outline" size="sm" className="w-full text-[10px] font-black h-8 uppercase" onClick={() => setIsBlockDialogOpen(true)}>
              Manage Blocklist
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
        <Card className="border-none shadow-lg overflow-hidden">
            <CardHeader className="border-b bg-muted/30 p-6 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-destructive" />
                        Firewall Blocklist
                    </CardTitle>
                    <CardDescription>Persistent IP restrictions enforced at the application level.</CardDescription>
                </div>
                <Button size="sm" className="gap-2" onClick={() => setIsBlockDialogOpen(true)}>
                    <PlusCircle size={14} /> Add Rule
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                {blocklist.length > 0 ? (
                    <div className="divide-y">
                        {blocklist.map(rule => (
                            <div key={rule.id} className="p-4 px-6 flex items-center justify-between hover:bg-muted/5 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 rounded-lg bg-muted text-muted-foreground"><Globe size={16}/></div>
                                    <div>
                                        <p className="font-mono text-sm font-bold">{rule.ip}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-black">{rule.reason}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] text-muted-foreground font-mono">{new Date(rule.timestamp).toLocaleDateString()}</span>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleUnblock(rule.id)}>
                                        <Trash2 size={14}/>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-20 text-center text-muted-foreground opacity-30">
                        <ShieldCheck size={48} className="mx-auto mb-2" />
                        <p className="font-bold uppercase tracking-widest text-xs">No active IP blocks</p>
                    </div>
                )}
            </CardContent>
        </Card>

        <Card className="border-none shadow-lg">
            <CardHeader className="border-b bg-muted/30">
                <div className="flex items-center justify-between">
                    <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        Live Fraud Monitor
                    </CardTitle>
                    <CardDescription className="text-xs">Unrecognized checkout sources.</CardDescription>
                    </div>
                    <Activity className="h-4 w-4 text-muted-foreground/30 animate-pulse" />
                </div>
            </CardHeader>
            <CardContent className="p-0">
            {isLoading ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin" /></div>
            ) : failedOrders.length > 0 ? (
                <div className="divide-y">
                {failedOrders.map((order) => (
                    <div key={order.id} className="p-4 px-6 flex items-center justify-between hover:bg-muted/10 transition-colors">
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase text-destructive mb-0.5">Suspicious Attempt</p>
                            <p className="text-xs font-bold truncate">ID: {order.orderId.substring(0, 8)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-black text-primary">GH₵{order.total}</p>
                            <p className="text-[9px] text-muted-foreground uppercase">{new Date(order.date).toLocaleTimeString()}</p>
                        </div>
                    </div>
                ))}
                </div>
            ) : (
                <div className="py-20 text-center text-muted-foreground text-xs italic">No suspicious activity detected.</div>
            )}
            </CardContent>
        </Card>
      </div>

      <Dialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Add Firewall Rule</DialogTitle>
                  <DialogDescription>Bans an IP address from accessing platform services. This will take effect immediately across all user sessions.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="space-y-2">
                      <Label>IP Address</Label>
                      <Input placeholder="e.g. 192.168.1.1" value={newIp} onChange={e => setNewIp(e.target.value)} className="font-mono" />
                  </div>
                  <div className="space-y-2">
                      <Label>Violation Type / Reason</Label>
                      <Input placeholder="e.g. Card testing, Account scraping" value={blockReason} onChange={e => setBlockReason(e.target.value)} />
                  </div>
              </div>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBlockDialogOpen(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={handleBlockIp} disabled={isBlocking || !newIp}>
                      {isBlocking ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                      Enforce Block
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
