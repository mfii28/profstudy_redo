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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { type User } from '@/lib/db';
import { resolveAvatarUrl } from '@/lib/media-url';
import { getUsers } from '@/lib/user-data';
import { createStudentAccount } from '@/app/actions/user';
import { formatDistanceToNow } from 'date-fns';
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Users, Clock, BookOpen, UserPlus, Eye, EyeOff } from 'lucide-react';
import { EmptyState } from '@/components/dashboard/empty-state';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';

export default function AdminStudentsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const { users } = await getUsers();
      setStudents(users.filter((u) => u.role === 'student'));
    } catch (error) {
      console.error('Failed to fetch students:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStudents();
  }, [fetchStudents]);

  const resetForm = () => {
    setForm({ name: '', email: '', phone: '', password: '' });
    setShowPassword(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!form.name.trim() || !form.email.trim()) {
      toast({ variant: 'destructive', title: 'Name and email are required.' });
      return;
    }
    if (form.password && form.password.length < 8) {
      toast({ variant: 'destructive', title: 'Password must be at least 8 characters.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const idToken = await user.getIdToken(true);
      const result = await createStudentAccount({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        password: form.password || undefined,
        idToken,
      });

      if (result.error) {
        toast({ variant: 'destructive', title: 'Failed to create student', description: result.error });
        return;
      }

      toast({
        title: 'Student account created',
        description: form.password
          ? `${form.name} can now log in with the provided password.`
          : `A welcome email has been sent to ${form.email}.`,
      });

      setDialogOpen(false);
      resetForm();
      await fetchStudents();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Unexpected error', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold">
            Student Management
          </h1>
          <p className="text-muted-foreground">
            Monitor student enrollment volume, academic engagement, and last-seen activity.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add Student
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Global Student List</CardTitle>
          <CardDescription>
            Real-time overview of all registered student accounts and their activity status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : students.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-center">Enrolled Courses</TableHead>
                  <TableHead>Last Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                          <AvatarImage src={resolveAvatarUrl(student.avatar)} alt={student.name} />
                          <AvatarFallback className="bg-primary/5 text-primary">
                            {student.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-sm leading-none">{student.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {student.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary-foreground text-xs font-bold">
                        <BookOpen className="h-3 w-3" />
                        {student.enrollments?.length || 0}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {student.lastActive ? (
                        <div className="flex items-center gap-2 text-foreground font-medium">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatDistanceToNow(new Date(student.lastActive), {
                            addSuffix: true,
                          })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic text-xs">Never active</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={<Users className="h-16 w-16 text-muted-foreground/20" />}
              title="No students found"
              description="When new students sign up via the platform, they will automatically appear here."
            />
          )}
        </CardContent>
      </Card>

      {/* Add Student Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>
              Create a new student account. The student will receive a welcome email.
              If no password is set, a password-reset link is generated for account activation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="student-name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="student-name"
                placeholder="e.g. Ama Owusu"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-email">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="student-email"
                type="email"
                placeholder="student@example.com"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-phone">Phone Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="student-phone"
                type="tel"
                placeholder="+233 20 000 0000"
                value={form.phone}
                onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-password">
                Password <span className="text-muted-foreground text-xs">(optional — leave blank to invite via email)</span>
              </Label>
              <div className="relative">
                <Input
                  id="student-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  disabled={isSubmitting}
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(p => !p)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create Student
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
