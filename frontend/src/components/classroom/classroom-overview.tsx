'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUser } from '@/firebase';
import {
  addUsersToClassroom,
  deleteManagedClassroom,
  diagnoseClassroomAccess,
  getClassroomMembers,
  getClassroomsForUser,
  grantStudentClassroomAccess,
  removeUserFromClassroom,
  upsertManagedClassroom,
} from '@/app/actions/classroom';
import { getUserById, getUsersByIds } from '@/lib/user-data';
import { isQuotaError, normalizeServiceError } from '@/lib/service-errors';
import { reportQuotaError } from '@/lib/feedback/quota-state';
import { useToast } from '@/hooks/use-toast';
import type { Classroom, ClassroomMemberRole, User } from '@/lib/db';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Calendar,
  CheckCircle2,
  Filter,
  Grid3X3,
  LayoutList,
  Monitor,
  Pencil,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserPlus,
  Users,
  Eye,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';

interface ClassroomOverviewProps {
  basePath: string;
}

type ViewMode = 'grid' | 'list';
type SortMode = 'latest' | 'name-asc' | 'name-desc' | 'members-desc' | 'members-asc';
type ModalMode = 'create' | 'edit' | 'view';
type ClassroomStatus = 'active' | 'inactive' | 'maintenance' | 'archived';

type ClassroomForm = {
  classroomId?: string;
  courseId: string;
  courseTitle: string;
  subject: string;
  category: string;
  description: string;
  status: ClassroomStatus;
  maxCapacity: number;
  tutorId: string;
};

const STATUS_OPTIONS: ClassroomStatus[] = ['active', 'inactive', 'maintenance', 'archived'];

function slugifyCourseId(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return slug || `class-${Date.now()}`;
}

function statusBadgeVariant(status?: ClassroomStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'active') return 'default';
  if (status === 'maintenance') return 'outline';
  if (status === 'archived') return 'secondary';
  return 'destructive';
}

function canManageRoom(userRole: User['role'] | null, uid: string | undefined, room: Classroom): boolean {
  if (!uid || !userRole) return false;
  if (['admin', 'superadmin', 'subadmin'].includes(userRole)) return true;
  return userRole === 'tutor' && room.tutorId === uid;
}

function dashboardBackHref(basePath: string): string {
  if (basePath.startsWith('/admin')) return '/admin';
  if (basePath.startsWith('/tutor-dashboard')) return '/tutor-dashboard';
  if (basePath.startsWith('/student-dashboard')) return '/student-dashboard';
  return '/dashboard';
}

