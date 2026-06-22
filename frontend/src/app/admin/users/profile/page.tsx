'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { getUserProfileAction, updateUserProfileAction, changeUserPasswordAction } from '@/app/actions/user';
import { getPresignedUploadUrl } from '@/app/actions/storage';
import { uploadToR2 } from '@/lib/upload-client';
import { resolveAvatarUrl } from '@/lib/media-url';
import { UserCircle, Camera, Loader2, ShieldCheck, Eye, EyeOff, KeyRound, Save } from 'lucide-react';

export default function AdminProfilePage() {
  const { user: adminUser } = useUser();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const initials = (displayName || adminUser?.email || 'A').charAt(0).toUpperCase();

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await getUserProfileAction();
        if (res.success && res.user) {
          setDisplayName(res.user.name || '');
          setBio(res.user.bio || '');
          if (res.user.avatar) {
            setAvatarPreview(resolveAvatarUrl(res.user.avatar));
          }
        }
      } catch (err: any) {
        console.error('Failed to load profile:', err);
      }
    }
    loadProfile();
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !adminUser) return;
    setIsUploading(true);
    try {
      const { url, key, error, contentType } = await getPresignedUploadUrl(adminUser.uid, 'avatar', file.name, file.type);
      if (error || !key || !url) throw new Error(error || 'Upload sign failed');
      const idToken = await adminUser.getIdToken(true);
      await uploadToR2(url, file, contentType || file.type, { key, idToken });
      
      const updateRes = await updateUserProfileAction({ avatar: key });
      if (updateRes.error) throw new Error(updateRes.error);

      setAvatarPreview(URL.createObjectURL(file));
      toast({ title: 'Avatar updated' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload failed', description: err.message });
    } finally {
      setIsUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async () => {
    if (!adminUser) return;
    if (!displayName.trim()) { toast({ variant: 'destructive', title: 'Display name required' }); return; }
    setIsSavingProfile(true);
    try {
      const res = await updateUserProfileAction({ name: displayName, bio });
      if (res.error) throw new Error(res.error);
      toast({ title: 'Profile updated' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Update failed', description: err.message });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!adminUser || !adminUser.email) return;
    if (!currentPassword) { toast({ variant: 'destructive', title: 'Enter your current password' }); return; }
    if (newPassword.length < 8) { toast({ variant: 'destructive', title: 'New password must be at least 8 characters' }); return; }
    if (newPassword !== confirmPassword) { toast({ variant: 'destructive', title: 'Passwords do not match' }); return; }

    setIsChangingPassword(true);
    try {
      const res = await changeUserPasswordAction({ currentPassword, newPassword });
      if (res.error) throw new Error(res.error);
      toast({ title: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Password change failed', description: err.message });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-xl"><UserCircle className="h-7 w-7 text-primary" /></div>
        <div>
          <h1 className="text-3xl font-bold font-headline">My Profile</h1>
          <p className="text-muted-foreground text-sm">Manage your administrator account details.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
          <CardDescription>Update your name, bio, and avatar shown across the platform.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="h-20 w-20 border-2 border-muted">
                {avatarPreview ? (
                  <AvatarImage src={avatarPreview} />
                ) : (
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">{initials}</AvatarFallback>
                )}
              </Avatar>
              <button
                onClick={() => avatarInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {isUploading ? <Loader2 size={18} className="text-white animate-spin" /> : <Camera size={18} className="text-white" />}
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" className="sr-only" onChange={handleAvatarUpload} />
            </div>
            <div>
              <p className="font-semibold">{displayName || 'Administrator'}</p>
              <p className="text-sm text-muted-foreground">{adminUser?.email}</p>
              <Button variant="outline" size="sm" className="mt-2 text-xs gap-1" onClick={() => avatarInputRef.current?.click()}>
                <Camera size={12} /> Change Photo
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name…" />
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Brief description shown to users…" rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={adminUser?.email || ''} disabled className="bg-muted/20" />
              <p className="text-xs text-muted-foreground">Email changes are managed by the administrator.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="gap-2">
              {isSavingProfile ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound size={16} /> Change Password</CardTitle>
          <CardDescription>Update your login password. You&apos;ll need to confirm your current password first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current Password</Label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowCurrent(v => !v)}>
                {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="pr-10"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNew(v => !v)}>
                {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="pr-10"
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowConfirm(v => !v)}>
                {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleChangePassword} disabled={isChangingPassword} variant="outline" className="gap-2">
              {isChangingPassword ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
