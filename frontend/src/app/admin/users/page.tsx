
'use client';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { resolveAvatarUrl } from '@/lib/media-url';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MoreHorizontal, Loader2, UserPlus, Search, ShieldCheck } from 'lucide-react';
import { type User, type Role as RoleType } from '@/lib/db';
import { getUsers, updateUser, deleteUser, createUserProfile, getUserById } from '@/lib/user-data';
import { getRoles, hasPermission } from '@/lib/rbac-data';
import { logAdminAction } from '@/lib/audit-data';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const getRoleVariant = (
  role?: string
): 'default' | 'secondary' | 'outline' | 'destructive' => {
  switch (role) {
    case 'superadmin':
      return 'destructive';
    case 'subadmin':
      return 'default';
    case 'admin':
      return 'default';
    case 'tutor':
      return 'secondary';
    default:
      return 'outline';
  }
};

const getStatusVariant = (
  status?: string
): 'default' | 'secondary' | 'destructive' => {
  switch (status) {
    case 'active':
      return 'default';
    case 'suspended':
      return 'destructive';
    default:
      return 'secondary';
  }
};

export default function AdminUsersPage() {
  const { user: adminUser, isLoading: isAdminLoading } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [roles, setRoles] = useState<RoleType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [actionUser, setActionUser] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'student' as User['role'],
    roleId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [{ users: fetchedUsers }, fetchedRoles] = await Promise.all([
        getUsers(),
        getRoles(),
      ]);
      setUsers(fetchedUsers);
      setRoles(fetchedRoles);
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !adminUser) return;

    setIsSubmitting(true);
    try {
      const generatedId = `user-${Date.now()}`;
      const userProfile: User = {
        id: generatedId,
        name: newUser.name,
        email: newUser.email,
        avatar: '',
        bio: '',
        isPremium: false,
        studyStreak: 0,
        aiUsage: {
          tokensRemaining: 50,
          lastResetDate: new Date().toISOString(),
        },
        enrollments: [],
        role: newUser.role,
        roleId: newUser.role === 'admin' ? newUser.roleId : undefined,
        status: 'active',
        // Admin-created profiles are pre-verified — no OTP required.
        emailVerified: true,
      };

      await createUserProfile(userProfile);
      
      await logAdminAction({
        actorId: adminUser.uid,
        actorName: adminUser.displayName || adminUser.email || 'Administrator',
        action: 'USER_CREATE',
        targetId: userProfile.id,
        targetType: 'user',
        severity: 'info',
        details: `Created new ${userProfile.role} profile for ${userProfile.email}.`
      });

      setUsers(prev => [userProfile, ...prev]);
      setIsAddUserDialogOpen(false);
      setNewUser({ name: '', email: '', role: 'student', roleId: '' });
      toast({ title: 'User Created' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Creation Failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveUserChanges = async () => {
    if (!editingUser || !adminUser) return;
    
    try {
      await updateUser(editingUser);
      
      await logAdminAction({
        actorId: adminUser.uid,
        actorName: adminUser.displayName || adminUser.email || 'Administrator',
        action: 'USER_UPDATE',
        targetId: editingUser.id,
        targetType: 'user',
        severity: 'warn',
        details: `Modified profile/billing data for ${editingUser.email}.`
      });

      setUsers(users.map((u) => (u.id === editingUser.id ? editingUser : u)));
      setIsEditDialogOpen(false);
      setEditingUser(null);
      toast({ title: 'User Updated' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Update Failed' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!adminUser || adminUser.uid === userId) return;

    const actingUser = await getUserById(adminUser.uid);
    const canDelete = await hasPermission(actingUser, 'users:delete');
    if (!canDelete) {
      toast({
        variant: 'destructive',
        title: 'Permission denied',
        description: 'You do not have permission to delete users.',
      });
      return;
    }

    try {
      const userToDelete = users.find(u => u.id === userId);
      await deleteUser(userId);
      
      await logAdminAction({
        actorId: adminUser.uid,
        actorName: adminUser.displayName || adminUser.email || 'Administrator',
        action: 'USER_DELETE',
        targetId: userId,
        targetType: 'user',
        severity: 'critical',
        details: `Permanently deleted account: ${userToDelete?.email || userId}.`
      });

      setUsers(users.filter((u) => u.id !== userId));
      toast({ title: 'User Deleted' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Deletion Failed' });
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const handleRoleChange = async (user: User, newRole: User['role'], roleId?: string) => {
    if (!adminUser) return;

    try {
      const actingUser = await getUserById(adminUser.uid);
      const canChangeRole = await hasPermission(actingUser, 'users:edit:role');
      if (!canChangeRole) {
        toast({
          variant: 'destructive',
          title: 'Permission denied',
          description: 'You do not have permission to change user roles.',
        });
        return;
      }
      
      const idToken = await adminUser.getIdToken();
      const { setRole } = await import('@/app/actions/user');
      const result = await setRole(user.id, newRole, idToken);

      if ('error' in result) {
        toast({ variant: 'destructive', title: 'Role update failed', description: result.error });
        return;
      }
      
      const updatedUser = { ...user, role: newRole, roleId: roleId };
      await logAdminAction({
          actorId: adminUser.uid,
          actorName: adminUser.displayName || adminUser.email || 'Administrator',
          action: 'USER_ROLE_CHANGE',
          targetId: user.id,
          targetType: 'user',
          severity: 'warn',
          details: `Changed ${user.email} role from ${user.role} to ${newRole}.`
      });

      setUsers(users.map(u => u.id === user.id ? updatedUser : u));
      toast({ title: 'Role Updated', description: 'Changes will take effect within 1 hour or on next login.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleApproveTutor = async (user: User) => {
    if (!adminUser) return;
    try {
      const actingUser = await getUserById(adminUser.uid);
      const canEdit = await hasPermission(actingUser, 'users:edit:role');
      if (!canEdit) {
        toast({ variant: 'destructive', title: 'Permission denied', description: 'You cannot approve tutors.' });
        return;
      }
      const updatedUser = { ...user, tutorApproved: true };
      await updateUser(updatedUser);
      await logAdminAction({
        actorId: adminUser.uid,
        actorName: adminUser.displayName || adminUser.email || 'Administrator',
        action: 'TUTOR_APPROVED',
        targetId: user.id,
        targetType: 'user',
        severity: 'info',
        details: `Approved tutor access for ${user.email}.`,
      });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? updatedUser : u)));
      toast({ title: 'Tutor approved', description: `${user.name} can use the full tutor dashboard.` });
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Approval failed.',
      });
    }
  };

  const handleMarkEmailVerified = async (user: User) => {
    if (!adminUser) return;
    try {
      const idToken = await adminUser.getIdToken(true);
      const { adminMarkEmailVerified } = await import('@/app/actions/otp');
      const result = await adminMarkEmailVerified({ targetUid: user.id, callerIdToken: idToken });
      if (result.error) {
        toast({ variant: 'destructive', title: 'Verification failed', description: result.error });
        return;
      }
      setUsers(users.map(u => u.id === user.id ? { ...u, emailVerified: true } : u));
      toast({ title: 'Email Verified', description: `${user.email} is now marked as verified.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleStatusChange = async (user: User, newStatus: User['status']) => {
    if (!adminUser) return;

    const actingUser = await getUserById(adminUser.uid);
    const canSuspend = await hasPermission(actingUser, 'users:suspend');
    if (!canSuspend) {
      toast({
        variant: 'destructive',
        title: 'Permission denied',
        description: 'You do not have permission to change account status.',
      });
      return;
    }
    
    const updatedUser = { ...user, status: newStatus };
    await updateUser(updatedUser);
    
    await logAdminAction({
        actorId: adminUser.uid,
        actorName: adminUser.displayName || adminUser.email || 'Administrator',
        action: 'USER_STATUS_CHANGE',
        targetId: user.id,
        targetType: 'user',
        severity: newStatus === 'suspended' ? 'critical' : 'info',
        details: `Set ${user.email} status to ${newStatus}.`
    });

    setUsers(users.map(u => u.id === user.id ? updatedUser : u));
    toast({ title: 'Status Updated' });
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-headline text-2xl sm:text-3xl font-bold tracking-tight">User Registry</h1>
          <p className="text-muted-foreground text-sm">Manage student and staff accounts.</p>
        </div>
        <Button onClick={() => setIsAddUserDialogOpen(true)} className="w-full sm:w-auto gap-2 shadow-sm font-bold">
          <UserPlus size={18} />
          Add New User
        </Button>
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-6 bg-muted/30 border-b">
          <CardTitle className="text-lg">Global Accounts</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search name or email..." 
                className="pl-9 h-10 bg-background" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <ScrollArea className="w-full whitespace-nowrap">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow>
                    <TableHead className="pl-6">User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/5 transition-colors">
                      <TableCell className="pl-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border shadow-sm">
                            <AvatarImage src={resolveAvatarUrl(user.avatar)} />
                            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{user.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Badge variant={getRoleVariant(user.role)} className="cursor-pointer capitalize text-[10px] h-5 px-2">
                              {user.role}
                            </Badge>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => handleRoleChange(user, 'student')}>Student</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleRoleChange(user, 'tutor')}>Tutor</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {roles.map(r => (
                              <DropdownMenuItem key={r.id} onClick={() => handleRoleChange(user, 'admin', r.id)}>
                                  {r.name} (Admin)
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5 uppercase font-bold text-muted-foreground">
                              Standard
                            </Badge>
                            {user.emailVerified !== true && (
                              <Badge variant="destructive" className="text-[10px] h-4 px-1.5 gap-1">
                                Unverified
                              </Badge>
                            )}
                            {user.emailVerified === true && (
                              <Badge variant="default" className="text-[10px] h-4 px-1.5 gap-1 bg-green-600">
                                <ShieldCheck className="h-2.5 w-2.5" /> Verified
                              </Badge>
                            )}
                          </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(user.status)} className="capitalize text-[10px] h-5 px-2">
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => { setEditingUser({...user}); setIsEditDialogOpen(true); }}>
                              Edit Profile & Billing
                            </DropdownMenuItem>
                            {user.emailVerified !== true && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleMarkEmailVerified(user)} className="gap-2">
                                  <ShieldCheck className="h-4 w-4 text-green-600" /> Mark Email Verified
                                </DropdownMenuItem>
                              </>
                            )}
                            {user.role === 'tutor' && user.tutorApproved === false && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => void handleApproveTutor(user)} className="gap-2">
                                  <ShieldCheck className="h-4 w-4 text-amber-600" /> Approve tutor access
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            {user.status === 'active' ? (
                              <DropdownMenuItem onClick={() => handleStatusChange(user, 'suspended')} className="text-destructive">
                                Suspend Account
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleStatusChange(user, 'active')}>
                                Re-activate
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { setActionUser(user); setIsDeleteDialogOpen(true); }}>
                              Delete Permanently
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Logic-Gated Dialogs */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Account: {editingUser?.name}</DialogTitle>
            <DialogDescription>Modify profile details and account identity fields.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input value={editingUser?.name || ''} onChange={e => setEditingUser(u => u ? {...u, name: e.target.value} : null)} />
                </div>
                <div className="space-y-2">
                    <Label>Email (Read Only)</Label>
                    <Input value={editingUser?.email || ''} disabled className="bg-muted/50" />
                </div>
            </div>
          </div>
          <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-6 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button className="w-full sm:w-auto font-bold" onClick={handleSaveUserChanges}>Apply Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {actionUser?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This action is irreversible and will purge all student data from the platform records.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => actionUser && handleDeleteUser(actionUser.id)} className="bg-destructive hover:bg-destructive/90">Confirm Deletion</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New User Profile</DialogTitle>
            <DialogDescription>Manually register a new student or instructor profile in the platform database.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Full Name</Label><Input value={newUser.name} onChange={e => setNewUser(p => ({...p, name: e.target.value}))} placeholder="John Doe" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={newUser.email} onChange={e => setNewUser(p => ({...p, email: e.target.value}))} placeholder="john@example.com" /></div>
            <div className="space-y-2">
                <Label>Initial Role</Label>
                <Select value={newUser.role} onValueChange={v => setNewUser(p => ({...p, role: v as any}))}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="tutor">Tutor</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>
          <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-6">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsAddUserDialogOpen(false)}>Cancel</Button>
            <Button className="w-full sm:w-auto font-bold" onClick={handleCreateUser} disabled={isSubmitting}>Create Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
