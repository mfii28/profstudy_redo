
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Loader2, Sparkles, Send, History, CheckCircle2, Trash2, ShieldAlert } from "lucide-react";
import { getCoursesByTutorId } from "@/lib/course-data";
import { useUser } from "@/firebase";
import { type Course, type Announcement } from "@/lib/db";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { refineAnnouncement, generateSecurityAlert } from '@/ai/flows/announcement-generator';
import { saveAnnouncement, deleteAnnouncement, updateAnnouncement, subscribeToAnnouncements } from '@/lib/marketing-data';
import { notifyEnrolledStudents } from '@/app/actions/session';


export default function AnnouncementsPage() {
    const { user: tutor, isLoading: isUserLoading } = useUser();
    const { toast } = useToast();
    
    const [taughtCourses, setTaughtCourses] = useState<Course[]>([]);
    const [history, setHistory] = useState<Announcement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Form State
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);

    useEffect(() => {
        if (!tutor) return;

        let cancelled = false;

        const loadCourses = async () => {
            try {
                const courseData = await getCoursesByTutorId(tutor.uid);
                if (!cancelled) {
                    setTaughtCourses(courseData);
                }
            } catch (error) {
                console.error('Failed to load courses for announcements:', error);
            }
        };

        void loadCourses();

        const unsubscribe = subscribeToAnnouncements(
            (announcements) => {
                if (!cancelled) {
                    setHistory(announcements);
                    setIsLoading(false);
                }
            },
            tutor.uid,
            () => {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        );

        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [tutor]);

    const handleAiRefine = async () => {
        if (!message.trim()) return;
        setIsAiLoading(true);
        try {
            const result = await refineAnnouncement({ text: message, tone: 'Professional' });
            setMessage(result.message);
            if (result.subject) setSubject(result.subject);
            toast({ title: "AI Refinement Applied", description: "Your message has been professionally polished." });
        } catch (error) {
            toast({ variant: 'destructive', title: "AI Error", description: "Could not connect to the refinement engine." });
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleAiSecurityAlert = async () => {
        setIsAiLoading(true);
        try {
            const result = await generateSecurityAlert({ incidentType: 'suspicious login patterns and potential account sharing' });
            setMessage(result.message);
            if (result.subject) setSubject(result.subject);
            toast({ 
                title: "Security Alert Generated", 
                description: "A standard high-priority warning has been drafted for your students." 
            });
        } catch (error) {
            toast({ variant: 'destructive', title: "AI Error" });
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleSend = async () => {
        if (!subject || !message || !selectedCourseId || !tutor) {
            toast({ variant: 'destructive', title: "Incomplete Form", description: "Please fill out all fields." });
            return;
        }

        setIsSubmitting(true);
        try {
            const courseName = taughtCourses.find(c => c.id === selectedCourseId)?.title || "Course";

            if (editingAnnouncementId) {
                await updateAnnouncement(editingAnnouncementId, {
                    title: subject,
                    message,
                    courseId: selectedCourseId,
                });
            } else {
                await saveAnnouncement({
                    title: subject,
                    message,
                    type: 'Info',
                    authorId: tutor.uid,
                    courseId: selectedCourseId
                });

                const idToken = await tutor.getIdToken(true);
                const notifyResult = await notifyEnrolledStudents(selectedCourseId, subject, message, idToken);
                if ('error' in notifyResult) {
                    toast({
                        variant: 'destructive',
                        title: 'Announcement saved, notification failed',
                        description: notifyResult.error,
                    });
                    return;
                }
            }

            toast({
                title: editingAnnouncementId ? "Announcement Updated" : "Broadcast Delivered",
                description: `Announcement saved for "${courseName}".`,
            });

            setSubject('');
            setMessage('');
            setSelectedCourseId('');
            setEditingAnnouncementId(null);
        } catch (error) {
            toast({ variant: 'destructive', title: "Delivery Failed" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteAnnouncement(id);
            setHistory(prev => prev.filter(a => a.id !== id));
            toast({ title: "Announcement Removed", variant: "destructive" });
        } catch (error) {
            toast({ variant: 'destructive', title: "Delete Failed" });
        }
    };

    const handleEdit = (announcement: Announcement) => {
        setEditingAnnouncementId(announcement.id);
        setSubject(announcement.title);
        setMessage(announcement.message);
        setSelectedCourseId(announcement.courseId || '');
    };

    const resetComposer = () => {
        setEditingAnnouncementId(null);
        setSubject('');
        setMessage('');
        setSelectedCourseId('');
    };

    if (isUserLoading || isLoading) {
        return (
            <div className="space-y-8">
                <Skeleton className="h-10 w-1/3" />
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
                    <Skeleton className="h-[500px] w-full" />
                    <Skeleton className="h-[500px] w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold mb-1 font-headline tracking-tight">Academic Announcements</h1>
                    <p className="text-muted-foreground text-sm">
                        Notify your students about syllabus changes, live sessions, or exam tips.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        className="border-red-200 text-red-600 hover:bg-red-50 gap-2 font-bold"
                        onClick={handleAiSecurityAlert}
                        disabled={isAiLoading}
                    >
                        {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                        AI Security Alert
                    </Button>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 h-10 px-4 font-bold">
                        <Megaphone className="h-3 w-3 mr-2" />
                        {taughtCourses.length} Active Courses
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">
                <Card className="border-none shadow-lg overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b">
                        <CardTitle>{editingAnnouncementId ? 'Edit Announcement' : 'Compose Broadcast'}</CardTitle>
                        <CardDescription>Messages are saved for the selected course and shown to students in the platform.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="space-y-2">
                            <Label>Target Course</Label>
                            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                                <SelectTrigger className="bg-background h-12 border-2 focus:ring-primary">
                                    <SelectValue placeholder="Choose a course to notify..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {taughtCourses.map(course => (
                                        <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="subject">Subject Line</Label>
                            <Input 
                                id="subject" 
                                placeholder="e.g., Update on IFRS 16 Module" 
                                className="h-12 font-bold"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="message">Announcement Message</Label>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="text-accent hover:text-accent hover:bg-accent/10 h-7 font-bold"
                                    onClick={handleAiRefine}
                                    disabled={isAiLoading || !message.trim()}
                                >
                                    {isAiLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                                    Refine with AI
                                </Button>
                            </div>
                            <Textarea 
                                id="message" 
                                placeholder="Write your professional update here..." 
                                rows={8} 
                                className="resize-none leading-relaxed bg-background border-2 focus:ring-primary"
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="bg-muted/30 border-t p-6">
                        <div className="flex w-full gap-3">
                            {editingAnnouncementId && (
                                <Button variant="outline" className="h-14 px-6" onClick={resetComposer}>
                                    Cancel Edit
                                </Button>
                            )}
                            <Button 
                                className="flex-1 h-14 text-lg font-black gap-2 shadow-xl" 
                                onClick={handleSend}
                                disabled={isSubmitting || !subject || !message || !selectedCourseId}
                            >
                                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin"/> : <Send className="h-5 w-5" />}
                                {editingAnnouncementId ? 'Update Announcement' : 'Send Announcement Now'}
                            </Button>
                        </div>
                    </CardFooter>
                </Card>

                <div className="space-y-6">
                    <Card className="border-none shadow-lg">
                        <CardHeader className="bg-muted/30 border-b">
                            <CardTitle className="text-base flex items-center gap-2">
                                <History size={18} className="text-muted-foreground" />
                                Broadcast History
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {history.length > 0 ? (
                                <div className="divide-y divide-border/50">
                                    {history.map(ann => (
                                        <div key={ann.id} className="p-4 hover:bg-muted/10 transition-colors">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-xs font-black truncate max-w-[200px]">{ann.title}</p>
                                                <span className="text-[10px] font-mono text-muted-foreground uppercase">{new Date(ann.date).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground line-clamp-2 italic leading-relaxed">"{ann.message}"</p>
                                            <div className="mt-3 flex items-center justify-between">
                                                <div className="flex items-center gap-1.5 text-[10px] text-success font-bold uppercase tracking-widest">
                                                    <CheckCircle2 size={12} />
                                                    Delivered
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 text-xs"
                                                        onClick={() => handleEdit(ann)}
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleDelete(ann.id)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-16 text-center text-muted-foreground opacity-30">
                                    <Megaphone size={48} className="mx-auto mb-2" />
                                    <p className="text-xs font-bold uppercase tracking-tighter">No broadcasts yet</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900 text-white border-none shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <Megaphone size={120} />
                        </div>
                        <CardHeader>
                            <CardTitle className="text-lg">Pro Tips</CardTitle>
                        </CardHeader>
                        <CardContent className="text-[11px] space-y-3 text-slate-300 leading-relaxed relative z-10">
                            <p>• Announcements are great for sharing last-minute exam changes or ICAG regulatory updates.</p>
                            <p>• Use AI Refine to tighten wording before publishing an update.</p>
                            <p>• Keep broadcasts short and specific so students can act on them quickly.</p>
                            <p>• Avoid sending too many updates in a short period.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
