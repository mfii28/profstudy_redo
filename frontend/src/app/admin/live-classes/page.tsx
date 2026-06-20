'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Video, 
    Calendar as CalendarIcon, 
    Tv, 
    Loader2, 
    Trash2, 
    PlusCircle, 
    ShieldCheck, 
    Clock,
    MoreHorizontal,
    Eye,
    ExternalLink,
    Link as LinkIcon,
    RefreshCw,
} from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge as UIBadge } from '@/components/ui/badge';
import { type LiveClass } from '@/lib/db';
import { getLiveClasses } from '@/lib/live-class-data';
import { createLiveSessionApi, deleteLiveSessionApi, getLiveSessionJoinUrlApi } from '@/lib/live-session-api';
import { useUser, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/dashboard/empty-state';
import { backfillLiveClasses } from '@/app/actions/live-class-admin';

export default function AdminLiveClassesPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [liveSessions, setLiveSessions] = useState<LiveClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Create Session State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newSession, setNewSession] = useState({
    title: '',
    date: '',
    time: '',
    instructor: 'PTS Staff',
    zoomUrl: '',
    durationMinutes: 60,
  });

  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);

  // Delete State
  const [sessionToDelete, setSessionToDelete] = useState<LiveClass | null>(null);

  // Backfill State
  const [isBackfilling, setIsBackfilling] = useState(false);

  // ── NOTE: Admin live classes uses client Firestore because there's no instructorId filter ──

  const fetchLiveClasses = useCallback(async () => {
    if (!firestore) return;
    setIsLoading(true);
    try {
      const data = await getLiveClasses(firestore);
      setLiveSessions(data);
    } catch (error) {
      console.error('Failed to fetch live classes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [firestore]);

  useEffect(() => {
    void fetchLiveClasses();
  }, [fetchLiveClasses]);

  const handleCreateSession = async () => {
    if (!newSession.title || !newSession.date || !newSession.time || !newSession.zoomUrl) {
        toast({ variant: 'destructive', title: 'Incomplete Form', description: 'All fields including the Zoom link are required.' });
        return;
    }
    if (!currentUser) {
        toast({ variant: 'destructive', title: 'Auth Error', description: 'Please wait for your profile to load.' });
        return;
    }

    setIsSubmitting(true);
    
    try {
        const [year, month, day] = newSession.date.split('-').map(Number);
        const [hours, minutes] = newSession.time.split(':').map(Number);
        const startTime = new Date(year, month - 1, day, hours, minutes);

        if (isNaN(startTime.getTime())) {
            throw new Error('Invalid date or time format.');
        }

        const idToken = await currentUser.getIdToken();
        await createLiveSessionApi(idToken, {
          title: newSession.title,
          tutorId: currentUser.uid,
          zoomUrl: newSession.zoomUrl,
          startTime: startTime.toISOString(),
          durationMinutes: newSession.durationMinutes,
          // courseId omitted → global session visible to all enrolled students
        });

        await fetchLiveClasses();
        setIsCreateDialogOpen(false);
        setNewSession({ title: '', date: '', time: '', instructor: 'PTS Staff', zoomUrl: '', durationMinutes: 60 });
        toast({ title: 'Global Session Active' });

    } catch (error: any) {
        console.error('[AdminLive] Creation failed:', error);
        toast({ 
            variant: 'destructive', 
            title: 'Action Failed', 
            description: error.message || 'Check your permissions.' 
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleJoinSession = async (session: LiveClass) => {
    if (!currentUser) return;
    setJoiningSessionId(session.id);
    try {
      const idToken = await currentUser.getIdToken();
      const result = await getLiveSessionJoinUrlApi(idToken, session.id);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to get meeting link.' });
    } finally {
      setJoiningSessionId(null);
    }
  };

  const confirmDelete = async () => {
    if (!sessionToDelete || !currentUser) return;
    
    try {
        const idToken = await currentUser.getIdToken();
        await deleteLiveSessionApi(idToken, sessionToDelete.id);
        setLiveSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
        toast({ title: 'Global Session Removed', variant: 'destructive' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    } finally {
        setSessionToDelete(null);
    }
  };

  const handleBackfill = async () => {
    if (!currentUser) return;
    setIsBackfilling(true);
    try {
      const idToken = await currentUser.getIdToken();
      const result = await backfillLiveClasses(idToken);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Backfill Failed', description: result.error });
      } else {
        toast({
          title: 'Backfill Complete',
          description: `Created ${result.created} session${result.created !== 1 ? 's' : ''}, skipped ${result.skipped} already covered.`,
        });
        await fetchLiveClasses();
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Backfill Failed', description: err?.message || 'Unexpected error.' });
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleViewLog = (title: string) => {
    toast({
        title: 'Accessing Archive',
        description: `Retrieving system logs and attendee participation for "${title}".`,
    });
  };

  const upcomingSessions = liveSessions
    .filter((c) => {
        const now = new Date();
        const startTime = new Date(c.startTime);
        return startTime > now;
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const pastSessions = liveSessions
    .filter((c) => {
        const now = new Date();
        const startTime = new Date(c.startTime);
        return startTime <= now;
    })
    .sort((a, b) => b.startTime.localeCompare(a.startTime));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
                <CalendarIcon className="h-8 w-8 text-primary" />
            </div>
            <div>
                <h1 className="text-3xl font-bold mb-1 font-headline">Live Classes Management</h1>
                <p className="text-muted-foreground text-sm">
                    Global calendar management for all streaming sessions and webinars.
                </p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                onClick={handleBackfill}
                disabled={isBackfilling}
                className="gap-2"
            >
                {isBackfilling
                    ? <Loader2 size={16} className="animate-spin" />
                    : <RefreshCw size={16} />}
                Backfill Live Sessions
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                <PlusCircle size={18} />
                Schedule Global Session
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8">
        <div className="space-y-8">
            <Card className="border-none shadow-lg overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-accent" />
                        Upcoming Sessions
                    </CardTitle>
                    <CardDescription>A list of all upcoming sessions across the platform.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex h-64 items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : upcomingSessions.length > 0 ? (
                        <div className="divide-y">
                            {upcomingSessions.map((item) => (
                                <div key={item.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-muted/10 transition-colors">
                                    <div className="space-y-1">
                                        <p className="font-bold text-lg leading-tight">{item.title}</p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <ShieldCheck className="h-3 w-3" />
                                            <span>Hosted by {item.instructor}</span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-3">
                                            <UIBadge variant="outline" className="h-6 gap-1.5 font-medium bg-primary/5">
                                                <CalendarIcon className="h-3 w-3" />
                                                {new Date(item.startTime).toLocaleDateString()}
                                            </UIBadge>
                                            <UIBadge variant="outline" className="h-6 gap-1.5 font-medium bg-primary/5">
                                                <Clock className="h-3 w-3" />
                                                {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </UIBadge>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          disabled={joiningSessionId === item.id}
                                          onClick={() => handleJoinSession(item)}
                                          className="gap-1.5"
                                        >
                                          {joiningSessionId === item.id
                                            ? <Loader2 size={14} className="animate-spin" />
                                            : <ExternalLink size={14} />}
                                          Join as Moderator
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon"><MoreHorizontal size={18} /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem className="text-destructive" onClick={() => setSessionToDelete(item)}>
                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                    Delete Session
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-20">
                            <EmptyState 
                                icon={<Video className="h-16 w-16 text-muted-foreground/20" />}
                                title="No upcoming sessions"
                                description="There are no globally scheduled live classes at this time."
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="border-none shadow-lg overflow-hidden opacity-80">
                <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="flex items-center gap-2">
                        <Tv className="h-5 w-5 text-muted-foreground" />
                        Past Session Archives
                    </CardTitle>
                    <CardDescription>Records of completed streaming events.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {pastSessions.length > 0 ? (
                        <div className="divide-y max-h-[400px] overflow-y-auto">
                            {pastSessions.map((item) => (
                                <div key={item.id} className="p-4 px-6 flex justify-between items-center text-sm">
                                    <div>
                                        <p className="font-bold">{item.title}</p>
                                        <p className="text-xs text-muted-foreground">Ended on {new Date(item.startTime).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => handleViewLog(item.title)}>
                                            <Eye className="mr-2 h-4 w-4" /> View Log
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => setSessionToDelete(item)}><Trash2 size={16} className="text-muted-foreground" /></Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="p-12 text-center text-muted-foreground italic text-sm">No archived sessions found.</p>
                    )}
                </CardContent>
            </Card>
        </div>

        <aside className="space-y-6">
            <Card className="bg-primary text-primary-foreground border-none shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <ShieldCheck size={120} />
                </div>
                <CardHeader>
                    <CardTitle className="text-lg">Platform Integrity</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-4 text-primary-foreground/80 leading-relaxed">
                    <p>External Zoom links are stored securely and only delivered to verified enrolled students via a server-side action.</p>
                    <p>The raw link is never exposed in client-readable Firestore documents.</p>
                </CardContent>
            </Card>
        </aside>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Global Session</DialogTitle>
            <DialogDescription>
              Create a secure webinar with your Zoom meeting link. Accessible to all enrolled students.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Session Title</Label>
              <Input
                id="title"
                placeholder="e.g., 'National ICAG Q&A Marathon'"
                value={newSession.title}
                onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zoomUrl" className="flex items-center gap-1.5">
                <LinkIcon size={13} /> Zoom Meeting Link
              </Label>
              <Input
                id="zoomUrl"
                type="url"
                placeholder="https://zoom.us/j/..."
                value={newSession.zoomUrl}
                onChange={(e) => setNewSession({ ...newSession, zoomUrl: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">
                Paste the invite link from zoom.us. It is never exposed publicly.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={newSession.date}
                  onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={newSession.time}
                  onChange={(e) => setNewSession({ ...newSession, time: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateSession} disabled={isSubmitting} className="gap-2">
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CalendarIcon size={16} />}
              Schedule Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Live Session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove &ldquo;{sessionToDelete?.title}&rdquo; from the platform schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
