'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/firebase';
import { getSupportTickets, addSupportTicket } from '@/lib/support-data';
import type { SupportTicket } from '@/lib/db';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Ticket, PlusCircle, Calendar, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = status.toLowerCase();
  if (s === 'closed' || s === 'resolved') return 'secondary';
  if (s === 'in progress' || s === 'pending') return 'default';
  return 'outline';
}

function priorityVariant(priority: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (priority === 'High') return 'destructive';
  if (priority === 'Medium') return 'default';
  return 'secondary';
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function TicketSkeleton() {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-5 space-y-3">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

type SupportTicketsPageProps = {
  title: string;
  description: string;
  emptyDescription: string;
};

export function SupportTicketsPage({ title, description, emptyDescription }: SupportTicketsPageProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    subject: '',
    description: '',
    category: 'Technical Issue' as SupportTicket['category'],
    priority: 'Medium' as SupportTicket['priority'],
  });

  const loadTickets = async () => {
    if (!user) return;
    setIsLoading(true);
    getSupportTickets(user.uid).then(setTickets).finally(() => setIsLoading(false));
  };

  useEffect(() => {
    void loadTickets();
  }, [user]);

  const handleSubmit = async () => {
    if (!user || !form.subject.trim()) return;
    setSubmitting(true);
    const newTicket: SupportTicket = {
      id: `ticket_${Date.now()}`,
      userId: user.uid,
      subject: form.subject.trim(),
      description: form.description.trim(),
      date: new Date().toISOString(),
      status: 'open',
      category: form.category,
      priority: form.priority,
      replies: [],
    };
    try {
      await addSupportTicket(newTicket);
      setTickets((prev) => [newTicket, ...prev]);
      setShowNew(false);
      setForm({ subject: '', description: '', category: 'Technical Issue', priority: 'Medium' });
      toast({ title: 'Ticket submitted', description: "We'll get back to you shortly." });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to submit ticket. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold font-headline mb-1">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <PlusCircle className="h-4 w-4" /> New Ticket
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <TicketSkeleton key={i} />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<Ticket className="h-10 w-10" />}
          title="No support tickets"
          description={emptyDescription}
          action={
            <Button onClick={() => setShowNew(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Open a Ticket
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="border-none shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <p className="font-semibold">{ticket.subject}</p>
                    {ticket.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant={statusVariant(ticket.status)}>{ticket.status}</Badge>
                      <Badge variant={priorityVariant(ticket.priority)}>{ticket.priority}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(ticket.date)}
                      </span>
                    </div>
                  </div>
                  {ticket.replies.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <MessageSquare className="h-3.5 w-3.5" />
                      {ticket.replies.length} {ticket.replies.length === 1 ? 'reply' : 'replies'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Support Ticket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Subject *</label>
              <Input
                placeholder="Brief description of your issue"
                value={form.subject}
                onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Provide more details..."
                rows={4}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm((p) => ({ ...p, category: v as SupportTicket['category'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Technical Issue">Technical Issue</SelectItem>
                    <SelectItem value="Billing & Payments">Billing & Payments</SelectItem>
                    <SelectItem value="Course Content">Course Content</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Priority</label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm((p) => ({ ...p, priority: v as SupportTicket['priority'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.subject.trim()}>
              {submitting ? 'Submitting...' : 'Submit Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
