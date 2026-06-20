'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Megaphone, 
  Mail, 
  Info, 
  AlertTriangle, 
  PartyPopper, 
  Loader2, 
  Sparkles, 
  ShieldAlert, 
  Users, 
  Send,
  Search,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type Announcement, type User } from '@/lib/db';
import { getAnnouncements, saveAnnouncement, subscribeToAnnouncements } from '@/lib/marketing-data';
import { getUsers } from '@/lib/user-data';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/dashboard/empty-state';
import { sendPlatformEmail } from '@/app/actions/email';
import { buildAnnouncementEmailHtml } from '@/lib/email-templates';
import { broadcastAnnouncementNotification } from '@/app/actions/notifications';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { sanitizeHtml } from '@/lib/sanitize';
import { useUser } from '@/firebase';
import { generateSecurityAlertForAdmin, refineAnnouncementForAdmin } from '@/app/actions/announcement-ai';

const MESSAGE_MAX_CHARS = 2000;

export default function GlobalAnnouncementsPage() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const { user: adminUser } = useUser();

    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [type, setType] = useState<'Info' | 'Warning' | 'Promotion'>('Info');
    const [activeTab, setActiveTab] = useState('in-app');
    const [composeTab, setComposeTab] = useState<'compose' | 'preview'>('compose');
    const [audience, setAudience] = useState<'all' | 'students' | 'tutors' | 'specific'>('all');
    const [selectedUserId, setSelectedUserId] = useState('');
    const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
    const [expiresAt, setExpiresAt] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [annData, { users }] = await Promise.all([
                    getAnnouncements(),
                    getUsers()
                ]);
                setAnnouncements(annData);
                setAllUsers(users);
            } catch (error) {
                console.error("Fetch error:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        const unsubscribe = subscribeToAnnouncements(
            (annData) => {
                setAnnouncements(annData);
                setIsLoading(false);
            },
            undefined,
            () => {
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    // Live email HTML preview
    const emailPreviewHtml = useMemo(() => {
        if (activeTab !== 'email' || !title) return '';
        try {
            return buildAnnouncementEmailHtml(
                'Profs Training Solutions',
                audience === 'specific'
                    ? (allUsers.find(u => u.id === selectedUserId)?.name || 'Member')
                    : '{{name}}',
                'preview@example.com',
                title || 'Your Subject Line',
                message || 'Your message body will appear here...',
                type
            );
        } catch {
            return '';
        }
    }, [activeTab, title, message, type, audience, selectedUserId, allUsers]);

    const handleSendAnnouncement = async () => {
        if (!title || !message) {
            toast({ variant: 'destructive', title: 'All fields are required.' });
            return;
        }
        setIsSaving(true);

        try {
            const idToken = adminUser ? await adminUser.getIdToken(true) : undefined;

            if (activeTab === 'email') {
                // When audience is 'specific', resolve the individual email address;
                // otherwise pass the audience literal directly ('all', 'students', 'tutors').
                const targetEmail: string =
                    audience === 'specific'
                        ? (allUsers.find(u => u.id === selectedUserId)?.email ?? '')
                        : (audience as 'all' | 'students' | 'tutors');

                if (!targetEmail) {
                    throw new Error('Please select a valid recipient for the email.');
                }

                const emailResult = await sendPlatformEmail({
                    to: targetEmail,
                    subject: title,
                    message,
                    type,
                    idToken,
                });

                if (emailResult.error) {
                    throw new Error(emailResult.error);
                }

                const sentCount = emailResult.sentCount ?? emailResult.count ?? 1;
                const failedCount = emailResult.failedCount ?? 0;
                const audienceLabel = audience === 'all' ? 'all users' : audience;
                const description = failedCount > 0
                    ? `${sentCount} sent, ${failedCount} failed — see audit logs for details.`
                    : `${sentCount} email${sentCount !== 1 ? 's' : ''} sent successfully to ${audienceLabel}.`;
                toast({
                    title: failedCount > 0 ? 'Campaign Partially Delivered' : 'Campaign Delivered!',
                    description,
                    variant: failedCount > 0 ? 'destructive' : 'default',
                });
            } else {
                if (!idToken) {
                    throw new Error('Admin authentication required. Please sign in again.');
                }
                const notifyResult = await broadcastAnnouncementNotification({
                    idToken,
                    title,
                    message,
                    type,
                    audience,
                    targetUserId: audience === 'specific' ? selectedUserId : undefined,
                });

                if ('error' in notifyResult && notifyResult.error) {
                    throw new Error(notifyResult.error);
                }

                toast({
                    title: 'Announcement Published!',
                    description: 'The banner is now live for all users.',
                });
            }

            await saveAnnouncement({
                title: `${activeTab === 'email' ? '[Email] ' : ''}${title}`,
                message,
                type,
                priority,
                isActive,
                expiresAt: expiresAt || undefined,
            });

            setTitle('');
            setMessage('');
            setAudience('all');
            setSelectedUserId('');
            setPriority('Medium');
            setExpiresAt('');
            setIsActive(true);
            setComposeTab('compose');

            const updatedAnnouncements = await getAnnouncements();
            setAnnouncements(updatedAnnouncements);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Delivery Error', description: error.message || 'Could not deliver the message.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleAiRefine = async () => {
        if (!message.trim()) return;
        setIsAiLoading(true);
        try {
            const response = await refineAnnouncementForAdmin(message, 'Professional');
            if (response.error) {
                throw new Error(response.error);
            }
            if (!response.result) {
                throw new Error('AI did not return a refinement result.');
            }
            const result = response.result;
            setMessage(result.message);
            if (result.subject) setTitle(result.subject);
            toast({ title: 'AI Refinement Complete' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'AI Error', description: error?.message || 'Could not refine the announcement.' });
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleAiSecurityAlert = async () => {
        setIsAiLoading(true);
        try {
            const response = await generateSecurityAlertForAdmin('suspicious login patterns and potential account sharing');
            if (response.error) {
                throw new Error(response.error);
            }
            if (!response.result) {
                throw new Error('AI did not return a security alert result.');
            }
            const result = response.result;
            setMessage(result.message);
            if (result.subject) setTitle(result.subject);
            setType('Warning');
            toast({ title: 'Security Alert Generated' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'AI Error', description: error?.message || 'Could not generate the security alert.' });
        } finally {
            setIsAiLoading(false);
        }
    };

    const getIcon = (t: Announcement['type']) => {
        switch (t) {
            case 'Info': return <Info className="h-5 w-5 text-blue-500" />;
            case 'Warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
            case 'Promotion': return <PartyPopper className="h-5 w-5 text-green-500" />;
        }
    };

    const charsRemaining = MESSAGE_MAX_CHARS - message.length;
    const isOverLimit = charsRemaining < 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
                <Megaphone className="h-8 w-8 text-primary" />
            </div>
            <div>
                <h1 className="text-3xl font-bold mb-1 font-headline">Communication Center</h1>
                <p className="text-muted-foreground text-sm">
                    Manage in-app banners and email campaigns for tutors and students.
                </p>
            </div>
        </div>
        <Button 
            variant="outline" 
            className="border-red-200 text-red-600 hover:bg-red-50 gap-2"
            onClick={handleAiSecurityAlert}
            disabled={isAiLoading}
        >
            {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
            AI Security Alert
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setComposeTab('compose'); }} className="w-full">
                <TabsList className="bg-muted/50 p-1 mb-4">
                    <TabsTrigger value="in-app" className="gap-2">
                        <Megaphone size={16} /> In-App Banner
                    </TabsTrigger>
                    <TabsTrigger value="email" className="gap-2">
                        <Mail size={16} /> Email Campaign
                    </TabsTrigger>
                </TabsList>

                <Card className="border-none shadow-lg">
                    <CardHeader className="bg-muted/30 border-b">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Compose {activeTab === 'email' ? 'Email Campaign' : 'In-App Announcement'}</CardTitle>
                                <CardDescription>Target specific groups or individuals with important updates.</CardDescription>
                            </div>
                            {activeTab === 'email' && (
                                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                                    <Button
                                        variant={composeTab === 'compose' ? 'secondary' : 'ghost'}
                                        size="sm"
                                        className="h-7 text-xs gap-1.5"
                                        onClick={() => setComposeTab('compose')}
                                    >
                                        <Mail size={12} /> Compose
                                    </Button>
                                    <Button
                                        variant={composeTab === 'preview' ? 'secondary' : 'ghost'}
                                        size="sm"
                                        className="h-7 text-xs gap-1.5"
                                        onClick={() => setComposeTab('preview')}
                                    >
                                        <Eye size={12} /> Preview
                                    </Button>
                                </div>
                            )}
                        </div>
                    </CardHeader>

                    {activeTab === 'email' && composeTab === 'preview' ? (
                        <CardContent className="p-6">
                            <p className="text-xs text-muted-foreground mb-3 font-medium">Email preview — exactly what recipients will see:</p>
                            <div className="rounded-xl border overflow-hidden bg-slate-100" style={{ height: 520 }}>
                                {emailPreviewHtml ? (
                                    <iframe
                                        srcDoc={sanitizeHtml(emailPreviewHtml)}
                                        className="w-full h-full border-none"
                                        title="Email preview"
                                        sandbox="allow-same-origin"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                        Fill in a subject and message to see the preview.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    ) : (
                        <CardContent className="pt-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Audience</Label>
                                        <Select value={audience} onValueChange={(v: any) => setAudience(v)}>
                                            <SelectTrigger>
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-4 w-4 text-muted-foreground" />
                                                    <SelectValue />
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Everyone (Students & Tutors)</SelectItem>
                                                <SelectItem value="students">All Students</SelectItem>
                                                <SelectItem value="tutors">All Tutors</SelectItem>
                                                <SelectItem value="specific">Specific User</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {audience === 'specific' && (
                                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                                            <Label>Select User</Label>
                                            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                                                <SelectTrigger>
                                                    <div className="flex items-center gap-2">
                                                        <Search className="h-4 w-4 text-muted-foreground" />
                                                        <SelectValue placeholder="Search users..." />
                                                    </div>
                                                </SelectTrigger>
                                                <SelectContent className="max-h-60">
                                                    {allUsers.map(u => (
                                                        <SelectItem key={u.id} value={u.id}>
                                                            {u.name} ({u.email})
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <Label htmlFor="type">Message Type</Label>
                                        <Select value={type} onValueChange={(v: any) => setType(v)}>
                                            <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Info">Info (Blue)</SelectItem>
                                                <SelectItem value="Warning">Warning (Yellow/Urgent)</SelectItem>
                                                <SelectItem value="Promotion">Promotion (Green/Sales)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Priority Level</Label>
                                        <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Low">Low</SelectItem>
                                                <SelectItem value="Medium">Medium</SelectItem>
                                                <SelectItem value="High">High</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Expiry Date (optional)</Label>
                                        <Input
                                            type="datetime-local"
                                            value={expiresAt}
                                            onChange={e => setExpiresAt(e.target.value)}
                                        />
                                        <p className="text-[10px] text-muted-foreground">Leave blank for no expiry.</p>
                                    </div>

                                    <div className="flex items-center justify-between p-3 border rounded-xl bg-muted/10">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm">Active</Label>
                                            <p className="text-[10px] text-muted-foreground">Show this announcement immediately.</p>
                                        </div>
                                        <Switch checked={isActive} onCheckedChange={setIsActive} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="title">{activeTab === 'email' ? 'Email Subject' : 'Banner Title'}</Label>
                                    <Input
                                        id="title"
                                        placeholder={activeTab === 'email' ? "PTS Update: Action Required" : "Global System Update"}
                                        value={title}
                                        onChange={e => setTitle(e.target.value)}
                                        className="font-bold"
                                    />
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">This will be the headline of your message</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="message">Message Body</Label>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-accent hover:text-accent hover:bg-accent/10 h-7"
                                        onClick={handleAiRefine}
                                        disabled={isAiLoading || !message.trim()}
                                    >
                                        {isAiLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                                        Refine with AI
                                    </Button>
                                </div>
                                <Textarea
                                    id="message"
                                    placeholder="Compose your platform message or email content..."
                                    rows={8}
                                    value={message}
                                    onChange={e => setMessage(e.target.value.slice(0, MESSAGE_MAX_CHARS))}
                                    className="resize-none leading-relaxed"
                                />
                                <div className="flex justify-end">
                                    <span className={`text-xs font-mono ${isOverLimit ? 'text-destructive font-bold' : charsRemaining < 200 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                                        {message.length} / {MESSAGE_MAX_CHARS}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    )}

                    <CardFooter className="bg-muted/30 border-t p-6 flex items-center justify-between gap-4">
                        {activeTab === 'email' && composeTab === 'compose' && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => setComposeTab('preview')}
                                disabled={!title && !message}
                            >
                                <Eye className="h-4 w-4" /> Preview Email
                            </Button>
                        )}
                        {activeTab === 'email' && composeTab === 'preview' && (
                            <Button variant="outline" size="sm" onClick={() => setComposeTab('compose')}>
                                ← Back to Edit
                            </Button>
                        )}
                        {activeTab !== 'email' && <span />}
                        <Button
                            onClick={handleSendAnnouncement}
                            disabled={isSaving || !title || !message || isOverLimit || (audience === 'specific' && !selectedUserId)}
                            className="px-8 gap-2"
                            size="lg"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                                activeTab === 'email' ? <Send className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />
                            )}
                            {activeTab === 'email' ? `Send Email to ${audience === 'all' ? 'All' : audience}` : 'Publish Announcement'}
                        </Button>
                    </CardFooter>
                </Card>
            </Tabs>
        </div>

        <div className="space-y-6">
            <Card className="border-none shadow-lg">
                <CardHeader>
                    <CardTitle className="text-lg">Broadcast History</CardTitle>
                    <CardDescription>Review your past communications.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 space-y-4">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    ) : announcements.length > 0 ? (
                        <div className="divide-y">
                            {announcements.slice(0, 5).map(ann => (
                                <div key={ann.id} className="p-4 hover:bg-muted/10 transition-colors flex gap-3 items-start">
                                    <div className="mt-1 shrink-0">{getIcon(ann.type)}</div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-xs truncate">{ann.title}</p>
                                        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{ann.message}</p>
                                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                            <p className="text-[9px] font-mono text-muted-foreground uppercase">
                                                {new Date(ann.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </p>
                                            {ann.title.startsWith('[Email]') && (
                                                <Badge variant="outline" className="text-[8px] h-4 px-1">Campaign</Badge>
                                            )}
                                            {ann.priority && (
                                                <Badge variant={ann.priority === 'High' ? 'destructive' : ann.priority === 'Medium' ? 'secondary' : 'outline'} className="text-[8px] h-4 px-1">
                                                    {ann.priority}
                                                </Badge>
                                            )}
                                            {ann.expiresAt && (
                                                <span className="text-[8px] text-muted-foreground">Exp: {new Date(ann.expiresAt).toLocaleDateString()}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 px-6">
                            <EmptyState
                                icon={<Megaphone className="h-8 w-8 text-muted-foreground/30" />}
                                title="No History"
                                description="Past broadcasts will appear here."
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="bg-slate-900 text-white border-none relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Mail size={100} />
                </div>
                <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-accent" />
                        Campaign AI Tips
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-[11px] space-y-3 text-slate-300 leading-normal">
                    <p>• Use <strong>Refine with AI</strong> to adjust the tone of your emails for better engagement.</p>
                    <p>• Use <strong>Preview Email</strong> to see exactly what recipients will receive before sending.</p>
                    <p>• <strong>Security Alerts</strong> should only be sent globally when genuine suspicious patterns are detected.</p>
                    <p>• Targeted emails to specific students are ideal for resolving manual enrollment or payment disputes.</p>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
