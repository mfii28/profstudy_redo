
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveAvatarUrl } from '@/lib/media-url';
import { Ticket, Send, Loader2, Search, CheckCircle2, RotateCcw, Clock, AlertCircle, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { type SupportTicket, type User, type SupportTicketReply } from "@/lib/db";
import { getSupportTickets, updateSupportTicket } from '@/lib/support-data';
import { getUsers } from '@/lib/user-data';
import { useUser } from '@/firebase';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const getPriorityVariant = (priority: SupportTicket['priority']): 'default' | 'destructive' | 'secondary' => {
    if (priority === 'High') return 'destructive';
    if (priority === 'Medium') return 'default';
    return 'secondary';
}

function canonicalSupportStatus(status: SupportTicket['status']): 'open' | 'pending' | 'resolved' {
    const s = String(status).toLowerCase();
    if (s === 'closed' || s === 'resolved') return 'resolved';
    if (s === 'in progress' || s === 'pending') return 'pending';
    return 'open';
}

const getStatusVariant = (status: SupportTicket['status']): 'default' | 'secondary' | 'destructive' | 'outline' => {
    const c = canonicalSupportStatus(status);
    if (c === 'open') return 'default';
    if (c === 'pending') return 'outline';
    return 'secondary';
};

export default function SupportTicketingPage() {
    const { user: adminUser, isLoading: isUserLoading } = useUser();
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
    const [reply, setReply] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'pending' | 'resolved'>('all');
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [allTickets, allUsersResult] = await Promise.all([
                getSupportTickets(),
                getUsers()
            ]);
            setTickets(allTickets);
            setActiveTicket((previousTicket) => {
                if (!previousTicket) {
                    return allTickets[0] ?? null;
                }

                return allTickets.find((ticket) => ticket.id === previousTicket.id) ?? allTickets[0] ?? null;
            });
            
            setUsers(allUsersResult.users);
        } catch (error) {
            console.error('Failed to fetch support data:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [activeTicket?.replies]);

    const getUser = (userId: string) => users.find(u => u.id === userId);

    const handlePostReply = () => {
        if (!reply.trim() || !activeTicket || !adminUser) return;
        
        const newReply: SupportTicketReply = {
            authorId: adminUser.uid,
            date: new Date().toISOString(),
            message: reply,
        };
        
        const updatedTicket: SupportTicket = {
            ...activeTicket,
            replies: [...activeTicket.replies, newReply],
            status: 'pending',
        };
        
        // Optimistic Update
        setTickets(prev => prev.map(t => t.id === updatedTicket.id ? updatedTicket : t));
        setActiveTicket(updatedTicket);
        setReply('');

        // Persist
        updateSupportTicket(updatedTicket);
    };

    const handleUpdateStatus = (newStatus: SupportTicket['status']) => {
        if (!activeTicket) return;
        
        const updatedTicket: SupportTicket = {
            ...activeTicket,
            status: newStatus
        };

        // Optimistic Update
        setTickets(prev => prev.map(t => t.id === updatedTicket.id ? updatedTicket : t));
        setActiveTicket(updatedTicket);

        // Persist
        updateSupportTicket(updatedTicket);
    };

    const filteredTickets = tickets.filter(t => {
        const userName = String(getUser(t.userId)?.name || '').toLowerCase();
        const matchesSearch = 
            t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
            userName.includes(searchTerm.toLowerCase());
        
        const matchesStatus =
            statusFilter === 'all' || canonicalSupportStatus(t.status) === statusFilter;
        
        return matchesSearch && matchesStatus;
    });

    if (isLoading || isUserLoading) {
        return (
            <div className="flex h-[calc(100vh-100px)] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Syncing Support Desk...</p>
                </div>
            </div>
        );
    }

  return (
    <div className="space-y-8 h-[calc(100vh-140px)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl">
                <Ticket className="h-8 w-8 text-primary" />
            </div>
            <div>
                <h1 className="text-3xl font-bold mb-1 font-headline text-foreground">Support Command Center</h1>
                <p className="text-muted-foreground text-sm">
                    Manage communications and resolve technical or academic issues.
                </p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
                <RotateCcw size={14} /> Refresh Desk
            </Button>
        </div>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-[350px_1fr] gap-6 flex-1 min-h-0">
            <Card className="flex flex-col overflow-hidden border-none shadow-lg">
                <CardHeader className="bg-muted/30 border-b p-4 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Filter by student or subject..." 
                            className="pl-9 bg-background" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)} className="w-full">
                        <TabsList className="grid grid-cols-4 h-8 bg-muted/50 p-1">
                            <TabsTrigger value="all" className="text-[10px] font-bold">All</TabsTrigger>
                            <TabsTrigger value="open" className="text-[10px] font-bold">Open</TabsTrigger>
                            <TabsTrigger value="pending" className="text-[10px] font-bold">Pending</TabsTrigger>
                            <TabsTrigger value="resolved" className="text-[10px] font-bold">Resolved</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <ScrollArea className="flex-1">
                    <CardContent className="p-2 space-y-1">
                        {filteredTickets.map(ticket => {
                            const user = getUser(ticket.userId);
                            const isActive = activeTicket?.id === ticket.id;
                            return (
                                <Button 
                                    key={ticket.id} 
                                    variant={isActive ? 'secondary' : 'ghost'} 
                                    className={cn(
                                        "w-full h-auto justify-start p-4 text-left border-transparent transition-all",
                                        isActive ? "bg-primary/5 border-l-4 border-l-primary shadow-sm" : "hover:bg-muted/50"
                                    )} 
                                    onClick={() => setActiveTicket(ticket)}
                                >
                                    <div className="flex items-start gap-3 w-full">
                                        <div className="relative">
                                            <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                                                <AvatarImage src={resolveAvatarUrl(user?.avatar)} />
                                                <AvatarFallback className="bg-primary/10 text-primary">{user?.name?.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            {canonicalSupportStatus(ticket.status) === 'open' && (
                                                <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-destructive border-2 border-background" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <p className="font-bold truncate text-sm text-foreground leading-tight">{ticket.subject}</p>
                                                <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{new Date(ticket.date).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground truncate font-medium mt-0.5">Student: {user?.name}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <Badge variant={getStatusVariant(ticket.status)} className="text-[9px] h-4 px-1.5 font-black uppercase tracking-tighter">{ticket.status}</Badge>
                                                <Badge variant={getPriorityVariant(ticket.priority)} className="text-[9px] h-4 px-1.5 font-black uppercase tracking-tighter">{ticket.priority}</Badge>
                                            </div>
                                        </div>
                                    </div>
                                </Button>
                            )
                        })}
                        {filteredTickets.length === 0 && (
                            <div className="py-20 text-center text-muted-foreground flex flex-col items-center gap-3">
                                <Ticket className="h-12 w-12 opacity-10" />
                                <div className="space-y-1">
                                    <p className="font-bold text-sm">Clear Workspace</p>
                                    <p className="text-[10px]">No {statusFilter !== 'all' ? statusFilter.toLowerCase() : ''} tickets found matching filters.</p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </ScrollArea>
            </Card>

            <Card className="flex flex-col overflow-hidden border-none shadow-lg">
                {activeTicket ? (
                    <>
                        <CardHeader className="border-b bg-card p-6 flex flex-row items-center justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <CardTitle className="text-xl font-bold truncate max-w-lg">{activeTicket.subject}</CardTitle>
                                    <Badge variant={getPriorityVariant(activeTicket.priority)} className="text-[10px] h-5">{activeTicket.priority}</Badge>
                                </div>
                                <CardDescription className="flex items-center gap-2">
                                    ID: {activeTicket.id.split('-')[1]} 
                                    <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                                    Category: {activeTicket.category}
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                {canonicalSupportStatus(activeTicket.status) !== 'resolved' ? (
                                    <Button variant="outline" size="sm" className="gap-2 text-success hover:bg-success/5 border-success/20" onClick={() => handleUpdateStatus('resolved')}>
                                        <CheckCircle2 size={14} /> Resolve Ticket
                                    </Button>
                                ) : (
                                    <Button variant="outline" size="sm" className="gap-2" onClick={() => handleUpdateStatus('pending')}>
                                        <RotateCcw size={14} /> Re-open Ticket
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <ScrollArea className="flex-1 bg-slate-50 dark:bg-slate-900/20" ref={scrollRef}>
                            <CardContent className="p-6 space-y-8">
                                <div className="flex items-start gap-4">
                                    <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
                                        <AvatarImage src={resolveAvatarUrl(getUser(activeTicket.userId)?.avatar)} />
                                        <AvatarFallback>{getUser(activeTicket.userId)?.name?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="rounded-2xl rounded-tl-none p-4 bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 max-w-2xl text-sm leading-relaxed">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="font-bold text-primary">{getUser(activeTicket.userId)?.name}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Initiated Ticket</span>
                                        </div>
                                        <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                                            {activeTicket.description?.trim() || activeTicket.subject}
                                        </p>
                                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50 dark:border-slate-700/50">
                                            <Clock size={10} className="text-muted-foreground" />
                                            <p className="text-muted-foreground text-[10px]">{new Date(activeTicket.date).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>

                                {activeTicket.replies.map((r, index) => {
                                    const author = getUser(r.authorId);
                                    const isStaff = author?.role === 'admin' || author?.role === 'superadmin' || author?.role === 'subadmin' || author?.role === 'tutor';
                                    return (
                                        <div key={index} className={cn("flex items-start gap-4", isStaff ? "justify-end" : "justify-start")}>
                                             {!isStaff && (
                                                <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
                                                    <AvatarImage src={resolveAvatarUrl(author?.avatar)} />
                                                    <AvatarFallback>{author?.name?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                            )}
                                             <div className={cn(
                                                 "rounded-2xl p-4 text-sm max-w-[80%] shadow-sm border leading-relaxed transition-all",
                                                 isStaff 
                                                    ? "bg-primary text-primary-foreground border-primary/20 rounded-tr-none shadow-md" 
                                                    : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 rounded-tl-none"
                                             )}>
                                                <div className={cn("flex items-center gap-2 mb-1.5", isStaff ? "justify-end" : "")}>
                                                    {isStaff && <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Staff Response</span>}
                                                    <p className="font-bold">{author?.name}</p>
                                                    {!isStaff && <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Student</span>}
                                                </div>
                                                <p className="whitespace-pre-wrap">{r.message}</p>
                                                <p className={cn("text-[9px] mt-3 font-mono font-medium", isStaff ? "text-primary-foreground/60" : "text-muted-foreground")}>
                                                    {formatDistanceToNow(new Date(r.date), { addSuffix: true })}
                                                </p>
                                             </div>
                                            {isStaff && (
                                                <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
                                                    <AvatarImage src={resolveAvatarUrl(author?.avatar)} />
                                                    <AvatarFallback className="bg-primary-foreground text-primary font-bold">{author?.name?.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                            )}
                                        </div>
                                    )
                                })}
                            </CardContent>
                        </ScrollArea>
                        <CardFooter className="p-4 border-t bg-white dark:bg-slate-950">
                            {canonicalSupportStatus(activeTicket.status) === 'resolved' ? (
                                <div className="flex items-center justify-center w-full gap-3 p-4 bg-muted/30 rounded-xl border border-dashed">
                                    <AlertCircle size={16} className="text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground font-medium">This ticket is marked as resolved. Re-open to send more messages.</p>
                                    <Button variant="link" size="sm" className="h-auto p-0 text-xs font-bold underline" onClick={() => handleUpdateStatus('pending')}>Re-open</Button>
                                </div>
                            ) : (
                                <form className="flex w-full items-end space-x-3" onSubmit={(e) => { e.preventDefault(); handlePostReply(); }}>
                                    <div className="flex-1">
                                        <Input 
                                            placeholder="Write a professional response to resolve this issue..." 
                                            value={reply} 
                                            onChange={e => setReply(e.target.value)} 
                                            className="resize-none border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-muted/30 rounded-xl px-4 py-3 text-sm"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handlePostReply();
                                                }
                                            }}
                                        />
                                    </div>
                                    <Button 
                                        onClick={handlePostReply} 
                                        disabled={!reply.trim() || isUserLoading}
                                        className="h-12 w-12 rounded-xl shrink-0 shadow-lg transition-transform active:scale-95"
                                        size="icon"
                                    >
                                        <Send className="h-5 w-5" />
                                        <span className="sr-only">Send Response</span>
                                    </Button>
                                </form>
                            )}
                        </CardFooter>
                    </>
                ) : (
                    <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground gap-6 bg-slate-50 dark:bg-slate-900/10">
                        <div className="relative">
                            <div className="p-10 bg-muted rounded-full animate-pulse opacity-20">
                                <Ticket size={80} />
                            </div>
                            <Filter size={24} className="absolute bottom-2 right-2 text-primary opacity-40" />
                        </div>
                        <div className="text-center max-w-xs space-y-2">
                            <p className="text-xl font-bold text-foreground">Awaiting Ticket Selection</p>
                            <p className="text-sm leading-relaxed">Choose a student inquiry from the sidebar to view the full interaction history and provide academic or technical assistance.</p>
                        </div>
                    </div>
                )}
            </Card>
      </div>
    </div>
  );
}
