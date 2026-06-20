'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Settings2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

interface TutorPreferences {
  language?: string;
  timezone?: string;
  notifyStudentMessages?: boolean;
  notifyReviews?: boolean;
  notifyCourseUpdates?: boolean;
  allowStudentScheduling?: boolean;
  responseTimeTarget?: string; // 'instant' | '1hour' | '6hours' | '24hours'
}

export default function TutorPreferencesSettingsPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<TutorPreferences>({
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    notifyStudentMessages: true,
    notifyReviews: true,
    notifyCourseUpdates: true,
    allowStudentScheduling: true,
    responseTimeTarget: '6hours',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchPreferences = async () => {
      if (!currentUser) return;
      if (!firestore) {
        setIsLoading(false);
        return;
      }
      try {
        const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as any;
          if (userData.tutorPreferences) {
            setPreferences({
              ...preferences,
              ...userData.tutorPreferences,
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch preferences:', error);
        toast({ variant: 'destructive', title: 'Failed to load preferences' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchPreferences();
  }, [currentUser, firestore, toast]);

  const handleSave = async () => {
    if (!currentUser || !firestore) return;

    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'users', currentUser.uid), {
        tutorPreferences: preferences,
      });
      toast({ title: 'Preferences saved', description: 'Your preferences have been updated.' });
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast({ variant: 'destructive', title: 'Failed to save preferences' });
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

  if (currentUser && !firestore) {
    return (
      <Alert>
        <AlertTitle>Setup still loading</AlertTitle>
        <AlertDescription>
          Preferences are not ready yet. Wait a moment, then try again.
        </AlertDescription>
        <Button className="mt-3" variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
          Teaching & Communication Preferences
        </CardTitle>
        <CardDescription>
          Customize your teaching style and notification settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="language">Preferred Language</Label>
            <Select
              value={preferences.language || 'en'}
              onValueChange={(value) => setPreferences({ ...preferences, language: value })}
            >
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
                <SelectItem value="de">German</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={preferences.timezone || 'UTC'}
              onValueChange={(value) => setPreferences({ ...preferences, timezone: value })}
            >
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Africa/Accra">Africa/Accra (GMT)</SelectItem>
                <SelectItem value="Africa/Lagos">Africa/Lagos (GMT+1)</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
                <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="responseTime">Expected Response Time</Label>
            <Select
              value={preferences.responseTimeTarget || '6hours'}
              onValueChange={(value) => setPreferences({ ...preferences, responseTimeTarget: value })}
            >
              <SelectTrigger id="responseTime">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">Instant</SelectItem>
                <SelectItem value="1hour">Within 1 hour</SelectItem>
                <SelectItem value="6hours">Within 6 hours</SelectItem>
                <SelectItem value="24hours">Within 24 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="mb-4 font-semibold">Notification Preferences</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="notify-messages">Student Messages</Label>
              <Switch
                id="notify-messages"
                checked={preferences.notifyStudentMessages ?? true}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, notifyStudentMessages: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="notify-reviews">Reviews & Ratings</Label>
              <Switch
                id="notify-reviews"
                checked={preferences.notifyReviews ?? true}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, notifyReviews: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="notify-updates">Course Updates</Label>
              <Switch
                id="notify-updates"
                checked={preferences.notifyCourseUpdates ?? true}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, notifyCourseUpdates: checked })
                }
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="mb-4 font-semibold">Teaching Availability</h3>
          <div className="flex items-center justify-between">
            <Label htmlFor="allow-scheduling">Allow Students to Schedule Sessions</Label>
            <Switch
              id="allow-scheduling"
              checked={preferences.allowStudentScheduling ?? true}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, allowStudentScheduling: checked })
              }
            />
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </CardFooter>
    </Card>
  );
}
