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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
    Calendar as CalendarIcon, 
    Video, 
    PlusCircle, 
    Tv, 
    Loader2,
    AlertCircle,
    Clock, 
    Trash2, 
    ShieldCheck, 
    MoreVertical,
    ExternalLink,
    Link as LinkIcon,
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
import { type LiveClass } from '@/lib/db';
import { getLiveClassesByTutorId } from '@/lib/live-class-data';
import { createLiveSessionApi, deleteLiveSessionApi, getLiveSessionJoinUrlApi } from '@/lib/live-session-api';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { EmptyState } from '@/components/dashboard/empty-state';
import { Badge } from '@/components/ui/badge';
import { useTutorCourses } from '@/hooks/use-tutor-courses';
import { isQuotaError } from '@/lib/service-errors';
import { reportQuotaError } from '@/lib/feedback/quota-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DEFAULT_SESSION_DURATION_MINUTES = 60;

export default function LiveSessionsPage() {
  const { user: tutor, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { courses, isLoading: isCoursesLoading } = useTutorCourses();
  
  const [liveSessions, setLiveSessions] = useState<LiveClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Create Session State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newSession, setNewSession] = useState({
    title: '',
    courseId: '',
    date: '',
    time: '',
    zoomUrl: '',
    durationMinutes: DEFAULT_SESSION_DURATION_MINUTES,
  });

  // Join loading state per session
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);

  // Delete State
  const [sessionToDelete, setSessionToDelete] = useState<LiveClass | null>(null);

  const fetchTutorClasses = useCallback(async () => {
    if (!tutor) return;
    if (!firestore) {
      setLoadError('Live sessions are still loading. Please wait a moment and retry.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getLiveClassesByTutorId(firestore, tutor.uid);
      setLiveSessions(data);
    } catch (error) {
      console.error('[LiveSessions] Sync Error:', error);
      setLoadError('Failed to load live sessions. Please try again.');
      if (isQuotaError(error)) {
        reportQuotaError(error);
      }
      toast({
        variant: 'destructive',
        title: 'Failed to load sessions',
        description: 'Could not sync your live classes.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [tutor, firestore, toast]);

  useEffect(() => {
    if (!isUserLoading && firestore) {
        fetchTutorClasses();
    }
  }, [isUserLoading, firestore, fetchTutorClasses]);

  const handleCreateSession = async () => {
    if (!newSession.title || !newSession.courseId || !newSession.date || !newSession.time || !newSession.zoomUrl) {
        toast({ variant: 'destructive', title: 'Incomplete Form', description: 'All fields including the Zoom meeting link are required.' });
        return;
    }

    if (!tutor) {
        toast({ variant: 'destructive', title: 'Auth Error', description: 'Please wait for your profile to load.' });
        return;
    }

    setIsSubmitting(true);
    
    try {
        const [year, month, day] = newSession.date.split('-').map(Number);
        const [hours, minutes] = newSession.time.split(':').map(Number);
        const startTime = new Date(year, month - 1, day, hours, minutes);

        if (isNaN(startTime.getTime())) {
            throw new Error('Invalid date or time format provided.');
        }

        const idToken = await tutor.getIdToken();
        await createLiveSessionApi(idToken, {
          title: newSession.title,
          tutorId: tutor.uid,
          courseId: newSession.courseId,
          zoomUrl: newSession.zoomUrl,
          startTime: startTime.toISOString(),
          durationMinutes: newSession.durationMinutes,
        });

        // Refresh list to get the newly created session
        await fetchTutorClasses();
        setIsDialogOpen(false);
        setNewSession({ title: '', courseId: '', date: '', time: '', zoomUrl: '', durationMinutes: DEFAULT_SESSION_DURATION_MINUTES });
        toast({ title: 'Session Created', description: 'Students can now see this in their dashboard.' });

    } catch (error: any) {
        console.error('[LiveSessions] Creation failed:', error);
        toast({ 
            variant: 'destructive', 
            title: 'Creation Failed', 
            description: error.message || 'Unable to create the session right now. Please retry in a moment.' 
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleJoinSession = async (session: LiveClass) => {
    if (!tutor) return;
    setJoiningSessionId(session.id);
    try {
      const idToken = await tutor.getIdToken();
      const result = await getLiveSessionJoinUrlApi(idToken, session.id);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to get meeting link.' });
    } finally {
      setJoiningSessionId(null);
    }
  };

  const confirmDelete = async () => {
    if (!sessionToDelete || !tutor) return;
    
    try {
        const idToken = await tutor.getIdToken();
        await deleteLiveSessionApi(idToken, sessionToDelete.id);
        setLiveSessions(prev => prev.filter(s => s.id !== sessionToDelete.id));
        toast({ title: 'Session Cancelled', variant: 'destructive' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    } finally {
        setSessionToDelete(null);
    }
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

  const canJoin = (startTime: string) => {
      const now = new Date().getTime();
      const start = new Date(startTime).getTime();
      const diff = start - now;
      return diff <= 900000; // 15 mins before
  };

  if (loadError && !isLoading && liveSessions.length === 0) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load sessions</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Button onClick={() => void fetchTutorClasses()}>Retry</Button>
      </div>
    );
  }

  if (isUserLoading || isLoading || isCoursesLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 font-headline tracking-tight">Live Sessions HQ</h1>
          <p className="text-muted-foreground text-sm">
            Schedule sessions and securely share your Zoom meeting with enrolled students only.
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gap-2 shadow-lg">
          <PlusCircle size={18} />
          Schedule New Session
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-8">
        <div className="space-y-8">
            <Card className="border-none shadow-lg overflow-hidden">
                <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="flex items-center gap-2">
                        <Video size={18} className="text-primary" />
                        Upcoming Broadcasts
                    </CardTitle>
                    <CardDescription>
                        You can start the session up to 15 minutes before the scheduled time.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {upcomingSessions.length > 0 ? (
                        <div className="divide-y">
                            {upcomingSessions.map((item) => (
                                <div key={item.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-muted/10 transition-colors group">
                                    <div className="space-y-1">
                                        <p className="font-bold text-lg leading-tight">{item.title}</p>
                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground uppercase font-black tracking-widest pt-1">
                                            <span className="flex items-center gap-1"><Clock size={12} /> {new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                                            <span className="flex items-center gap-1"><CalendarIcon size={12} /> {new Date(item.startTime).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {canJoin(item.startTime) ? (
                                            <Button
                                              size="sm"
                                              className="bg-success hover:bg-success/90 gap-2 font-bold px-6 h-10"
                                              disabled={joiningSessionId === item.id}
                                              onClick={() => handleJoinSession(item)}
                                            >
                                              {joiningSessionId === item.id
                                                ? <Loader2 size={16} className="animate-spin" />
                                                : <ExternalLink size={16} />}
                                              Start Now
                                            </Button>
                                        ) : (
                                            <Badge variant="outline" className="h-10 px-4 border-dashed border-muted-foreground/30 text-muted-foreground">
                                                Opens 15 min before
                                            </Badge>
                                        )}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-10 w-10"><MoreVertical size={18} /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem className="text-destructive" onClick={() => setSessionToDelete(item)}>
                                                    <Trash2 className="mr-2 h-4 w-4" /> Cancel Session
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
                                icon={<CalendarIcon className="h-16 w-16 text-muted-foreground/20" />}
                                title="Schedule clear"
                                description="You have no upcoming live sessions scheduled."
                                action={<Button onClick={() => setIsDialogOpen(true)} variant="outline">Create a Workshop</Button>}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {pastSessions.length > 0 && (
                <Card className="border-none shadow-lg overflow-hidden opacity-80">
                    <CardHeader className="bg-muted/30 border-b">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Tv size={18} className="text-muted-foreground" />
                            Past Sessions
                        </CardTitle>
                        <CardDescription>
                            Reference list of sessions you have already hosted.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y max-h-[320px] overflow-y-auto">
                            {pastSessions.map((item) => (
                                <div key={item.id} className="p-4 px-6 flex justify-between items-center text-sm">
                                    <div>
                                        <p className="font-bold">{item.title}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-black">Concluded {new Date(item.startTime).toLocaleDateString()}</p>
                                    </div>
                                    <Badge variant="outline">Completed</Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>

        <aside className="space-y-6">
            <Card className="bg-primary text-primary-foreground border-none shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <ShieldCheck size={120} />
                </div>
                <CardHeader>
                    <CardTitle className="text-lg">How It Works</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-4 text-primary-foreground/80 leading-relaxed relative z-10">
                    <p>1. Go to <strong>zoom.us</strong>, create a meeting and copy the invite link.</p>
                    <p>2. Paste the link here when scheduling your session.</p>
                    <p>3. The link is stored securely — students can only access it after enrollment is verified.</p>
                    <p>4. Click <strong>Start Now</strong> to open Zoom directly when it is time.</p>
                </CardContent>
            </Card>
        </aside>
      </div>

      {/* Schedule Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Live Session</DialogTitle>
            <DialogDescription>
              Paste your Zoom meeting link. Only enrolled students can access it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="course">Course</Label>
              <Select value={newSession.courseId} onValueChange={(value) => setNewSession({ ...newSession, courseId: value })}>
                <SelectTrigger id="course" className="h-12">
                  <SelectValue placeholder="Select the course for this session" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Session Title</Label>
              <Input
                id="title"
                placeholder="e.g. ICAG Level 2 Exam Strategy"
                value={newSession.title}
                onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                className="h-12 font-bold"
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
                className="h-12"
              />
              <p className="text-[11px] text-muted-foreground">
                Go to zoom.us → Meetings → Copy Invitation Link. This URL is stored securely and is never exposed publicly.
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
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time (GMT)</Label>
                <Input
                  id="time"
                  type="time"
                  value={newSession.time}
                  onChange={(e) => setNewSession({ ...newSession, time: e.target.value })}
                  className="h-12"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-6 rounded-b-lg border-t mt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleCreateSession} disabled={isSubmitting} className="font-bold h-11 px-8">
              {isSubmitting ? <Loader2 size={16} className="animate-spin mr-2" /> : <PlusCircle size={16} className="mr-2" />}
              Publish Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!sessionToDelete} onOpenChange={(open) => !open && setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove &ldquo;{sessionToDelete?.title}&rdquo; from the schedule. Students will no longer see it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Session</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Cancel Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
