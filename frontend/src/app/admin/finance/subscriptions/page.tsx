'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
    Repeat, 
    PlusCircle, 
    Loader2, 
    Users, 
    Edit, 
    Trash2, 
    MoreHorizontal, 
    Save, 
    X,
    LayoutDashboard
} from "lucide-react";
import { 
    getSubscriptionPlans, 
    saveSubscriptionPlan, 
    deleteSubscriptionPlan 
} from '@/lib/finance-data';
import { type SubscriptionPlan } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
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

export default function AdminSubscriptionsPage() {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    // Editor State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Partial<SubscriptionPlan> | null>(null);
    const [featureInput, setFeatureInput] = useState('');

    // Delete State
    const [planToDelete, setPlanToDelete] = useState<SubscriptionPlan | null>(null);

    const fetchPlans = async () => {
        setIsLoading(true);
        try {
            const data = await getSubscriptionPlans();
            setPlans(data);
        } catch (error) {
            console.error("Fetch plans error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, []);

    const handleOpenDialog = (plan?: SubscriptionPlan) => {
        setEditingPlan(plan || {
            id: `plan-${Date.now()}`,
            name: '',
            price: '0',
            interval: 'month',
            activeSubscribers: 0,
            features: []
        });
        setFeatureInput('');
        setIsDialogOpen(true);
    };

    const handleSavePlan = () => {
        if (!editingPlan?.name || !editingPlan?.price) {
            toast({ variant: 'destructive', title: 'Missing Information' });
            return;
        }

        const finalPlan = editingPlan as SubscriptionPlan;
        saveSubscriptionPlan(finalPlan);

        // Optimistic UI update
        setPlans(prev => {
            const exists = prev.find(p => p.id === finalPlan.id);
            if (exists) {
                return prev.map(p => p.id === finalPlan.id ? finalPlan : p);
            }
            return [...prev, finalPlan];
        });

        setIsDialogOpen(false);
        setEditingPlan(null);
        toast({ title: 'Plan saved successfully' });
    };

    const handleDeletePlan = () => {
        if (!planToDelete) return;
        deleteSubscriptionPlan(planToDelete.id);
        setPlans(prev => prev.filter(p => p.id !== planToDelete.id));
        setPlanToDelete(null);
        toast({ title: 'Plan removed', variant: 'destructive' });
    };

    const addFeature = () => {
        if (!featureInput.trim() || !editingPlan) return;
        setEditingPlan({
            ...editingPlan,
            features: [...(editingPlan.features || []), featureInput.trim()]
        });
        setFeatureInput('');
    };

    const removeFeature = (index: number) => {
        if (!editingPlan) return;
        const newFeatures = [...(editingPlan.features || [])];
        newFeatures.splice(index, 1);
        setEditingPlan({ ...editingPlan, features: newFeatures });
    };

    const formatCurrency = (amount: string) => {
        const num = parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-GH', { style: 'currency', currency: 'GHS' }).format(num);
    };

  return (
    <div className="space-y-8">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
                <Repeat className="h-8 w-8 text-primary" />
            </div>
            <div>
                <h1 className="text-3xl font-bold mb-1 font-headline">AI & Premium Subscriptions</h1>
                <p className="text-muted-foreground text-sm">
                    Manage recurring access tiers and track membership growth.
                </p>
            </div>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2 shadow-lg">
            <PlusCircle className="h-4 w-4" />
            Create Subscription Tier
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map(plan => (
              <Card key={plan.id} className="relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(plan)}>
                          <Edit className="h-4 w-4" />
                      </Button>
                  </div>
                  <CardHeader>
                      <Badge variant="outline" className="w-fit mb-2 uppercase tracking-widest bg-primary/5">{plan.interval}</Badge>
                      <CardTitle>{plan.name}</CardTitle>
                      <CardDescription className="text-2xl font-black text-primary pt-2">
                          {formatCurrency(plan.price)}
                      </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="flex items-center gap-2 text-sm bg-muted/30 p-2 rounded-lg">
                          <Users size={16} className="text-muted-foreground" />
                          <span className="font-bold">{plan.activeSubscribers.toLocaleString()}</span>
                          <span className="text-muted-foreground">Active Members</span>
                      </div>
                      <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Core Features</p>
                          <div className="space-y-1.5">
                            {plan.features.map((feature, i) => (
                                <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1 shrink-0" />
                                    {feature}
                                </p>
                            ))}
                          </div>
                      </div>
                  </CardContent>
              </Card>
          ))}
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 border-b p-6">
          <CardTitle className="text-lg flex items-center gap-2">
              <LayoutDashboard size={18} className="text-muted-foreground" />
              Management Console
          </CardTitle>
          <CardDescription>
            Membership pricing and interval settings are managed via the platform governance module.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
            {isLoading ? (
                <div className="flex flex-col justify-center items-center h-64 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground animate-pulse font-bold uppercase">Syncing Membership Data...</p>
                </div>
            ) : (
                <Table>
                    <TableHeader className="bg-muted/10">
                        <TableRow>
                            <TableHead className="pl-6">Plan Name</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Interval</TableHead>
                            <TableHead>Subscribers</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {plans.map(plan => (
                            <TableRow key={plan.id} className="hover:bg-muted/5 transition-colors group">
                                <TableCell className="pl-6 font-bold">{plan.name}</TableCell>
                                <TableCell className="font-mono font-bold text-primary">{formatCurrency(plan.price)}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="capitalize h-5">{plan.interval}ly</Badge>
                                </TableCell>
                                <TableCell className="font-medium text-muted-foreground">{plan.activeSubscribers.toLocaleString()}</TableCell>
                                <TableCell className="text-right pr-6">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal size={14}/></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleOpenDialog(plan)}>
                                                <Edit className="mr-2 h-4 w-4" /> Edit Tier
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem 
                                                onClick={() => setPlanToDelete(plan)}
                                                className="text-destructive focus:text-destructive"
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete Plan
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                        {plans.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                                    <Repeat className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                    <p>No subscription tiers configured.</p>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>

      {/* Editor Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>{editingPlan?.name ? 'Edit Subscription Tier' : 'New Subscription Tier'}</DialogTitle>
                <DialogDescription>Define the pricing and feature set for this recurring plan.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="plan-name">Plan Name</Label>
                    <Input 
                        id="plan-name" 
                        placeholder="e.g. ICAG All-Access" 
                        value={editingPlan?.name || ''}
                        onChange={e => setEditingPlan(prev => ({...prev!, name: e.target.value}))}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="plan-price">Price (GH₵)</Label>
                        <Input 
                            id="plan-price" 
                            type="number" 
                            value={editingPlan?.price || '0'}
                            onChange={e => setEditingPlan(prev => ({...prev!, price: e.target.value}))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="plan-interval">Billing Interval</Label>
                        <Select 
                            value={editingPlan?.interval} 
                            onValueChange={v => setEditingPlan(prev => ({...prev!, interval: v as any}))}
                        >
                            <SelectTrigger id="plan-interval">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="month">Monthly</SelectItem>
                                <SelectItem value="year">Yearly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Plan Features</Label>
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Add a benefit..." 
                            value={featureInput}
                            onChange={e => setFeatureInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addFeature()}
                        />
                        <Button variant="outline" size="icon" onClick={addFeature} type="button">
                            <PlusCircle size={18} />
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                        {editingPlan?.features?.map((feature, idx) => (
                            <Badge key={idx} variant="secondary" className="gap-1 pr-1.5 h-7">
                                {feature}
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-4 w-4 p-0 hover:bg-transparent" 
                                    onClick={() => removeFeature(idx)}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </Badge>
                        ))}
                    </div>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSavePlan} className="gap-2">
                    <Save size={16} />
                    Save Changes
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!planToDelete} onOpenChange={() => setPlanToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire Subscription Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the "{planToDelete?.name}" plan from the storefront. Current subscribers will not be affected until their next renewal cycle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Plan</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlan} className="bg-destructive hover:bg-destructive/90">
                Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
