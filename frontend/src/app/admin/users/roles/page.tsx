'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PlusCircle, Edit, Trash2, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { type Role } from '@/lib/db';
import { getRoles, saveRoles, getAllPermissions } from '@/lib/rbac-data';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function RolesAndPermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isNewRoleDialogOpen, setIsNewRoleDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [newRoleData, setNewRoleData] = useState({ name: '', description: '' });
  const allPermissions = getAllPermissions();
  const { toast } = useToast();

  useEffect(() => {
    const fetchRoles = async () => {
        setIsLoading(true);
        try {
            const fetchedRoles = await getRoles();
            setRoles(fetchedRoles);
            if (fetchedRoles.length > 0 && !selectedRole) {
                setSelectedRole(fetchedRoles[0]);
            }
        } catch (error) {
            console.error("Failed to fetch roles:", error);
        } finally {
            setIsLoading(false);
        }
    }
    fetchRoles();
  }, []);

  const handleCreateOrUpdateRole = async () => {
    if (!newRoleData.name) {
      toast({ variant: 'destructive', title: 'Role name is required.' });
      return;
    }

    let updatedRoles;
    // Check if we are updating an existing role based on state
    const isEditing = selectedRole && !isNewRoleDialogOpen; // This logic needs adjustment to work with modal state

    if (selectedRole && selectedRole.id && roles.find(r => r.id === selectedRole.id)) {
      // Update existing role metadata
      const updatedRole = { ...selectedRole, name: newRoleData.name, description: newRoleData.description };
      updatedRoles = roles.map(r => r.id === selectedRole.id ? updatedRole : r);
      setSelectedRole(updatedRole);
      toast({ title: 'Role Updated', description: `The "${newRoleData.name}" role has been updated.` });
    } else {
      // Create new role
      const newRole: Role = {
        id: `role-${Date.now()}`,
        name: newRoleData.name,
        description: newRoleData.description,
        permissions: [],
      };
      updatedRoles = [...roles, newRole];
      setSelectedRole(newRole);
      toast({ title: 'Role Created', description: `The "${newRoleData.name}" role has been created.` });
    }
    
    await saveRoles(updatedRoles);
    setRoles(updatedRoles);
    setIsNewRoleDialogOpen(false);
    setNewRoleData({ name: '', description: '' });
  };

  const handlePermissionChange = async (permissionId: string, checked: boolean) => {
    if (!selectedRole) return;
    const updatedPermissions = checked
      ? [...selectedRole.permissions, permissionId]
      : selectedRole.permissions.filter(p => p !== permissionId);
    
    const updatedRole = { ...selectedRole, permissions: updatedPermissions };
    const updatedRoles = roles.map(r => r.id === updatedRole.id ? updatedRole : r);

    setSelectedRole(updatedRole);
    setRoles(updatedRoles);
    await saveRoles(updatedRoles);
  };
  
  const handleDeleteRole = async () => {
    if (!roleToDelete) return;
    const updatedRoles = roles.filter(r => r.id !== roleToDelete.id);
    await saveRoles(updatedRoles);
    setRoles(updatedRoles);
    toast({ title: 'Role Deleted', description: `The "${roleToDelete.name}" role has been deleted.` });
    setRoleToDelete(null);
    if (selectedRole?.id === roleToDelete.id) {
        setSelectedRole(updatedRoles.length > 0 ? updatedRoles[0] : null);
    }
  };

  const openNewRoleDialog = (role?: Role) => {
    if (role) {
        setNewRoleData({ name: role.name, description: role.description });
    } else {
        // Clear for new
        setNewRoleData({ name: '', description: '' });
        // We temporarily unset selectedRole so handleCreateOrUpdate knows it's a NEW one
        // But better yet, we use a separate flag or ID check
    }
    setIsNewRoleDialogOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 font-headline">Administrative Access Levels</h1>
          <p className="text-muted-foreground">Define specialized roles and their specific platform permissions.</p>
        </div>
        <Button onClick={() => {
            setSelectedRole(null); // Unset to trigger "Create" mode
            openNewRoleDialog();
        }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Access Level
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6 items-start">
        <Card className="shadow-lg border-none">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Defined Roles</CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-1">
            {isLoading ? (
                <div className="space-y-2 p-2">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                </div>
            ) : roles.length > 0 ? (
                roles.map(role => (
                <Button
                    key={role.id}
                    variant={selectedRole?.id === role.id ? 'secondary' : 'ghost'}
                    className={cn(
                        "w-full justify-start h-auto p-4 transition-all border-l-4",
                        selectedRole?.id === role.id ? "bg-primary/5 border-primary" : "border-transparent hover:bg-muted"
                    )}
                    onClick={() => setSelectedRole(role)}
                >
                    <div className="flex flex-col items-start text-left w-full gap-1">
                        <p className="font-bold truncate text-sm">{role.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{role.permissions.length} Permissions</p>
                    </div>
                </Button>
                ))
            ) : (
                <div className="p-8 text-center text-muted-foreground italic text-sm">No roles created yet.</div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg border-none">
          <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/30">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                {selectedRole ? `Permissions: ${selectedRole.name}` : 'Role Configuration'}
              </CardTitle>
              <CardDescription>{selectedRole?.description || 'Select a role to manage its access rights.'}</CardDescription>
            </div>
            {selectedRole && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openNewRoleDialog(selectedRole)}>
                    <Edit className="h-4 w-4 mr-2" /> Edit Info
                </Button>
                <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setRoleToDelete(selectedRole)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-6">
            {isLoading ? (
                 <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : selectedRole ? (
              <div className="space-y-8">
                {Object.entries(allPermissions).map(([category, permissions]) => (
                  <div key={category} className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-primary/60 pb-2 border-b">{category}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {permissions.map(permission => (
                        <div key={permission.id} className="flex items-start space-x-3 p-3 rounded-lg border bg-muted/10 hover:bg-muted/20 transition-colors">
                          <Checkbox
                            id={permission.id}
                            checked={selectedRole.permissions.includes(permission.id)}
                            onCheckedChange={(checked) => handlePermissionChange(permission.id, !!checked)}
                            className="mt-0.5"
                          />
                          <Label htmlFor={permission.id} className="font-medium cursor-pointer leading-tight">
                            {permission.label}
                            <p className="text-[10px] font-normal text-muted-foreground mt-1">ID: {permission.id}</p>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 text-muted-foreground">
                <div className="bg-muted p-6 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <KeyRound className="h-10 w-10 opacity-20" />
                </div>
                <p className="font-bold text-foreground">No Role Selected</p>
                <p className="max-w-xs mx-auto mt-2 text-sm">Select an administrative role from the sidebar to configure its granular platform permissions.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

       <Dialog open={isNewRoleDialogOpen} onOpenChange={setIsNewRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedRole && selectedRole.id ? 'Edit Access Level' : 'Create Access Level'}</DialogTitle>
            <DialogDescription>Set the name and purpose for this administrative role.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name</Label>
              <Input id="role-name" value={newRoleData.name} onChange={(e) => setNewRoleData(p => ({...p, name: e.target.value}))} placeholder="e.g., Senior Support Agent" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">Description</Label>
              <Input id="role-desc" value={newRoleData.description} onChange={(e) => setNewRoleData(p => ({...p, description: e.target.value}))} placeholder="e.g., Handles all student tickets and finance logs." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewRoleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateOrUpdateRole}>
                {selectedRole && selectedRole.id ? 'Update Role Metadata' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
       <AlertDialog open={!!roleToDelete} onOpenChange={() => setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Access Level?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the "{roleToDelete?.name}" role. Any users assigned to this role will lose their specialized permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRole} className="bg-destructive hover:bg-destructive/90">Delete Permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
