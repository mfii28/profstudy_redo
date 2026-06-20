'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { GraduationCap, Loader2, Search, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { type InstructorApplication } from '@/lib/db';
import { getInstructorApplications, updateInstructorApplicationStatus } from '@/lib/application-service';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { EmptyState } from '@/components/dashboard/empty-state';

const STATUS_VARIANTS: Record<InstructorApplication['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  Pending: 'default',
  'Under Review': 'outline',
  Approved: 'secondary',
  Rejected: 'destructive',
  Withdrawn: 'secondary',
};

export default function AdminInstructorApplicationsPage() {
  const { user: adminUser } = useUser();
  const { toast } = useToast();
  const [applications, setApplications] = useState<InstructorApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<InstructorApplication | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isActing, setIsActing] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await getInstructorApplications();
      setApplications(data);
    } catch (err) {
      console.error('[AdminApplications] Failed to load:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = applications.filter(a =>
    a.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAction = async (status: InstructorApplication['status']) => {
    if (!selected || !adminUser) return;
    setIsActing(true);
    try {
      await updateInstructorApplicationStatus(selected.id, status, adminUser.uid, feedback || undefined);
      toast({
        title: status === 'Approved' ? 'Application Approved' : 'Application Rejected',
        description: `${selected.fullName}'s application has been ${status.toLowerCase()}.`,
      });
      setSelected(null);
      setFeedback('');
      await fetchData();
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update application status.' });
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-xl">
          <GraduationCap className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-headline">Instructor Applications</h1>
          <p className="text-muted-foreground">Review and process new instructor applications.</p>
        </div>
      </div>

      <Card className="shadow-sm border-none">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or status..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<GraduationCap className="h-10 w-10 text-muted-foreground" />} title="No Applications" description="No instructor applications found." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Topics</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(app => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{app.fullName}</p>
                        <p className="text-xs text-muted-foreground">{app.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="text-sm truncate">{app.proposedCourseTopics.join(', ')}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(app.submittedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[app.status]}>{app.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => { setSelected(app); setFeedback(''); }}>
                        <Eye className="h-4 w-4 mr-1" /> Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Application: {selected?.fullName}</DialogTitle>
            <DialogDescription>{selected?.email}</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-semibold mb-1">Proposed Topics</p>
                <p className="text-muted-foreground">{selected.proposedCourseTopics.join(', ')}</p>
              </div>
              <div>
                <p className="font-semibold mb-1">Teaching Experience</p>
                <p className="text-muted-foreground whitespace-pre-line">{selected.teachingExperienceDescription}</p>
              </div>
              <div>
                <p className="font-semibold mb-1">Motivation</p>
                <p className="text-muted-foreground">{selected.motivationStatement}</p>
              </div>
              {selected.phoneNumber && (
                <div>
                  <p className="font-semibold mb-1">Phone</p>
                  <p className="text-muted-foreground">{selected.phoneNumber}</p>
                </div>
              )}
              <div>
                <Label htmlFor="feedback">Admin Feedback (optional)</Label>
                <Textarea
                  id="feedback"
                  className="mt-1"
                  rows={3}
                  placeholder="Leave a note for the applicant..."
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              disabled={isActing || selected?.status === 'Rejected'}
              onClick={() => handleAction('Rejected')}
            >
              {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
              Reject
            </Button>
            <Button
              disabled={isActing || selected?.status === 'Approved'}
              onClick={() => handleAction('Approved')}
            >
              {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
