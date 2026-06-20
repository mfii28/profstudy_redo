'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
    ShieldCheck, 
    Loader2, 
    FileText, 
    CheckCircle2, 
    XCircle, 
    ExternalLink, 
    Search,
    Clock,
    AlertCircle
} from "lucide-react";
import { getUsers, updateUser } from '@/lib/user-data';
import { type User as AppUser } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmptyState } from '@/components/dashboard/empty-state';
import { resolveAvatarUrl } from '@/lib/media-url';
import { Input } from '@/components/ui/input';
import { useUser } from '@/firebase';
import { logAdminAction } from '@/lib/audit-data';

export default function AdminVerificationQueuePage() {
  const { user: adminUser } = useUser();
  const [applications, setApplications] = useState<AppUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const fetchApplications = async () => {
    setIsLoading(true);
    try {
      const { users: allUsers } = await getUsers();
      const pending = allUsers.filter(u => 
        u.role === 'tutor' && 
        (u.tutorDetails?.verificationStatus === 'pending' || (u.tutorDetails?.idCardUrl && u.tutorDetails?.verificationStatus !== 'verified'))
      );
      setApplications(pending);
    } catch (error) {
      console.error("[VerificationQueue] Sync Failure:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleAction = async (tutor: AppUser, status: 'verified' | 'unverified') => {
    if (!adminUser) {
        toast({ variant: 'destructive', title: "Unauthorized", description: "Admin context missing." });
        return;
    }

    try {
      const updatedUser: AppUser = {
        ...tutor,
        tutorDetails: {
          ...tutor.tutorDetails!,
          verificationStatus: status
        }
      };

      await updateUser(updatedUser);
      
      await logAdminAction({
        actorId: adminUser.uid,
        actorName: adminUser.displayName || adminUser.email || 'Administrator',
        action: 'TUTOR_VERIFICATION',
        targetId: tutor.id,
        targetType: 'user',
        severity: status === 'verified' ? 'info' : 'warn',
        details: `${status === 'verified' ? 'APPROVED' : 'REJECTED'} credentials for ${tutor.name} (${tutor.email}).`
      });

      setApplications(prev => prev.filter(a => a.id !== tutor.id));
      toast({ 
        title: status === 'verified' ? "Tutor Approved" : "Credentials Rejected",
        description: `Profile for ${tutor.name} has been updated and logged.`
      });
    } catch (error) {
      toast({ variant: 'destructive', title: "Decision Blocked", description: "Could not persist changes to Firestore." });
    }
  };

  const filtered = applications.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1 font-headline tracking-tight">KYC Decision Center</h1>
          <p className="text-muted-foreground text-sm">
            Review professional credentials and authenticate instructor identities.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search applicants..." 
                className="pl-9 h-10 shadow-sm" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/30 border-b p-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Pending Verification Queue
            </CardTitle>
            <Badge variant="secondary" className="font-black text-[10px] h-5">{applications.length} Records</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col justify-center items-center py-24 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Scanning Applications...</p>
            </div>
          ) : filtered.length > 0 ? (
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="pl-6">Instructor</TableHead>
                  <TableHead>Current Status</TableHead>
                  <TableHead>Identity Assets</TableHead>
                  <TableHead>Submission Log</TableHead>
                  <TableHead className="text-right pr-6">Administrative Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tutor) => (
                  <TableRow key={tutor.id} className="hover:bg-muted/5 transition-colors">
                    <TableCell className="pl-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border shadow-sm">
                          <AvatarImage src={resolveAvatarUrl(tutor.avatar)} />
                          <AvatarFallback>{tutor.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold text-sm">{tutor.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">UID: {tutor.id.substring(0, 12)}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={tutor.tutorDetails?.verificationStatus === 'pending' ? 'outline' : 'secondary'} className="capitalize text-[10px] px-2 font-black border-dashed">
                        {tutor.tutorDetails?.verificationStatus || 'unverified'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {tutor.tutorDetails?.idCardUrl && (
                          <Button variant="link" className="h-auto p-0 text-[10px] font-bold justify-start group" asChild title={tutor.tutorDetails.idCardUrl}>
                            <a href={tutor.tutorDetails.idCardUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={10} className="mr-1 opacity-0 group-hover:opacity-100 transition-opacity"/> View Ghana Card</a>
                          </Button>
                        )}
                        {tutor.tutorDetails?.certificationUrl && (
                          <Button variant="link" className="h-auto p-0 text-[10px] font-bold justify-start text-accent group" asChild title={tutor.tutorDetails.certificationUrl}>
                            <a href={tutor.tutorDetails.certificationUrl} target="_blank" rel="noopener noreferrer"><FileText size={10} className="mr-1 opacity-0 group-hover:opacity-100 transition-opacity"/> Prof. Certification</a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-[10px] font-medium text-muted-foreground">
                        {tutor.lastActive ? (
                            <div className="flex items-center gap-1.5">
                                <Clock size={10} />
                                {new Date(tutor.lastActive).toLocaleDateString()}
                            </div>
                        ) : 'Record N/A'}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 text-destructive hover:bg-destructive/10 font-bold border-destructive/20"
                            onClick={() => handleAction(tutor, 'unverified')}
                        >
                            <XCircle size={14} className="mr-1" /> Reject
                        </Button>
                        <Button 
                            size="sm" 
                            className="h-8 bg-success hover:bg-success/90 font-black"
                            onClick={() => handleAction(tutor, 'verified')}
                        >
                            <CheckCircle2 size={14} className="mr-1" /> Verify Account
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-32">
              <EmptyState 
                icon={<ShieldCheck className="h-16 w-16 text-muted-foreground/20" />}
                title="Review Queue Clear"
                description={searchTerm ? `No applicants match "${searchTerm}".` : "There are no pending tutor applications requiring administrative decision at this time."}
              />
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/10 border-t p-4 text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-2">
            <AlertCircle size={12} /> Decision non-repudiation is enforced. All actions are logged to the Security Audit Ledger.
        </CardFooter>
      </Card>
    </div>
  );
}
