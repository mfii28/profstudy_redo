'use client';

import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  ShieldCheck, 
  Settings2, 
  Lock, 
  Globe, 
  Upload, 
  Image as LucideImage,
  DollarSign,
  Briefcase,
  Activity,
  TriangleAlert,
  Zap,
  CheckCircle2,
  Bell,
  Download,
  FileUp,
  HardDrive,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getGlobalSettings, setGlobalSettings, defaultGlobalSettings } from "@/lib/platform-settings-data";
import { type GlobalSettings } from "@/lib/db";
import Image from "next/image";
import Link from "next/link";
import { useUser } from "@/firebase";
import { logAdminAction } from "@/lib/audit-data";
import { getPresignedUploadUrl } from "@/app/actions/storage";
import { uploadToR2 } from "@/lib/upload-client";
import { resolveMediaUrl } from '@/lib/media-url';

export default function AdminGeneralSettingsPage() {
  const { user: adminUser } = useUser();
  const [settings, setSettings] = useState<GlobalSettings>(defaultGlobalSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      const data = await getGlobalSettings();
      setSettings(data);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const handleSave = async () => {
    if (!adminUser) return;

    setIsSaving(true);
    try {
        await setGlobalSettings(settings);
        
        await logAdminAction({
            actorId: adminUser.uid,
            actorName: adminUser.displayName || adminUser.email || 'Administrator',
            action: 'SETTINGS_UPDATE',
            targetId: 'master-config',
            targetType: 'setting',
            severity: 'warn',
            details: `Modified global platform configuration.`
        });

        toast({ title: 'Platform Synchronized' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Update Failed' });
    } finally {
        setIsSaving(false);
    }
  };

  const updateField = (key: keyof GlobalSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !adminUser) return;

    setIsUploading(true);
    try {
      const { url, key, error, contentType } = await getPresignedUploadUrl(
        adminUser.uid, 
        'branding', 
        file.name, 
        file.type
      );

      if (error || !key || !url) throw new Error(error || 'Failed to sign');

      const idToken = await adminUser.getIdToken(true);
      await uploadToR2(url, file, contentType || file.type || 'application/octet-stream', {
        key,
        idToken,
      });

      updateField('logoUrl', key);
      toast({ title: "Logo Secured", description: "Click Apply to save branding changes permanently." });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload Failed', description: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleExportSettings = () => {
    const data = JSON.stringify(settings, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pts-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Settings exported' });
  };

  const handleImportSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string);
        setSettings(prev => ({ ...prev, ...imported }));
        toast({ title: 'Settings imported', description: 'Review and click Apply to save.' });
      } catch {
        toast({ variant: 'destructive', title: 'Invalid JSON file' });
      }
    };
    reader.readAsText(file);
    if (importInputRef.current) importInputRef.current.value = '';
  };

  if (isLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline">Platform Governance</h1>
          <p className="text-muted-foreground text-sm">Secured configuration via managed storage and Firestore.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportSettings} className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()} className="gap-2">
            <FileUp className="h-4 w-4" /> Import
          </Button>
          <input ref={importInputRef} type="file" accept=".json" className="sr-only" onChange={handleImportSettings} />
          <Button onClick={handleSave} disabled={isSaving} className="gap-2 shadow-lg">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Apply Changes
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Communication Controls</CardTitle>
          <CardDescription>Manage SMS, WhatsApp, templates, and delivery logs from one place.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/settings/communications">Open Communication Settings</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/admin/settings/communications/logs">Open Delivery Logs</Link>
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="identity" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-8 flex-wrap h-auto gap-1">
          <TabsTrigger value="identity" className="gap-2"><Settings2 size={14}/> Identity</TabsTrigger>
          <TabsTrigger value="finance" className="gap-2"><DollarSign size={14}/> Finance</TabsTrigger>
          <TabsTrigger value="courses" className="gap-2"><Briefcase size={14}/> Courses</TabsTrigger>
          <TabsTrigger value="safety" className="gap-2"><Lock size={14}/> Safety</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell size={14}/> Notifications</TabsTrigger>
          <TabsTrigger value="files" className="gap-2"><HardDrive size={14}/> Files</TabsTrigger>
          <TabsTrigger value="locale" className="gap-2"><Globe size={14}/> Locale</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Platform Name</Label>
                    <Input value={settings.siteName} onChange={e => updateField('siteName', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label>Public Description</Label>
                    <Textarea value={settings.siteDescription} onChange={e => updateField('siteDescription', e.target.value)} rows={3} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Logo Vault</CardTitle></CardHeader>
              <CardContent className="flex flex-col items-center gap-6">
                <div className="relative w-32 h-32 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted/20">
                  {isUploading ? (
                    <Loader2 className="animate-spin text-primary" />
                  ) : settings.logoUrl ? (
                    <Image 
                        src={resolveMediaUrl(settings.logoUrl)} 
                        alt="Logo" 
                        fill 
                        className="object-cover" 
                        unoptimized 
                    />
                  ) : (
                    <LucideImage className="opacity-20" />
                  )}
                </div>
                <Button variant="outline" className="w-full" onClick={() => logoInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" /> Change Asset
                </Button>
                <input type="file" ref={logoInputRef} className="sr-only" accept="image/*" onChange={handleLogoUpload} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Social Media Links</CardTitle><CardDescription>Enter your social profile URLs. Leave blank to hide the link in the footer.</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Facebook</Label>
                <Input placeholder="https://facebook.com/yourpage" value={settings.socialFacebook ?? ''} onChange={e => updateField('socialFacebook', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input placeholder="https://instagram.com/yourhandle" value={settings.socialInstagram ?? ''} onChange={e => updateField('socialInstagram', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Twitter / X</Label>
                <Input placeholder="https://twitter.com/yourhandle" value={settings.socialTwitter ?? ''} onChange={e => updateField('socialTwitter', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>LinkedIn</Label>
                <Input placeholder="https://linkedin.com/company/yourcompany" value={settings.socialLinkedin ?? ''} onChange={e => updateField('socialLinkedin', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>YouTube</Label>
                <Input placeholder="https://youtube.com/@yourchannel" value={settings.socialYoutube ?? ''} onChange={e => updateField('socialYoutube', e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Financial Policies</CardTitle>
              <CardDescription>Configure currency, taxes, and payout thresholds.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Currency</Label>
                  <Input value={settings.defaultCurrency} onChange={e => updateField('defaultCurrency', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Platform Commission (%)</Label>
                  <Input value={settings.platformCommission} onChange={e => updateField('platformCommission', e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Course Review & Publication</CardTitle>
                    <CardDescription>Control how courses are reviewed and published on the platform.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-xl bg-muted/10">
                        <div className="space-y-0.5">
                            <Label>Auto-Approve Course Publications</Label>
                            <p className="text-xs text-muted-foreground">Automatically publish new courses submitted by tutors without manual review from admin. Admins and subadmins always bypass review.</p>
                        </div>
                        <Switch 
                            checked={settings.allowReviewAutoApproval} 
                            onCheckedChange={v => updateField('allowReviewAutoApproval', v)} 
                        />
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-xl bg-muted/10">
                        <div className="space-y-0.5">
                            <Label>Auto-Categorize Courses</Label>
                            <p className="text-xs text-muted-foreground">Use AI to automatically assign subjects and categories to new courses.</p>
                        </div>
                        <Switch 
                            checked={settings.enableAutoCategorization} 
                            onCheckedChange={v => updateField('enableAutoCategorization', v)} 
                        />
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="safety" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Platform Safety</CardTitle>
                    <CardDescription>Enforce security protocols and automated moderation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-xl bg-muted/10">
                        <div className="space-y-0.5">
                            <Label>Maintenance Mode</Label>
                            <p className="text-xs text-muted-foreground">Restrict all student access while performing updates.</p>
                        </div>
                        <Switch 
                            checked={settings.maintenanceMode} 
                            onCheckedChange={v => updateField('maintenanceMode', v)} 
                        />
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-xl bg-muted/10">
                        <div className="space-y-0.5">
                            <Label>Auto-Moderate Content</Label>
                            <p className="text-xs text-muted-foreground">Use AI to scan course descriptions and forum posts.</p>
                        </div>
                        <Switch 
                            checked={settings.enableAutoCourseReview} 
                            onCheckedChange={v => updateField('enableAutoCourseReview', v)} 
                        />
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-xl bg-muted/10">
                        <div className="space-y-0.5">
                            <Label>Allow Public Registration</Label>
                            <p className="text-xs text-muted-foreground">Let new users sign up publicly. Disable to make the platform invite-only.</p>
                        </div>
                        <Switch 
                            checked={settings.allowPublicRegistration ?? true} 
                            onCheckedChange={v => updateField('allowPublicRegistration', v)} 
                        />
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Admin Alert Preferences</CardTitle>
                    <CardDescription>Choose which events trigger email notifications to admin accounts.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {([
                        { key: 'notifNewUserAlert', label: 'New User Registration', desc: 'Notify when a new student or tutor registers.' },
                        { key: 'notifNewCourseAlert', label: 'New Course Submitted', desc: 'Notify when a tutor submits a course for review.' },
                        { key: 'notifNewOrderAlert', label: 'New Order / Enrollment', desc: 'Notify on every new purchase or enrollment.' },
                        { key: 'notifPayoutRequest', label: 'Tutor Payout Request', desc: 'Notify when a tutor submits a withdrawal request.' },
                        { key: 'notifSecurityAlert', label: 'Security Alerts', desc: 'Notify on suspicious login attempts or flagged content.' },
                    ] as { key: keyof GlobalSettings; label: string; desc: string }[]).map(item => (
                        <div key={item.key} className="flex items-center justify-between p-4 border rounded-xl bg-muted/10">
                            <div className="space-y-0.5">
                                <Label>{item.label}</Label>
                                <p className="text-xs text-muted-foreground">{item.desc}</p>
                            </div>
                            <Switch 
                                checked={!!(settings[item.key])} 
                                onCheckedChange={v => updateField(item.key, v)} 
                            />
                        </div>
                    ))}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Upload Limits & Allowed Types</CardTitle>
                    <CardDescription>Control file sizes and accepted MIME types for uploads across the platform.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Max Upload Size (MB)</Label>
                        <Input 
                            type="number" 
                            min={1} 
                            max={2000} 
                            value={settings.maxUploadMb ?? '100'} 
                            onChange={e => updateField('maxUploadMb', e.target.value)} 
                        />
                        <p className="text-xs text-muted-foreground">Applies to video, document, and image uploads by tutors.</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Allowed Image Types</Label>
                        <Input 
                            placeholder="image/jpeg,image/png,image/webp" 
                            value={settings.allowedImageTypes ?? 'image/jpeg,image/png,image/webp'} 
                            onChange={e => updateField('allowedImageTypes', e.target.value)} 
                        />
                        <p className="text-xs text-muted-foreground">Comma-separated MIME types.</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Allowed Video Types</Label>
                        <Input 
                            placeholder="video/mp4,video/webm" 
                            value={settings.allowedVideoTypes ?? 'video/mp4,video/webm'} 
                            onChange={e => updateField('allowedVideoTypes', e.target.value)} 
                        />
                        <p className="text-xs text-muted-foreground">Comma-separated MIME types.</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Allowed Document Types</Label>
                        <Input 
                            placeholder="application/pdf,application/msword" 
                            value={settings.allowedDocTypes ?? 'application/pdf,application/msword'} 
                            onChange={e => updateField('allowedDocTypes', e.target.value)} 
                        />
                        <p className="text-xs text-muted-foreground">Comma-separated MIME types.</p>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="locale" className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Regional Settings</CardTitle>
                    <CardDescription>Configure timezone and date/time formatting for the platform.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Timezone</Label>
                        <Input 
                            placeholder="Africa/Accra" 
                            value={settings.timezone ?? 'Africa/Accra'} 
                            onChange={e => updateField('timezone', e.target.value)} 
                        />
                        <p className="text-xs text-muted-foreground">IANA timezone identifier (e.g. Africa/Accra, America/New_York).</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Date Format</Label>
                        <Input 
                            placeholder="DD/MM/YYYY" 
                            value={settings.dateFormat ?? 'DD/MM/YYYY'} 
                            onChange={e => updateField('dateFormat', e.target.value)} 
                        />
                        <p className="text-xs text-muted-foreground">Tokens: DD (day), MM (month), YYYY (year). Used in dashboards and reports.</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Default Language</Label>
                        <Input 
                            placeholder="en" 
                            value={settings.defaultLanguage ?? 'en'} 
                            onChange={e => updateField('defaultLanguage', e.target.value)} 
                        />
                        <p className="text-xs text-muted-foreground">ISO 639-1 language code (e.g. en, fr, ar).</p>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
