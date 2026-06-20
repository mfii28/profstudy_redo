'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, Smartphone, Laptop, Loader2, Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { validatePassword } from "@/lib/password-validation";
import { useUser, useAuth, useFirestore } from "@/firebase";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, signOut } from "firebase/auth";
import { revokeAllSessions } from '@/app/actions/session';
import { collection, query, doc, setDoc, deleteDoc, writeBatch, onSnapshot, serverTimestamp, orderBy } from "firebase/firestore";

interface UserSession {
  id: string;
  deviceName: string;
  browser: string;
  location: string;
  lastActive: any;
  isCurrent: boolean;
}

export default function SecuritySettingsPage() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // --- Session Tracking Logic ---
  useEffect(() => {
    if (!user || !firestore) return;

    let sessionId = sessionStorage.getItem('studymate_session_id');
    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('studymate_session_id', sessionId);
    }
    setCurrentSessionId(sessionId);

    const ua = window.navigator.userAgent;
    let browser = "Unknown Browser";
    if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Safari")) browser = "Safari";
    else if (ua.includes("Edge")) browser = "Edge";

    let os = "Unknown OS";
    if (ua.includes("Win")) os = "Windows PC";
    else if (ua.includes("Mac")) os = "macOS";
    else if (ua.includes("Linux")) os = "Linux";
    else if (ua.includes("Android")) os = "Android Device";
    else if (ua.includes("iPhone")) os = "iPhone";

    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown timezone';

    const sessionRef = doc(firestore, 'users', user.uid, 'activeSessions', sessionId);
    setDoc(sessionRef, {
      id: sessionId,
      deviceName: os,
      browser: browser,
      location: detectedTimezone,
      lastActive: serverTimestamp(),
    }, { merge: true });

    const sessionsQuery = query(
      collection(firestore, 'users', user.uid, 'activeSessions'),
      orderBy('lastActive', 'desc')
    );

    const unsubscribe = onSnapshot(sessionsQuery, (snapshot) => {
      const activeSessions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          deviceName: data.deviceName,
          browser: data.browser,
          location: data.location,
          lastActive: data.lastActive?.toDate() || new Date(),
          isCurrent: doc.id === sessionId
        } as UserSession;
      });
      setSessions(activeSessions);
      setIsSessionsLoading(false);
    });

    return () => unsubscribe();
  }, [user, firestore]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !user.email) return;

    if (newPassword !== confirmPassword) {
        toast({
            variant: "destructive",
            title: "Passwords do not match",
            description: "Please make sure your new password and confirmation match."
        });
        return;
    }

    const passCheck = validatePassword(newPassword);
    if (!passCheck.isValid) {
        toast({
            variant: "destructive",
            title: "Weak Password",
            description: passCheck.error
        });
        return;
    }

    setIsUpdating(true);

    try {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);

        toast({
            title: "Password Updated",
            description: "Your account security has been strengthened successfully."
        });

        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    } catch (error: any) {
        console.error("Password update error:", error);
        let message = "An error occurred while updating your password.";
        if (error.code === 'auth/wrong-password') {
            message = "The current password you entered is incorrect.";
        }
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: message
        });
    } finally {
        setIsUpdating(false);
    }
  };

  const handleLogoutSession = async (sessionId: string) => {
    if (!user || !firestore) return;
    try {
      await deleteDoc(doc(firestore, 'users', user.uid, 'activeSessions', sessionId));
      toast({ title: "Session Terminated", description: "The device has been logged out remotely." });
    } catch (error) {
      toast({ variant: "destructive", title: "Action Failed", description: "Could not terminate session." });
    }
  };

  const handleLogoutOtherDevices = async () => {
    if (!user || !firestore || !currentSessionId || !auth) return;

    const otherSessions = sessions.filter(s => s.id !== currentSessionId);
    if (otherSessions.length === 0) {
      toast({ title: "No other sessions", description: "Your account is not logged in on any other devices." });
      return;
    }

    try {
      // SECURITY: Revoke all Firebase refresh tokens server-side.
      // This invalidates every active session including the current one.
      const idToken = await user.getIdToken(true);
      const result = await revokeAllSessions(idToken);
      if ('error' in result) {
        toast({ variant: "destructive", title: "Revocation Failed", description: result.error });
        return;
      }

      // Remove Firestore session docs so the UI reflects the change immediately
      const batch = writeBatch(firestore);
      otherSessions.forEach(s => {
        const ref = doc(firestore, 'users', user.uid, 'activeSessions', s.id);
        batch.delete(ref);
      });
      await batch.commit();

      toast({
        title: "All Sessions Revoked",
        description: "All devices have been signed out. You will be redirected to sign in again."
      });

      // Sign out locally — revokeRefreshTokens invalidates the current session too
      await signOut(auth);
    } catch (error) {
      toast({ variant: "destructive", title: "Action Failed", description: "Could not revoke sessions." });
    }
  };

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle>Change Password</CardTitle>
                        <CardDescription>
                        Update your secret phrase to keep your account safe.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <form id="password-form" onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
                    <div className="space-y-2">
                        <Label htmlFor="current-password">Current Password</Label>
                        <div className="relative">
                            <Input 
                                id="current-password" 
                                type={showCurrentPassword ? "text" : "password"} 
                                required 
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                disabled={isUpdating}
                                className="pr-10"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            >
                                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <div className="relative">
                            <Input 
                                id="new-password" 
                                type={showNewPassword ? "text" : "password"} 
                                required 
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                disabled={isUpdating}
                                className="pr-10"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                            >
                                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm New Password</Label>
                        <div className="relative">
                            <Input 
                                id="confirm-password" 
                                type={showConfirmPassword ? "text" : "password"} 
                                required 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                disabled={isUpdating}
                                className="pr-10"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </form>
            </CardContent>
            <CardFooter>
                <Button type="submit" form="password-form" disabled={isUpdating}>
                    {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Update Password
                </Button>
            </CardFooter>
        </Card>

        <Card className="border-destructive/20">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-destructive/10 rounded-lg">
                        <Smartphone className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                        <CardTitle>Active Sessions</CardTitle>
                        <CardDescription>
                        Logged in devices currently using your Profs Training Solutions account.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {isSessionsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
                ) : sessions.length > 0 ? (
                  sessions.map(session => (
                    <div key={session.id} className={cn("flex items-center justify-between p-4 rounded-lg border", session.isCurrent ? "bg-primary/5 border-primary/20" : "bg-muted/30")}>
                        <div className="flex items-center gap-4">
                            {session.deviceName.includes("PC") || session.deviceName.includes("macOS") ? (
                              <Laptop className="h-8 w-8 text-muted-foreground" />
                            ) : (
                              <Smartphone className="h-8 w-8 text-muted-foreground" />
                            )}
                            <div>
                                <p className="font-bold text-sm">{session.deviceName} • {session.location}</p>
                                <p className="text-xs text-muted-foreground">
                                  {session.browser} Browser • {session.isCurrent ? 'Active now' : `Last active ${session.lastActive.toLocaleDateString()}`}
                                </p>
                            </div>
                        </div>
                        {session.isCurrent ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Current Device</Badge>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive hover:bg-destructive/10" 
                            onClick={() => handleLogoutSession(session.id)}
                            title="Removes from display. Use 'Log Out All Other Devices' to fully revoke access."
                          >
                            Log Out
                          </Button>
                        )}
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">No active sessions found.</p>
                )}
            </CardContent>
            <CardFooter className="bg-destructive/5 flex flex-col sm:flex-row justify-between gap-4 p-4 border-t border-destructive/10">
                <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                    <ShieldAlert className="h-4 w-4" />
                    Suspicious activity?
                </div>
                <Button variant="destructive" size="sm" onClick={handleLogoutOtherDevices} disabled={sessions.length <= 1}>
                  Log Out All Other Devices
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}
