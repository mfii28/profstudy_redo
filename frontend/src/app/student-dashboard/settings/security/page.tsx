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
import { useUser, useAuth } from "@/firebase";
import { apiFetch } from '@/lib/api-client';

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
  const { toast } = useToast();
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [sessions, _setSessions] = useState<UserSession[]>([]);
  const [isSessionsLoading, setIsSessionsLoading] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

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
      const { error } = await auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({
          title: "Password Updated",
          description: "Your account security has been strengthened successfully."
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
        console.error("Password update error:", error);
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: error?.message || "An error occurred while updating your password."
        });
    } finally {
        setIsUpdating(false);
    }
  };

  const handleLogoutSession = async (_sessionId: string) => {
    try {
      await apiFetch('/session/revoke-all', { method: 'POST' });
      toast({ title: "Session Terminated", description: "The device has been logged out remotely." });
    } catch (error) {
      toast({ variant: "destructive", title: "Action Failed", description: "Could not terminate session." });
    }
  };

  const handleLogoutOtherDevices = async () => {
    if (!user || !auth) return;

    try {
      const { error } = await auth.signOut();
      if (error) throw error;

      toast({
        title: "All Sessions Revoked",
        description: "All devices have been signed out. You will be redirected to sign in again."
      });
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
