'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Loader2, Shield, Lock, Bell, LogOut } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useUser, useAuth } from '@/firebase';
import { apiFetch } from '@/lib/api-client';
import type { User as AppUser } from '@/lib/db';

interface SecuritySettings {
  twoFactorEnabled?: boolean;
  loginNotifications?: boolean;
  sessionTimeout?: number; // in minutes
  lastPasswordChange?: string;
  allowMultipleSessions?: boolean;
}

export default function TutorSecuritySettingsPage() {
  const { user: currentUser } = useUser();
  const auth = useAuth();
  const { toast } = useToast();
  const [isRevoking, setIsRevoking] = useState(false);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    loginNotifications: true,
    sessionTimeout: 60,
    allowMultipleSessions: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSecuritySettings = async () => {
      if (!currentUser) return;
      try {
        const res = await apiFetch('/users/profile');
        if (res.ok) {
          const data = await res.json();
          const userData = data.user as any;
          if (userData.securitySettings) {
            setSecuritySettings(userData.securitySettings);
          }
        }
      } catch (error) {
        console.error('Failed to fetch security settings:', error);
        toast({ variant: 'destructive', title: 'Failed to load security settings' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSecuritySettings();
  }, [currentUser, toast]);

  const handleRevokeAllSessions = async () => {
    if (!currentUser || !auth) return;
    setIsRevoking(true);
    try {
      const { error } = await auth.signOut();
      if (error) throw error;
      toast({ title: 'All Sessions Revoked', description: 'You will be redirected to sign in again.' });
    } catch {
      toast({ variant: 'destructive', title: 'An error occurred. Please try again.' });
    } finally {
      setIsRevoking(false);
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;

    setIsSaving(true);
    try {
      await apiFetch('/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ securitySettings }),
      });
      toast({ title: 'Security settings saved', description: 'Your security preferences have been updated.' });
    } catch (error) {
      console.error('Failed to save security settings:', error);
      toast({ variant: 'destructive', title: 'Failed to save security settings' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security & Authentication
          </CardTitle>
          <CardDescription>
            Control your account security and authentication settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* TODO: 2FA and login-notification toggles are saved but not enforced at sign-in yet. */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="text-base font-medium">Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account.
                </p>
              </div>
            </div>
            <Switch
              checked={securitySettings.twoFactorEnabled || false}
              onCheckedChange={(checked) =>
                setSecuritySettings({ ...securitySettings, twoFactorEnabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label className="text-base font-medium">Login Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive alerts when someone logs into your account.
                </p>
              </div>
            </div>
            <Switch
              checked={securitySettings.loginNotifications ?? true}
              onCheckedChange={(checked) =>
                setSecuritySettings({ ...securitySettings, loginNotifications: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <div>
                <Label className="text-base font-medium">Allow Multiple Sessions</Label>
                <p className="text-sm text-muted-foreground">
                  Allow logging in from multiple devices simultaneously.
                </p>
              </div>
            </div>
            <Switch
              checked={securitySettings.allowMultipleSessions ?? true}
              onCheckedChange={(checked) =>
                setSecuritySettings({ ...securitySettings, allowMultipleSessions: checked })
              }
            />
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
            <Input
              id="sessionTimeout"
              type="number"
              min="15"
              max="480"
              value={securitySettings.sessionTimeout || 60}
              onChange={(e) =>
                setSecuritySettings({
                  ...securitySettings,
                  sessionTimeout: parseInt(e.target.value, 10),
                })
              }
            />
            <p className="text-sm text-muted-foreground">
              Automatically logout after this period of inactivity.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Saving...' : 'Save Security Settings'}
          </Button>
        </CardFooter>
      </Card>
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5 text-destructive" />
            Device Sessions
          </CardTitle>
          <CardDescription>
            Revoke access for all currently signed-in devices, including this one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Use this if you suspect unauthorized access. You will be signed out everywhere and must re-authenticate.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="destructive" onClick={handleRevokeAllSessions} disabled={isRevoking}>
            {isRevoking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign Out of All Devices
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
