'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Percent, PlusCircle, Loader2, UserCog, Trash2, ArrowRight } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { getCommissionSettings, saveCommissionSettings } from '@/lib/finance-data';
import { getUsers } from '@/lib/user-data';
import { type User } from '@/lib/db';
import { defaultGlobalSettings } from '@/lib/platform-settings-data';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUser } from '@/firebase';
import { logAdminAction } from '@/lib/audit-data';

interface CommissionOverride {
  tutorId: string;
  rate: number;
}

export default function AdminCommissionsPage() {
  const { user: adminUser } = useUser();
  const platformDefaultCommission = Number(defaultGlobalSettings.platformCommission) || 0;
  const [defaultCommission, setDefaultCommission] = useState(platformDefaultCommission);
  const [overrides, setOverrides] = useState<CommissionOverride[]>([]);
  const [tutors, setTutors] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false);
  
  const [selectedTutorId, setSelectedTutorId] = useState('');
  const [customRate, setCustomRate] = useState(15);

  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
        const [settings, { users: allUsers }] = await Promise.all([
            getCommissionSettings(),
            getUsers()
        ]);
        
        setDefaultCommission(settings.defaultRate ?? platformDefaultCommission);
        setOverrides(settings.overrides ?? []);
        setTutors(allUsers.filter(u => u.role === 'tutor'));
    } catch (error) {
        console.error("Failed to load commission data:", error);
    } finally {
        setIsLoading(false);
    }
  }, [platformDefaultCommission]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddOverride = async () => {
      if (!selectedTutorId || customRate < 0 || customRate > 100 || !adminUser) {
          toast({ variant: 'destructive', title: 'Invalid Input' });
          return;
      }

      const existingIndex = overrides.findIndex(o => o.tutorId === selectedTutorId);
      let newOverrides = [...overrides];
      
      if (existingIndex > -1) {
          newOverrides[existingIndex] = { tutorId: selectedTutorId, rate: customRate };
      } else {
          newOverrides.push({ tutorId: selectedTutorId, rate: customRate });
      }

      setOverrides(newOverrides);
      await saveCommissionSettings({ defaultRate: defaultCommission, overrides: newOverrides });
      
      const tutorName = tutors.find(t => t.id === selectedTutorId)?.name || 'Unknown';
      await logAdminAction({
          actorId: adminUser.uid,
          actorName: adminUser.displayName || adminUser.email || 'Administrator',
          action: 'COMMISSION_OVERRIDE',
          targetId: selectedTutorId,
          targetType: 'user',
          severity: 'warn',
          details: `Set custom commission rate of ${customRate}% for tutor: ${tutorName}.`
      });

      setIsOverrideDialogOpen(false);
      setSelectedTutorId('');
      setCustomRate(15);
      
      toast({ title: "Override Applied", description: "The instructor-specific rate has been saved and audited." });
  }

  const handleDeleteOverride = async (tutorId: string) => {
      if (!adminUser) return;
      const newOverrides = overrides.filter(o => o.tutorId !== tutorId);
      setOverrides(newOverrides);
      await saveCommissionSettings({ defaultRate: defaultCommission, overrides: newOverrides });
      
      const tutorName = tutors.find(t => t.id === tutorId)?.name || 'Unknown';
      await logAdminAction({
          actorId: adminUser.uid,
          actorName: adminUser.displayName || adminUser.email || 'Administrator',
          action: 'COMMISSION_RESET',
          targetId: tutorId,
          targetType: 'user',
          severity: 'info',
          details: `Reset commission rate to global default for tutor: ${tutorName}.`
      });

      toast({ title: "Override Removed", variant: "destructive" });
  }

  const getTutorName = (id: string) => tutors.find(t => t.id === id)?.name || 'Unknown Instructor';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <Percent className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-1 font-headline">Instructor Splits</h1>
            <p className="text-muted-foreground text-sm">
              Manage custom revenue distribution for specific partners.
            </p>
          </div>
        </div>
        <Card className="bg-primary/5 border-primary/10 p-4 flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Global Base Rate</p>
            <p className="text-xl font-black">{defaultCommission}%</p>
          </div>
          <Button variant="ghost" size="sm" className="gap-2" asChild>
            <Link href="/admin/settings/general">Edit Global <ArrowRight size={14} /></Link>
          </Button>
        </Card>
      </div>

      <Card className="border-none shadow-lg">
          <CardHeader className="bg-muted/30 border-b">
              <div className="flex items-center justify-between">
                  <div>
                      <CardTitle>Custom Overrides</CardTitle>
                      <CardDescription>Individual splits for high-volume or strategic instructors.</CardDescription>
                  </div>
                  <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsOverrideDialogOpen(true)}
                      disabled={isLoading}
                  >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Override
                  </Button>
              </div>
          </CardHeader>
          <CardContent className="p-0">
              {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
              ) : overrides.length > 0 ? (
                  <Table>
                      <TableHeader className="bg-muted/10">
                          <TableRow>
                              <TableHead className="pl-6">Instructor</TableHead>
                              <TableHead>Platform Fee</TableHead>
                              <TableHead>Instructor Share</TableHead>
                              <TableHead className="text-right pr-6">Actions</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {overrides.map((override) => (
                              <TableRow key={override.tutorId}>
                                  <TableCell className="pl-6 font-medium">
                                      {getTutorName(override.tutorId)}
                                  </TableCell>
                                  <TableCell className="font-bold">{override.rate}%</TableCell>
                                  <TableCell className="text-success font-bold">{100 - override.rate}%</TableCell>
                                  <TableCell className="text-right pr-6">
                                      <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          className="text-destructive hover:bg-destructive/10"
                                          onClick={() => handleDeleteOverride(override.tutorId)}
                                      >
                                          <Trash2 className="h-4 w-4" />
                                      </Button>
                                  </TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                      <div className="p-4 rounded-full bg-muted/50">
                          <UserCog className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                      <p className="font-bold text-muted-foreground">No Overrides Configured</p>
                  </div>
              )}
          </CardContent>
      </Card>

      <Dialog open={isOverrideDialogOpen} onOpenChange={setIsOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Instructor Override</DialogTitle>
            <DialogDescription>Set a special commission rate for a specific tutor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tutor">Select Instructor</Label>
              <Select value={selectedTutorId} onValueChange={setSelectedTutorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a tutor..." />
                </SelectTrigger>
                <SelectContent>
                  {tutors.map(tutor => (
                    <SelectItem key={tutor.id} value={tutor.id}>
                      {tutor.name} ({tutor.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="custom-rate">Platform Fee (%)</Label>
              <Input 
                id="custom-rate" 
                type="number" 
                value={customRate} 
                onChange={(e) => setCustomRate(parseInt(e.target.value) || 0)}
              />
              <p className="text-[10px] text-muted-foreground">Instructor receives {100 - customRate}% of sales.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOverrideDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddOverride}>Save Override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