export function ClassroomOverview({ basePath }: ClassroomOverviewProps) {
  const { user, isLoading: isAuthLoading } = useUser();
  const { toast } = useToast();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [userRole, setUserRole] = useState<User['role'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [form, setForm] = useState<ClassroomForm>({
    courseId: '',
    courseTitle: '',
    subject: '',
    category: 'General',
    description: '',
    status: 'active',
    maxCapacity: 0,
    tutorId: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Classroom | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [membersModalClassroom, setMembersModalClassroom] = useState<Classroom | null>(null);
  const [members, setMembers] = useState<{ id: string; name: string; role: string; avatar?: string; classroomRole: ClassroomMemberRole; addedAt?: string; addedBy?: string }[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<'all' | 'student' | 'tutor' | 'admin'>('all');
  const [authorsOnly, setAuthorsOnly] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  // Fix-access dialog state
  const [fixAccessTarget, setFixAccessTarget] = useState<Classroom | null>(null);
  const [fixAccessEmail, setFixAccessEmail] = useState('');
  const [isFixingAccess, setIsFixingAccess] = useState(false);

  // Diagnose-access dialog state
  type DiagResult = Awaited<ReturnType<typeof diagnoseClassroomAccess>>['diagnostics'];
  const [diagTarget, setDiagTarget] = useState<Classroom | null>(null);
  const [diagIdentifier, setDiagIdentifier] = useState('');
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagResult, setDiagResult] = useState<DiagResult | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);

  const handleDiagnose = async (attemptRepair = false) => {
    if (!diagTarget || !user || !diagIdentifier.trim()) return;
    setIsDiagnosing(true);
    setDiagResult(null);
    setDiagError(null);
    try {
      const idToken = await user.getIdToken();
      const { diagnostics, error } = await diagnoseClassroomAccess(
        idToken,
        diagTarget.courseId,
        diagIdentifier.trim(),
        { attemptRepair },
      );
      if (error) {
        setDiagError(error);
      } else {
        setDiagResult(diagnostics ?? null);
      }
    } catch (err: any) {
      setDiagError(err?.message ?? 'Unexpected error');
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleFixAccess = async () => {
    if (!fixAccessTarget || !user || !fixAccessEmail.trim()) return;
    setIsFixingAccess(true);
    try {
      const idToken = await user.getIdToken();
      const result = await grantStudentClassroomAccess(idToken, fixAccessTarget.courseId, fixAccessEmail.trim());
      if (result.error) {
        toast({ variant: 'destructive', title: 'Access grant failed', description: result.error });
      } else {
        toast({
          title: 'Access granted',
          description: `${result.studentName ?? fixAccessEmail} now has access to ${fixAccessTarget.courseTitle}.`,
        });
        setFixAccessTarget(null);
        setFixAccessEmail('');
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err?.message });
    } finally {
      setIsFixingAccess(false);
    }
  };

  const loadClassrooms = async (activeUser = user) => {
    if (!activeUser) return [];
    const idToken = await activeUser.getIdToken();
    const { classrooms: rooms, error } = await getClassroomsForUser(idToken);
    if (error) {
      toast({ variant: 'destructive', title: 'Failed to load classes', description: error });
      return [];
    }
    const sorted = rooms.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt).getTime();
      return bTime - aTime;
    });
    setClassrooms(sorted);
    return sorted;
  };

  useEffect(() => {
    const load = async () => {
      if (isAuthLoading || !user) return;
      setIsLoading(true);
      try {
        const profile = await getUserById(user.uid);
        setUserRole(profile?.role || null);
        const rooms = await loadClassrooms(user);

        const memberIds = new Set<string>();
        rooms.forEach((room) => {
          (room.enrolledStudentIds || []).forEach((memberId) => {
            if (memberId) memberIds.add(memberId);
          });
        });

        if (memberIds.size > 0) {
          const members = await getUsersByIds(Array.from(memberIds));
          setAllUsers(members);
        } else {
          setAllUsers([]);
        }
      } catch (error) {
        const normalized = normalizeServiceError(error, { feature: 'Classroom' });
        if (isQuotaError(error)) {
          reportQuotaError(error);
        }
        toast({
          variant: 'destructive',
          title: normalized.title,
          description: normalized.description,
        });
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [user, isAuthLoading, toast]);

  const categories = useMemo(() => {
    const values = new Set<string>();
    classrooms.forEach((room) => values.add(room.category || 'General'));
    return ['all', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [classrooms]);

  const usersById = useMemo(() => {
    const map = new Map<string, User>();
    allUsers.forEach((u) => map.set(u.id, u));
    return map;
  }, [allUsers]);

  const filteredClassrooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = classrooms.filter((room) => {
      const subject = (room.subject || room.category || '').toLowerCase();
      const description = (room.description || '').toLowerCase();
      const title = (room.courseTitle || '').toLowerCase();
      const category = (room.category || 'General').toLowerCase();

      const queryMatch = !q || title.includes(q) || subject.includes(q) || description.includes(q);
      const categoryMatch = categoryFilter === 'all' || category === categoryFilter.toLowerCase();
      return queryMatch && categoryMatch;
    });

    return rows.sort((a, b) => {
      if (sortMode === 'name-asc') return a.courseTitle.localeCompare(b.courseTitle);
      if (sortMode === 'name-desc') return b.courseTitle.localeCompare(a.courseTitle);
      if (sortMode === 'members-desc') return (b.enrolledStudentIds?.length || 0) - (a.enrolledStudentIds?.length || 0);
      if (sortMode === 'members-asc') return (a.enrolledStudentIds?.length || 0) - (b.enrolledStudentIds?.length || 0);
      return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
    });
  }, [classrooms, query, categoryFilter, sortMode]);

  const metrics = useMemo(() => {
    const total = classrooms.length;
    const active = classrooms.filter((room) => (room.status || 'active') === 'active').length;
    const memberVolume = classrooms.reduce((sum, room) => sum + (room.enrolledStudentIds?.length || 0), 0);
    const categoryCount = new Set(classrooms.map((room) => room.category || 'General')).size;
    return { total, active, memberVolume, categoryCount };
  }, [classrooms]);

  const canCreate = userRole ? ['admin', 'superadmin', 'subadmin', 'tutor'].includes(userRole) : false;
  const helperText = userRole === 'tutor'
    ? 'You are seeing only classes you own. You can manage metadata, users, and communication entry points for your classes.'
    : userRole && ['admin', 'superadmin', 'subadmin'].includes(userRole)
      ? 'You have global control across all classes. Manage operations, ownership, and communication from one place.'
      : 'You can browse and open your class communication spaces.';

  const openCreateModal = () => {
    if (!user) return;
    setModalMode('create');
    setForm({
      classroomId: undefined,
      courseId: '',
      courseTitle: '',
      subject: '',
      category: 'General',
      description: '',
      status: 'active',
      maxCapacity: 0,
      tutorId: userRole === 'tutor' ? user.uid : '',
    });
    setModalOpen(true);
  };

  const openEditModal = (room: Classroom, mode: ModalMode) => {
    setModalMode(mode);
    setForm({
      classroomId: room.id,
      courseId: room.courseId,
      courseTitle: room.courseTitle,
      subject: room.subject || room.category || 'General',
      category: room.category || 'General',
      description: room.description || '',
      status: (room.status || 'active') as ClassroomStatus,
      maxCapacity: Number(room.maxCapacity || 0),
      tutorId: room.tutorId || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    const title = form.courseTitle.trim();
    if (!title) {
      toast({ variant: 'destructive', title: 'Class name required' });
      return;
    }
    if (!form.tutorId && userRole !== 'tutor') {
      toast({ variant: 'destructive', title: 'Owner required', description: 'Select an owner for this class.' });
      return;
    }

    setIsSaving(true);
    try {
      const idToken = await user.getIdToken();
      const payload = {
        classroomId: form.classroomId,
        courseId: (form.courseId || slugifyCourseId(title)).trim(),
        courseTitle: title,
        subject: form.subject.trim() || form.category.trim() || 'General',
        category: form.category.trim() || 'General',
        description: form.description.trim(),
        status: form.status,
        maxCapacity: Number(form.maxCapacity || 0),
        tutorId: userRole === 'tutor' ? user.uid : form.tutorId,
      };
      const result = await upsertManagedClassroom(idToken, payload);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Save failed', description: result.error });
        return;
      }
      await loadClassrooms(user);
      setModalOpen(false);
      toast({ title: modalMode === 'create' ? 'Class created' : 'Class updated' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: error?.message || 'Unknown error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !deleteTarget) return;
    setIsDeleting(true);
    try {
      const idToken = await user.getIdToken();
      const result = await deleteManagedClassroom(idToken, deleteTarget.id);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Delete failed', description: result.error });
        return;
      }
      setDeleteTarget(null);
      await loadClassrooms(user);
      toast({ title: 'Class deleted' });
    } finally {
      setIsDeleting(false);
    }
  };

  const loadMembers = async (room: Classroom) => {
    if (!user) return;
    setMembersModalClassroom(room);
    setMembers([]);
    setSelectedCandidateIds([]);
    setMemberSearch('');
    setMemberRoleFilter('all');
    setAuthorsOnly(false);
    setIsMembersLoading(true);
    try {
      const idToken = await user.getIdToken();
      const result = await getClassroomMembers(idToken, room.id);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Failed to load members', description: result.error });
        return;
      }
      setMembers(result.members || []);
    } finally {
      setIsMembersLoading(false);
    }
  };

  useEffect(() => {
    if (!membersModalClassroom || !user) return;

    const refreshMembers = async () => {
      const idToken = await user.getIdToken();
      const result = await getClassroomMembers(idToken, membersModalClassroom.id);
      if (!result.error) {
        setMembers(result.members || []);
        await loadClassrooms(user);
      }
    };

    refreshMembers();
  }, [membersModalClassroom, user]);

  const memberCandidates = useMemo(() => {
    if (!membersModalClassroom) return [];
    const existingIds = new Set(members.map((m) => m.id));
    const q = memberSearch.trim().toLowerCase();

    return allUsers
      .filter((u) => !existingIds.has(u.id))
      .filter((u) => {
        if (authorsOnly && u.role !== 'tutor') return false;
        if (
          memberRoleFilter === 'admin'
          && !['admin', 'subadmin', 'superadmin'].includes(u.role || '')
        ) return false;
        if (
          memberRoleFilter !== 'all'
          && memberRoleFilter !== 'admin'
          && u.role !== memberRoleFilter
        ) return false;
        if (!q) return true;
        return (
          (u.name || '').toLowerCase().includes(q)
          || (u.email || '').toLowerCase().includes(q)
          || (u.bio || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 200);
  }, [allUsers, members, membersModalClassroom, memberSearch, memberRoleFilter, authorsOnly]);

  const addMembers = async (userIds: string[]) => {
    if (!user || !membersModalClassroom || userIds.length === 0) return;
    setIsBulkAdding(true);
    try {
      const idToken = await user.getIdToken();
      const result = await addUsersToClassroom(idToken, membersModalClassroom.id, userIds);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Add users failed', description: result.error });
        return;
      }
      await Promise.all([loadClassrooms(user), loadMembers(membersModalClassroom)]);
      setSelectedCandidateIds([]);
      toast({ title: 'Users added', description: `${result.added} user(s) added to class.` });
    } finally {
      setIsBulkAdding(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!user || !membersModalClassroom) return;
    const idToken = await user.getIdToken();
    const result = await removeUserFromClassroom(idToken, membersModalClassroom.id, memberId);
    if (result.error) {
      toast({ variant: 'destructive', title: 'Remove failed', description: result.error });
      return;
    }
    await Promise.all([loadClassrooms(user), loadMembers(membersModalClassroom)]);
    toast({ title: 'Member removed' });
  };

  const toggleCandidate = (uid: string) => {
    setSelectedCandidateIds((prev) => {
      if (prev.includes(uid)) return prev.filter((id) => id !== uid);
      return [...prev, uid];
    });
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card overflow-hidden">
              <div className="h-2 bg-muted" />
              <div className="p-6 space-y-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-9 w-full mt-4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isStudentView = basePath.startsWith('/student-dashboard');
  const isAdminView = userRole ? ['admin', 'superadmin', 'subadmin'].includes(userRole) : false;

  const renderActions = (room: Classroom) => {
    const canManage = canManageRoom(userRole, user?.uid, room);

    // Students see only a Join button — no management controls
    if (isStudentView) {
      return (
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" className="h-8 gap-1.5">
            <Link href={`/room/${room.courseId}`}>
              <Users className="h-3.5 w-3.5" />
              Join Classroom
            </Link>
          </Button>
        </div>
      );
    }

    // Admins / tutors see full management controls
    return (
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" className="h-8 gap-1.5">
          <Link href={`/room/${room.courseId}`}>
            <Users className="h-3.5 w-3.5" />
            Join Class
          </Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => openEditModal(room, 'view')}
        >
          <Eye className="mr-1 h-3.5 w-3.5" />
          Quick View
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={!canManage}
          onClick={() => openEditModal(room, 'edit')}
        >
          <Pencil className="mr-1 h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={!canManage}
          onClick={() => loadMembers(room)}
        >
          <Users className="mr-1 h-3.5 w-3.5" />
          Manage Users
        </Button>
        {isAdminView && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950"
              onClick={() => { setFixAccessTarget(room); setFixAccessEmail(''); }}
            >
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
              Fix Access
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-400 dark:hover:bg-sky-950"
              onClick={() => { setDiagTarget(room); setDiagIdentifier(''); setDiagResult(null); setDiagError(null); }}
            >
              <Stethoscope className="mr-1 h-3.5 w-3.5" />
              Diagnose
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          asChild
        >
          <Link href={`/room/${room.courseId}/messages`}>Messages</Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          asChild
        >
          <Link href={`/room/${room.courseId}/qa`}>Q&amp;A</Link>
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-8"
          disabled={!canManage}
          onClick={() => setDeleteTarget(room)}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Delete
        </Button>
      </div>
    );
  };

  const renderOwnerLabel = (room: Classroom) => {
    const owner = usersById.get(room.tutorId);
    const isYou = user?.uid === room.tutorId;
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Owner: {owner?.name || room.createdByName || room.tutorId || 'Unknown'}</span>
        {isYou && <Badge variant="secondary" className="text-[10px]">You</Badge>}
      </div>
    );
  };

  const filtersPanel = (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <div className="md:col-span-2">
        <Label className="mb-1.5 block text-xs text-muted-foreground">Search</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by class name, subject, or description"
            className="pl-8"
          />
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block text-xs text-muted-foreground">Category</Label>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat === 'all' ? 'All categories' : cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="mb-1.5 block text-xs text-muted-foreground">Sort</Label>
        <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Latest updated</SelectItem>
            <SelectItem value="name-asc">Name A-Z</SelectItem>
            <SelectItem value="name-desc">Name Z-A</SelectItem>
            <SelectItem value="members-desc">Members high-low</SelectItem>
            <SelectItem value="members-asc">Members low-high</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const ownerCandidates = allUsers.filter((u) => u.role === 'tutor');

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Badge className="w-fit gap-1 bg-primary/10 text-primary hover:bg-primary/10">
              <BookOpen className="h-3.5 w-3.5" />
              Class Operations Center
            </Badge>
            <h2 className="text-2xl font-black tracking-tight">Class Management</h2>
            <p className="text-sm text-muted-foreground max-w-2xl">{helperText}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={dashboardBackHref(basePath)}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back to Dashboard
              </Link>
            </Button>
            {canCreate && (
              <Button size="sm" onClick={openCreateModal}>
                <Plus className="mr-1.5 h-4 w-4" />
                Create Class
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total Classes</CardDescription><CardTitle>{metrics.total}</CardTitle></CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">All visible classes in your scope</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Active Classes</CardDescription><CardTitle className="text-emerald-600">{metrics.active}</CardTitle></CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">Operational classes currently marked active</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total Members</CardDescription><CardTitle className="text-blue-600">{metrics.memberVolume}</CardTitle></CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">Combined class member volume</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Categories</CardDescription><CardTitle className="text-violet-600">{metrics.categoryCount}</CardTitle></CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">Distinct class categories tracked</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Discover and Control</CardTitle>
              <CardDescription>Search, filter, sort, and switch layout for fast actions.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="md:hidden"
                onClick={() => setShowMobileFilters((prev) => !prev)}
              >
                <Filter className="h-4 w-4" />
              </Button>
              <div className="hidden rounded-md border p-1 md:flex">
                <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('grid')}>
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setViewMode('list')}>
                  <LayoutList className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="hidden md:block">{filtersPanel}</div>
          {showMobileFilters && <div className="md:hidden">{filtersPanel}</div>}
        </CardHeader>

        <CardContent>
          {filteredClassrooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Monitor className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-lg font-bold">No classes found</h3>
              <p className="text-sm text-muted-foreground max-w-md">Try adjusting filters or create a new class to get started.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredClassrooms.map((room) => (
                <div key={room.id} className="rounded-xl border bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold truncate">{room.courseTitle}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{room.subject || room.category || 'General'}</p>
                    </div>
                    <Badge variant={statusBadgeVariant(room.status as ClassroomStatus)} className="capitalize">{room.status || 'active'}</Badge>
                  </div>

                  {!!room.description && <p className="text-sm text-muted-foreground line-clamp-2">{room.description}</p>}

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{(room.memberCount ?? room.enrolledStudentIds?.length) || 0} members</span>
                    <span className="truncate">{room.category || 'General'}</span>
                  </div>

                  {renderOwnerLabel(room)}

                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Updated {format(new Date(room.updatedAt || room.createdAt), 'MMM d, yyyy')}
                  </div>

                  <div className="pt-2 border-t">
                    {renderActions(room)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClassrooms.map((room) => {
                    const owner = usersById.get(room.tutorId);
                    return (
                      <TableRow key={room.id}>
                        <TableCell>
                          <div className="font-medium">{room.courseTitle}</div>
                          <div className="text-xs text-muted-foreground">{room.subject || room.category || 'General'}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(room.status as ClassroomStatus)} className="capitalize">{room.status || 'active'}</Badge>
                        </TableCell>
                        <TableCell>{(room.memberCount ?? room.enrolledStudentIds?.length) || 0}</TableCell>
                        <TableCell>{room.category || 'General'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{owner?.name || room.tutorId || 'Unknown'}</span>
                            {user?.uid === room.tutorId && <Badge variant="secondary" className="text-[10px]">You</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{renderActions(room)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {modalMode === 'create' ? 'Create Class' : modalMode === 'edit' ? 'Edit Class' : 'Class Details'}
            </DialogTitle>
            <DialogDescription>
              Configure class identity, settings, ownership, and communication context.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Basic Information</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Class Name</Label>
                  <Input value={form.courseTitle} disabled={modalMode === 'view'} onChange={(e) => setForm((p) => ({ ...p, courseTitle: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Class ID</Label>
                  <Input value={form.courseId} disabled={modalMode !== 'create'} onChange={(e) => setForm((p) => ({ ...p, courseId: e.target.value }))} placeholder="Optional, auto-generated if empty" />
                </div>
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Input value={form.subject} disabled={modalMode === 'view'} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Input value={form.category} disabled={modalMode === 'view'} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={form.description} disabled={modalMode === 'view'} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Settings</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={form.status} disabled={modalMode === 'view'} onValueChange={(v) => setForm((p) => ({ ...p, status: v as ClassroomStatus }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => <SelectItem key={status} value={status} className="capitalize">{status}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Max Capacity</Label>
                  <Input type="number" min={0} value={form.maxCapacity} disabled={modalMode === 'view'} onChange={(e) => setForm((p) => ({ ...p, maxCapacity: Number(e.target.value || 0) }))} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Current member count: {(classrooms.find((c) => c.id === form.classroomId)?.memberCount ?? classrooms.find((c) => c.id === form.classroomId)?.enrolledStudentIds?.length) || 0}</p>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Owner Selection</h4>
              {userRole === 'tutor' ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="h-4 w-4" />
                  You are the owner of this class.
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Owner (Author/Tutor)</Label>
                  <Select value={form.tutorId} disabled={modalMode === 'view'} onValueChange={(value) => setForm((p) => ({ ...p, tutorId: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                    <SelectContent>
                      {ownerCandidates.map((owner) => <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </section>

            <section className="space-y-2 rounded-lg border p-3 bg-muted/30">
              <h4 className="text-sm font-semibold">Communication Areas</h4>
              <p className="text-xs text-muted-foreground">Every class links to communication spaces. Members can open class messages and private discussion channels from class cards and rows.</p>
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            {modalMode !== 'view' && (
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Class'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!membersModalClassroom} onOpenChange={(open) => !open && setMembersModalClassroom(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Class User Management</DialogTitle>
            <DialogDescription>
              {membersModalClassroom?.courseTitle} • Capacity {membersModalClassroom?.enrolledStudentIds?.length || 0}/{membersModalClassroom?.maxCapacity || 'unlimited'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1">
            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Current Users</h4>
              <div className="rounded-lg border overflow-hidden max-h-56 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Global Role</TableHead>
                      <TableHead>Classroom Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isMembersLoading ? (
                      <TableRow><TableCell colSpan={5}>Loading members...</TableCell></TableRow>
                    ) : members.length === 0 ? (
                      <TableRow><TableCell colSpan={5}>No members yet.</TableCell></TableRow>
                    ) : members.map((member) => {
                      const room = membersModalClassroom;
                      const classroomRole = member.id === room?.tutorId
                        ? 'Owner'
                        : member.classroomRole === 'classroom-admin'
                          ? 'Classroom Admin'
                          : member.classroomRole === 'classroom-author'
                            ? 'Classroom Author'
                            : 'Classroom Student';
                      const isOwner = member.id === room?.tutorId;
                      return (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell className="capitalize">{member.role}</TableCell>
                          <TableCell>{classroomRole}</TableCell>
                          <TableCell><Badge variant="secondary">Active</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" disabled={isOwner} onClick={() => removeMember(member.id)}>Remove</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Add Users</h4>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div className="md:col-span-2">
                  <Label className="mb-1.5 block text-xs">Search users</Label>
                  <Input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Name or email" />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">Role filter</Label>
                  <Select value={memberRoleFilter} onValueChange={(v) => setMemberRoleFilter(v as 'all' | 'student' | 'tutor' | 'admin')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="student">Students</SelectItem>
                      <SelectItem value="tutor">Tutors</SelectItem>
                      <SelectItem value="admin">Admins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button variant={authorsOnly ? 'default' : 'outline'} className="w-full" onClick={() => setAuthorsOnly((prev) => !prev)}>
                    Authors only
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border max-h-60 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Select</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberCandidates.length === 0 ? (
                      <TableRow><TableCell colSpan={4}>No matching candidates.</TableCell></TableRow>
                    ) : memberCandidates.map((candidate) => {
                      const isSelected = selectedCandidateIds.includes(candidate.id);
                      return (
                        <TableRow key={candidate.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCandidate(candidate.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{candidate.name}</div>
                            <div className="text-xs text-muted-foreground">{candidate.email}</div>
                          </TableCell>
                          <TableCell className="capitalize">{candidate.role}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => addMembers([candidate.id])}>
                              <UserPlus className="mr-1 h-3.5 w-3.5" />Add
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => addMembers(selectedCandidateIds)} disabled={selectedCandidateIds.length === 0 || isBulkAdding}>
                  <BadgeCheck className="mr-1.5 h-4 w-4" />
                  {isBulkAdding ? 'Adding...' : `Bulk add (${selectedCandidateIds.length})`}
                </Button>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diagnose Access Dialog */}
      <Dialog open={!!diagTarget} onOpenChange={(open) => { if (!open) { setDiagTarget(null); setDiagResult(null); setDiagError(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-sky-500" />
              Diagnose Classroom Access
            </DialogTitle>
            <DialogDescription>
              Check why a user cannot receive real-time messages in{' '}
              <strong>{diagTarget?.courseTitle}</strong>. Enter their email or UID.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="diag-identifier">Student Email or UID</Label>
              <Input
                id="diag-identifier"
                placeholder="student@example.com or uid123"
                value={diagIdentifier}
                onChange={(e) => { setDiagIdentifier(e.target.value); setDiagResult(null); setDiagError(null); }}
                onKeyDown={(e) => e.key === 'Enter' && handleDiagnose(false)}
                autoFocus
              />
            </div>

            {diagError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {diagError}
              </div>
            )}

            {diagResult && (
              <div className="space-y-2 rounded-lg border bg-muted/40 px-3 py-3 text-sm">
                <p className="font-semibold text-foreground">Results for <span className="font-mono text-xs">{diagResult.targetEmail ?? diagResult.targetUserId}</span></p>

                {([
                  ['User enrolled in profile array', diagResult.userEnrolledInArray],
                  ['In enrollment index', diagResult.enrollmentIndexHasMember],
                  ['Classroom document exists', diagResult.classroomExists],
                  ['Classroom has enrolledStudentIds field', diagResult.classroomHasEnrolledField],
                  ['In classroom member list', diagResult.classroomHasMember],
                  ['Firestore rules would allow message read', diagResult.rulesWouldAllowMessageReadByMembership],
                ] as [string, boolean][]).map(([label, ok]) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{label}</span>
                    {ok
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      : <XCircle className="h-4 w-4 shrink-0 text-destructive" />}
                  </div>
                ))}

                {diagResult.repairAttempted && (
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    {diagResult.repairSucceeded
                      ? <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /><span className="text-emerald-600">Repair succeeded</span></>
                      : <><XCircle className="h-3.5 w-3.5 text-destructive" /><span className="text-destructive">Repair failed</span></>}
                  </div>
                )}

                {diagResult.rootCauseFlags.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    <p className="text-xs font-semibold text-foreground">Root cause flags:</p>
                    {diagResult.rootCauseFlags.map((f) => (
                      <span key={f} className="mr-1 inline-block rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] text-destructive">{f}</span>
                    ))}
                  </div>
                )}

                <div className="mt-2 rounded border-l-4 border-sky-400 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                  <span className="font-semibold">Recommendation: </span>{diagResult.recommendation}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setDiagTarget(null); setDiagResult(null); setDiagError(null); }}>Close</Button>
            <Button
              variant="outline"
              onClick={() => handleDiagnose(false)}
              disabled={!diagIdentifier.trim() || isDiagnosing}
              className="border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-400"
            >
              {isDiagnosing && !diagResult ? 'Checking...' : 'Run Diagnosis'}
            </Button>
            <Button
              onClick={() => handleDiagnose(true)}
              disabled={!diagIdentifier.trim() || isDiagnosing || (!!diagResult && diagResult.repairAttempted && diagResult.repairSucceeded)}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              {isDiagnosing && diagResult ? 'Repairing...' : 'Diagnose + Repair'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fix Access Dialog */}
      <Dialog open={!!fixAccessTarget} onOpenChange={(open) => !open && setFixAccessTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              Grant Student Classroom Access
            </DialogTitle>
            <DialogDescription>
              Enter the student&apos;s email address to immediately grant them access to{' '}
              <strong>{fixAccessTarget?.courseTitle}</strong>. This creates their enrollment
              record and adds them to the classroom roster.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="fix-access-email">Student Email</Label>
              <Input
                id="fix-access-email"
                type="email"
                placeholder="student@example.com"
                value={fixAccessEmail}
                onChange={(e) => setFixAccessEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFixAccess()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFixAccessTarget(null)}>Cancel</Button>
            <Button
              onClick={handleFixAccess}
              disabled={!fixAccessEmail.trim() || isFixingAccess}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isFixingAccess ? 'Granting...' : 'Grant Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete class?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove class metadata and direct access from class listing pages. Communication history may remain in message collections.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90">
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
