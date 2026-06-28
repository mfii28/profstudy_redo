'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { Moon, Sun, Loader2, Palette } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState, useEffect } from "react";
import { useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { updateUserPreferences } from "@/lib/user-data";
import { type UserPreferences, type User as UserProfile } from "@/lib/db";
import { apiFetch } from '@/lib/api-client';
import { Skeleton } from "@/components/ui/skeleton";

export default function PreferencesSettingsPage() {
    const { theme, setTheme } = useTheme();
    const { user, isLoading: isUserLoading } = useUser();
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    const [prefs, setPrefs] = useState<UserPreferences>({
        theme: 'system',
        notifCourseAnnouncements: true,
        notifStudyReminders: false,
        notifPromotions: true
    });

    useEffect(() => {
        const fetchUserProfile = async () => {
          if (user) {
            setIsLoading(true);
            try {
              const res = await apiFetch('/users/profile');
              if (res.ok) {
                const data = await res.json();
                const userProfile = data.user as UserProfile;
                if (userProfile.preferences) {
                  setPrefs(userProfile.preferences);
                }
              }
            } catch {
              // ignore
            }
            setIsLoading(false);
          }
        };
    
        if (!isUserLoading) {
          fetchUserProfile();
        }
      }, [user, isUserLoading]);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            // Sync next-themes
            setTheme(prefs.theme);
            await updateUserPreferences(user.uid, prefs);
            toast({ title: "Preferences Updated" });
        } catch (error) {
            toast({ variant: 'destructive', title: "Update Failed" });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || isUserLoading) {
        return (
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-64" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-56" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </CardContent>
                     <CardFooter>
                        <Skeleton className="h-10 w-32" />
                    </CardFooter>
                </Card>
            </div>
        )
    }

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Palette className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle>Display Theme</CardTitle>
                        <CardDescription>Choose your interface style.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <RadioGroup value={prefs.theme} onValueChange={(v: any) => setPrefs({...prefs, theme: v})}>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="light" id="light" />
                        <Label htmlFor="light" className="flex items-center gap-2 cursor-pointer">
                            <Sun className="h-4 w-4" /> Light
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="dark" id="dark" />
                        <Label htmlFor="dark" className="flex items-center gap-2 cursor-pointer">
                            <Moon className="h-4 w-4" /> Dark
                        </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="system" id="system" />
                        <Label htmlFor="system" className="cursor-pointer">System Default</Label>
                    </div>
                </RadioGroup>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Manage your automated platform alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                        <Label>New Course Announcements</Label>
                        <p className="text-xs text-muted-foreground">Receive updates when new tracks are launched.</p>
                    </div>
                    <Switch 
                        checked={prefs.notifCourseAnnouncements} 
                        onCheckedChange={v => setPrefs({...prefs, notifCourseAnnouncements: v})} 
                    />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                        <Label>Study Reminders</Label>
                         <p className="text-xs text-muted-foreground">Get daily alerts to maintain your streak.</p>
                    </div>
                    <Switch 
                        checked={prefs.notifStudyReminders} 
                        onCheckedChange={v => setPrefs({...prefs, notifStudyReminders: v})} 
                    />
                </div>
                 <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                        <Label>Exclusive Promotions</Label>
                         <p className="text-xs text-muted-foreground">Get notified about shop discounts.</p>
                    </div>
                    <Switch 
                        checked={prefs.notifPromotions} 
                        onCheckedChange={v => setPrefs({...prefs, notifPromotions: v})} 
                    />
                </div>
            </CardContent>
             <CardFooter>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Apply Preferences
                </Button>
            </CardFooter>
        </Card>
    </div>
  );
}
