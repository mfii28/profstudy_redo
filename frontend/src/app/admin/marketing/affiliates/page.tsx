'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Share2, 
  PlusCircle, 
  Search, 
  Loader2, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Users, 
  TrendingUp,
  Percent,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { type Affiliate } from '@/lib/db';
import { getAffiliates, saveAffiliate, removeAffiliate } from '@/lib/affiliate-data';
import { EmptyState } from '@/components/dashboard/empty-state';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(amount);
}

export default function AdminAffiliatesPage() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  // Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<Partial<Affiliate> | null>(null);
  const [affiliateToDelete, setAffiliateToDelete] = useState<Affiliate | null>(null);

  const fetchAffiliatesData = async () => {
    setIsLoading(true);
    const data = await getAffiliates();
    setAffiliates(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAffiliatesData();
  }, []);

  const handleOpenEditor = (affiliate?: Affiliate) => {
    setEditingAffiliate(affiliate || {
      id: `aff-${Date.now()}`,
      name: '',
      email: '',
      referrals: 0,
      cashbackPercent: 10,
      totalEarnings: 0,
      status: 'active',
      joinedDate: new Date().toISOString()
    });
    setIsEditorOpen(true);
  };

  const handleSaveAffiliate = () => {
    if (!editingAffiliate?.name || !editingAffiliate?.email) {
      toast({ variant: 'destructive', title: 'Name and Email are required.' });
      return;
    }

    const finalAffiliate = editingAffiliate as Affiliate;
    saveAffiliate(finalAffiliate);

    // Optimistic UI update
    setAffiliates(prev => {
      const exists = prev.find(a => a.id === finalAffiliate.id);
      if (exists) {
        return prev.map(a => a.id === finalAffiliate.id ? finalAffiliate : a);
      }
      return [finalAffiliate, ...prev];
    });

    setIsEditorOpen(false);
    toast({ title: "Affiliate Saved", description: "The referral partner data has been synchronized." });
  };

  const handleDeleteAffiliate = () => {
    if (!affiliateToDelete) return;
    removeAffiliate(affiliateToDelete.id);
    setAffiliates(prev => prev.filter(a => a.id !== affiliateToDelete.id));
    setAffiliateToDelete(null);
    toast({ title: "Affiliate Removed", variant: "destructive" });
  };

  const toggleStatus = (affiliate: Affiliate) => {
    const newStatus = affiliate.status === 'active' ? 'inactive' : 'active';
    const updated = { ...affiliate, status: newStatus as 'active' | 'inactive' };
    saveAffiliate(updated);
    setAffiliates(prev => prev.map(a => a.id === affiliate.id ? updated : a));
    toast({ title: `Partner ${newStatus === 'active' ? 'Activated' : 'Suspended'}` });
  };

  const filteredAffiliates = affiliates.filter(a => 
    (a.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
                <Share2 className="h-8 w-8 text-primary" />
            </div>
            <div>
                <h1 className="text-3xl font-bold mb-1 font-headline">Cashback Partner Portal</h1>
                <p className="text-muted-foreground text-sm">
                    Manage the referral program, partner cashback rates, and performance for referral payouts.
                </p>
            </div>
        </div>
        <Button onClick={() => handleOpenEditor()} className="gap-2 shadow-lg">
            <PlusCircle className="h-4 w-4" />
            Add Cashback Partner
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users size={16} className="text-muted-foreground" />
                      Total Partners
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-2xl font-bold">{affiliates.length}</p>
              </CardContent>
          </Card>
          <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp size={16} className="text-muted-foreground" />
                      Total Referrals
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-2xl font-bold">{affiliates.reduce((sum, a) => sum + a.referrals, 0)}</p>
              </CardContent>
          </Card>
          <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Percent size={16} className="text-muted-foreground" />
                      Avg. Cashback Rate
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-2xl font-bold">
                      {affiliates.length > 0 ? (affiliates.reduce((sum, a) => sum + a.cashbackPercent, 0) / affiliates.length).toFixed(1) : 0}%
                  </p>
              </CardContent>
          </Card>
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 border-b p-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                    <CardTitle>Partner Registry</CardTitle>
                    <CardDescription>Track conversions and manage payouts for your marketing network.</CardDescription>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search partners..." 
                        className="pl-9 bg-background" 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : filteredAffiliates.length > 0 ? (
                <Table>
                    <TableHeader className="bg-muted/10">
                        <TableRow>
                            <TableHead className="pl-6">Partner</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Referrals</TableHead>
                            <TableHead>Cashback Rate</TableHead>
                            <TableHead>Earnings</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAffiliates.map(affiliate => (
                            <TableRow key={affiliate.id} className="hover:bg-muted/5 transition-colors group">
                                <TableCell className="pl-6 py-4">
                                    <p className="font-bold text-sm">{affiliate.name || 'Anonymous'}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">{affiliate.email || 'No Email'}</p>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={affiliate.status === 'active' ? 'default' : 'secondary'} className="text-[10px] h-5 uppercase">
                                        {affiliate.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-bold">{affiliate.referrals}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1 font-mono text-xs">
                                        <Percent size={12} className="text-muted-foreground" />
                                        {affiliate.cashbackPercent}%
                                    </div>
                                </TableCell>
                                <TableCell className="font-bold text-success">
                                    {formatCurrency(affiliate.totalEarnings)}
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={14}/></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuItem onClick={() => handleOpenEditor(affiliate)}>
                                                <Edit className="mr-2 h-4 w-4" /> Edit Details
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => toggleStatus(affiliate)}>
                                                {affiliate.status === 'active' ? <XCircle className="mr-2 h-4 w-4 text-destructive" /> : <CheckCircle2 className="mr-2 h-4 w-4 text-success" />}
                                                {affiliate.status === 'active' ? 'Suspend Partner' : 'Activate Partner'}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => setAffiliateToDelete(affiliate)} className="text-destructive focus:text-destructive">
                                                <Trash2 className="mr-2 h-4 w-4" /> Terminate Contract
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <div className="py-24">
                    <EmptyState 
                        icon={<Share2 className="h-16 w-16 text-muted-foreground/30" />}
                        title="No partners found"
                        description={searchQuery ? `No results for "${searchQuery}"` : "Build your growth network by adding your first affiliate partner."}
                        action={!searchQuery && <Button onClick={() => handleOpenEditor()}>Add First Partner</Button>}
                    />
                </div>
            )}
        </CardContent>
      </Card>

      {/* Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>{editingAffiliate?.name ? 'Edit Partner Details' : 'New Affiliate Partner'}</DialogTitle>
                <DialogDescription>Configure referral terms and contact info.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="aff-name">Full Name</Label>
                    <Input 
                        id="aff-name" 
                        value={editingAffiliate?.name || ''} 
                        onChange={e => setEditingAffiliate(prev => ({...prev!, name: e.target.value}))} 
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="aff-email">Email Address</Label>
                    <Input 
                        id="aff-email" 
                        type="email"
                        value={editingAffiliate?.email || ''} 
                        onChange={e => setEditingAffiliate(prev => ({...prev!, email: e.target.value}))} 
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="aff-rate">Cashback Rate (%)</Label>
                        <Input 
                            id="aff-rate" 
                            type="number"
                            value={editingAffiliate?.cashbackPercent || 0}
                            onChange={e => setEditingAffiliate(prev => ({...prev!, cashbackPercent: parseInt(e.target.value) || 0}))} 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="aff-status">Partner Status</Label>
                        <Select 
                            value={editingAffiliate?.status} 
                            onValueChange={v => setEditingAffiliate(prev => ({...prev!, status: v as any}))}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditorOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveAffiliate}>Save Partner</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={!!affiliateToDelete} onOpenChange={() => setAffiliateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate Affiliate Contract?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{affiliateToDelete?.name}" from your network. Their referral links will stop generating commissions. This action is irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Partner</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAffiliate} className="bg-destructive hover:bg-destructive/90">
                Terminate Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
