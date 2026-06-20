
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
    Building, 
    PlusCircle, 
    Search, 
    Loader2, 
    MoreHorizontal, 
    Trash2, 
    CheckCircle2, 
    XCircle,
    Edit
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Organization } from '@/lib/db';
import { getOrganizations, saveOrganization, deleteOrganization, updateOrganizationStatus } from '@/lib/organization-data';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/dashboard/empty-state';
import { useUser } from '@/firebase';
import { logAdminAction } from '@/lib/audit-data';

export default function AdminOrganizationsPage() {
  const { user: adminUser } = useUser();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  // Create/Edit State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Partial<Organization>>({
      name: '',
      contactPerson: '',
      contactEmail: '',
      studentSeats: 50,
      seatsUsed: 0,
      status: 'Active'
  });

  const fetchData = async () => {
    setIsLoading(true);
    const data = await getOrganizations();
    setOrgs(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!editingOrg.name || !editingOrg.contactEmail || !adminUser) return;
    setIsSaving(true);
    try {
        const id = editingOrg.id || `org-${Date.now()}`;
        const orgData: Organization = {
            ...editingOrg as Organization,
            id,
            createdAt: editingOrg.createdAt || new Date().toISOString()
        };
        
        await saveOrganization(orgData);
        
        await logAdminAction({
            actorId: adminUser.uid,
            actorName: adminUser.displayName || adminUser.email || 'Administrator',
            action: editingOrg.id ? 'ORG_UPDATE' : 'ORG_REGISTER',
            targetId: id,
            targetType: 'organization',
            severity: 'info',
            details: `${editingOrg.id ? 'Updated' : 'Registered'} firm: ${orgData.name} with ${orgData.studentSeats} seats.`
        });

        toast({ title: editingOrg.id ? "Partner Updated" : "Organization Registered" });
        setIsDialogOpen(false);
        fetchData();
    } catch (e) {
        toast({ variant: 'destructive', title: "Action Failed" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
      if (!adminUser) return;
      const org = orgs.find(o => o.id === id);
      await deleteOrganization(id);
      
      await logAdminAction({
          actorId: adminUser.uid,
          actorName: adminUser.displayName || adminUser.email || 'Administrator',
          action: 'ORG_DELETE',
          targetId: id,
          targetType: 'organization',
          severity: 'critical',
          details: `Permanently removed institutional partner: ${org?.name || id}.`
      });

      setOrgs(prev => prev.filter(o => o.id !== id));
      toast({ title: "Organization Removed", variant: "destructive" });
  };

  const toggleStatus = async (org: Organization) => {
      if (!adminUser) return;
      const newStatus = org.status === 'Active' ? 'Suspended' : 'Active';
      await updateOrganizationStatus(org.id, newStatus);
      
      await logAdminAction({
          actorId: adminUser.uid,
          actorName: adminUser.displayName || adminUser.email || 'Administrator',
          action: 'ORG_STATUS_CHANGE',
          targetId: org.id,
          targetType: 'organization',
          severity: 'warn',
          details: `Set ${org.name} status to ${newStatus}.`
      });

      setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, status: newStatus } : o));
      toast({ title: `Status set to ${newStatus}` });
  };

  const filtered = orgs.filter(o => 
    o.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10"><Building className="h-8 w-8 text-primary" /></div>
            <div>
                <h1 className="text-3xl font-bold mb-1 font-headline tracking-tight">Institutional Partners</h1>
                <p className="text-muted-foreground text-sm">
                    Manage B2B accounts, firms, and bulk student seat allocations.
                </p>
            </div>
        </div>
        <Button onClick={() => { setEditingOrg({ name: '', contactPerson: '', contactEmail: '', studentSeats: 50, seatsUsed: 0, status: 'Active' }); setIsDialogOpen(true); }} className="gap-2 shadow-lg">
            <PlusCircle size={18} />
            Register Firm
        </Button>
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 border-b p-6 flex flex-row items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search by firm name or email..." 
                className="pl-9 bg-background" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
            {isLoading ? (
                <div className="py-20 flex justify-center"><Loader2 className="animate-spin" /></div>
            ) : filtered.length > 0 ? (
                <Table>
                    <TableHeader className="bg-muted/10">
                        <TableRow>
                            <TableHead className="pl-6">Firm Name</TableHead>
                            <TableHead>Primary Contact</TableHead>
                            <TableHead>Seat Usage</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right pr-6">Management</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.map(org => (
                            <TableRow key={org.id} className="hover:bg-muted/5 transition-colors">
                                <TableCell className="pl-6 font-bold">{org.name}</TableCell>
                                <TableCell>
                                    <p className="text-sm">{org.contactPerson}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">{org.contactEmail}</p>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 w-24">
                                            <Progress value={(org.seatsUsed / org.studentSeats) * 100} className="h-1.5" />
                                        </div>
                                        <span className="text-[10px] font-black">{org.seatsUsed}/{org.studentSeats}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={org.status === 'Active' ? 'default' : 'secondary'} className="text-[10px]">{org.status}</Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal size={16}/></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48">
                                            <DropdownMenuItem onClick={() => { setEditingOrg(org); setIsDialogOpen(true); }}><Edit className="mr-2 h-4 w-4"/> Edit Firm Info</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => toggleStatus(org)}>
                                                {org.status === 'Active' ? <XCircle className="mr-2 h-4 w-4 text-destructive"/> : <CheckCircle2 className="mr-2 h-4 w-4 text-success"/>}
                                                {org.status === 'Active' ? 'Suspend Account' : 'Re-activate'}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(org.id)}><Trash2 className="mr-2 h-4 w-4"/> Delete Record</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
                <div className="py-20">
                    <EmptyState 
                        icon={<Building className="h-16 w-16 text-muted-foreground/30" />}
                        title="No organizations found"
                        description="Partner with firms and schools to scale Profs Training Solutions' reach."
                    />
                </div>
            )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingOrg.id ? 'Edit Firm Details' : 'Register New Partner'}</DialogTitle>
                <DialogDescription>Setup bulk enrollment parameters for this institution.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Organization Name</Label>
                    <Input value={editingOrg.name} onChange={e => setEditingOrg({...editingOrg, name: e.target.value})} placeholder="e.g. KPMG Ghana" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Contact Person</Label>
                        <Input value={editingOrg.contactPerson} onChange={e => setEditingOrg({...editingOrg, contactPerson: e.target.value})} placeholder="Ama Doe" />
                    </div>
                    <div className="space-y-2">
                        <Label>Contact Email</Label>
                        <Input value={editingOrg.contactEmail} onChange={e => setEditingOrg({...editingOrg, contactEmail: e.target.value})} placeholder="hr@firm.com" />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Allocated Student Seats</Label>
                    <Input type="number" value={editingOrg.studentSeats} onChange={e => setEditingOrg({...editingOrg, studentSeats: parseInt(e.target.value) || 0})} />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    {editingOrg.id ? 'Apply Changes' : 'Register Partner'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
