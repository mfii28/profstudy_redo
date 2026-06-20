'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { MessageSquare, Loader2, Search, CheckCircle2, Archive, Eye } from 'lucide-react';
import { type ContactInquiry } from '@/lib/db';
import { getContactInquiries, updateContactInquiryStatus } from '@/lib/application-service';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { EmptyState } from '@/components/dashboard/empty-state';

const STATUS_VARIANTS: Record<ContactInquiry['status'], 'default' | 'secondary' | 'outline'> = {
  Pending: 'default',
  Resolved: 'secondary',
  Archived: 'outline',
};

export default function AdminContactInquiriesPage() {
  const { user: adminUser } = useUser();
  const { toast } = useToast();
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<ContactInquiry | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isActing, setIsActing] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await getContactInquiries();
      setInquiries(data);
    } catch (err) {
      console.error('[AdminInquiries] Failed to load:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = inquiries.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAction = async (status: ContactInquiry['status']) => {
    if (!selected) return;
    setIsActing(true);
    try {
      await updateContactInquiryStatus(selected.id, status, adminNotes || undefined);
      toast({
        title: `Inquiry ${status}`,
        description: `Inquiry from ${selected.name} marked as ${status}.`,
      });
      setSelected(null);
      setAdminNotes('');
      await fetchData();
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update inquiry.' });
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-xl">
          <MessageSquare className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold font-headline">Contact Inquiries</h1>
          <p className="text-muted-foreground">Manage messages submitted through the public contact form.</p>
        </div>
      </div>

      <Card className="shadow-sm border-none">
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or subject..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<MessageSquare className="h-10 w-10 text-muted-foreground" />} title="No Inquiries" description="No contact inquiries found." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(inq => (
                  <TableRow key={inq.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{inq.name}</p>
                        <p className="text-xs text-muted-foreground">{inq.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <p className="text-sm truncate">{inq.subject}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(inq.submittedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[inq.status]}>{inq.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => { setSelected(inq); setAdminNotes(inq.adminNotes || ''); }}>
                        <Eye className="h-4 w-4 mr-1" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.subject}</DialogTitle>
            <DialogDescription>
              From {selected?.name} &lt;{selected?.email}&gt; —{' '}
              {selected && formatDistanceToNow(new Date(selected.submittedAt), { addSuffix: true })}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-sm">
              <div className="p-3 bg-muted/50 rounded-lg whitespace-pre-line text-muted-foreground">
                {selected.message}
              </div>
              <div>
                <Label htmlFor="adminNotes">Admin Notes (optional)</Label>
                <Textarea
                  id="adminNotes"
                  className="mt-1"
                  rows={3}
                  placeholder="Internal notes or follow-up actions..."
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={isActing || selected?.status === 'Archived'}
              onClick={() => handleAction('Archived')}
            >
              {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4 mr-1" />}
              Archive
            </Button>
            <Button
              disabled={isActing || selected?.status === 'Resolved'}
              onClick={() => handleAction('Resolved')}
            >
              {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Mark Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
