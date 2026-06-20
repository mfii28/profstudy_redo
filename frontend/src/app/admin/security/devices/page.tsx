'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Laptop, Ban, Search, Loader2, LogOut, ShieldAlert, RefreshCw, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFirestore } from "@/firebase";
import { collection, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { getUsers } from '@/lib/user-data';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface GlobalSession {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    deviceName: string;
    browser: string;
    location: string;
    lastActive: Date;
}

export default function AdminDeviceManagementPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [sessions, setSessions] = useState<GlobalSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = async () => {
        if (!firestore) return;
        setIsLoading(true);
        try {
            const { users: allUsers } = await getUsers();
            const allSessionsPromises = allUsers.map(async (user) => {
                if (!firestore) return [];
                try {
                    const sessionsRef = collection(firestore!, 'users', user.id, 'activeSessions');
                    const sessionSnap = await getDocs(sessionsRef);
                    return sessionSnap.docs.map(sessionDoc => {
                        const data = sessionDoc.data();
                        let lastActiveDate = new Date();
                        if (data.lastActive?.toDate) lastActiveDate = data.lastActive.toDate();
                        else if (typeof data.lastActive === 'string') lastActiveDate = new Date(data.lastActive);

                        return {
                            id: sessionDoc.id,
                            userId: user.id,
                            userName: user.name,
                            userEmail: user.email,
                            deviceName: data.deviceName || 'Unknown Device',
                            browser: data.browser || 'Unknown Browser',
                            location: data.location || 'Unknown Location',
                            lastActive: lastActiveDate,
                        } as GlobalSession;
                    });
                } catch (userErr) {
                    return [];
                }
            });

            const sessionArrays = await Promise.all(allSessionsPromises);
            const flatSessions = sessionArrays.flat().sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());
            setSessions(flatSessions);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Fetch Error' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (firestore) fetchData();
    }, [firestore]);

    const handleTerminateSession = async (session: GlobalSession) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore!, 'users', session.userId, 'activeSessions', session.id));
            setSessions(prev => prev.filter(s => s.id !== session.id));
            toast({ title: 'Session Terminated' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Action Failed' });
        }
    };

    const handleSuspendUser = async (userId: string, userName: string) => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore!, 'users', userId), { status: 'suspended' });
            toast({ title: 'User Suspended', description: `${userName} has been restricted.` });
            fetchData();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Action Failed' });
        }
    };

    const filteredSessions = sessions.filter(s => 
        s.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.deviceName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl"><Smartphone className="h-8 w-8 text-primary" /></div>
                    <div>
                        <h1 className="text-3xl font-bold mb-1 font-headline">Device Map</h1>
                        <p className="text-muted-foreground text-sm">Monitor connections and manage risks.</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading} className="gap-2">
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_350px] gap-8">
                <Card className="border-none shadow-lg overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b p-6">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search students..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="py-20 flex justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
                        ) : filteredSessions.length > 0 ? (
                            <Table>
                                <TableHeader className="bg-muted/10">
                                    <TableRow>
                                        <TableHead className="pl-6">User</TableHead>
                                        <TableHead>Device</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Last Active</TableHead>
                                        <TableHead className="text-right pr-6">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredSessions.map((session) => (
                                        <TableRow key={session.id} className="hover:bg-muted/5 transition-colors">
                                            <TableCell className="pl-6 py-4">
                                                <p className="font-bold text-sm">{session.userName}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase">{session.userEmail}</p>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    {session.deviceName.toLowerCase().includes('pc') ? <Laptop className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                                                    <span className="text-xs font-bold">{session.deviceName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell><Badge variant="outline" className="text-[10px]">{session.location}</Badge></TableCell>
                                            <TableCell className="text-[10px]">{formatDistanceToNow(session.lastActive, { addSuffix: true })}</TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => handleTerminateSession(session)} title="Logout"><LogOut className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleSuspendUser(session.userId, session.userName)} title="Suspend"><Ban className="h-4 w-4" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : <p className="py-24 text-center text-muted-foreground">No active sessions.</p>}
                    </CardContent>
                </Card>

                <aside className="space-y-6">
                    <Card className="bg-slate-900 text-white border-none shadow-xl">
                        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ShieldAlert size={18} className="text-accent" /> Risk Monitor</CardTitle></CardHeader>
                        <CardContent className="space-y-4 text-xs text-slate-300">
                            <p>Concurrent sessions per user may indicate **Account Sharing**.</p>
                            <div className="p-3 bg-white/5 rounded-lg border border-white/10 flex items-start gap-3">
                                <AlertCircle size={16} className="text-accent shrink-0" />
                                <p>Terminating a session will instantly force-logout the user.</p>
                            </div>
                        </CardContent>
                    </Card>
                </aside>
            </div>
        </div>
    );
}
