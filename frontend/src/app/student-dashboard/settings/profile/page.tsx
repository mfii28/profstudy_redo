'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useStudentProfile } from "@/hooks/use-student-profile";
import { Skeleton } from "@/components/ui/skeleton";
import { type User as AppUser } from '@/lib/db';
import { useToast } from '@/hooks/use-toast';
import { updateUser } from '@/lib/user-data';
import { Loader2, Upload, Camera, AlertCircle } from 'lucide-react';
import { getPresignedUploadUrl, getPresignedDownloadUrl } from '@/app/actions/storage';
import { uploadToR2 } from '@/lib/upload-client';
import { cn } from '@/lib/utils';

export default function ProfileSettingsPage() {
  const { user: currentUser, profile: studentProfile, isLoading: isAuthLoading } = useStudentProfile();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);

  // Preview modal state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (studentProfile) {
      setProfile(studentProfile);
    } else if (!isAuthLoading) {
      setProfile(null);
    }
  }, [studentProfile, isAuthLoading]);

  useEffect(() => {
    const resolveAvatar = async () => {
      if (!currentUser) {
        setResolvedAvatarUrl(undefined);
        setIsLoading(false);
        return;
      }

      if (!studentProfile) {
        setResolvedAvatarUrl(currentUser.photoURL || undefined);
        setIsLoading(false);
        return;
      }

      try {
        if (studentProfile.avatar) {
          if (studentProfile.avatar.startsWith('http')) {
            setResolvedAvatarUrl(studentProfile.avatar);
          } else {
            const idToken = await currentUser.getIdToken(true);
            const { url } = await getPresignedDownloadUrl(studentProfile.avatar, currentUser.uid, undefined, idToken);
            setResolvedAvatarUrl(url || undefined);
          }
        } else {
          setResolvedAvatarUrl(undefined);
        }
      } catch (e) {
        console.error("Failed to load profile avatar:", e);
      } finally {
        setIsLoading(false);
      }
    };

    void resolveAvatar();
  }, [currentUser, studentProfile]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;

    setIsSaving(true);
    try {
      await updateUser(profile);
      toast({ title: "Profile Updated", description: "Your changes have been saved successfully." });
    } catch {
      toast({ variant: 'destructive', title: "Update Failed", description: "There was an error saving your changes." });
    } finally {
      setIsSaving(false);
    }
  };

  const selectFileForPreview = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please select an image file.' });
      return;
    }
    setPendingFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewDataUrl(e.target?.result as string);
      setIsPreviewOpen(true);
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const confirmUpload = useCallback(async () => {
    if (!pendingFile || !currentUser || !profile) return;
    setIsPreviewOpen(false);

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const { url, key, error, contentType } = await getPresignedUploadUrl(
        currentUser.uid,
        'avatar',
        pendingFile.name,
        pendingFile.type
      );

      if (error || !key || !url) throw new Error(error || 'Failed to sign upload');

      const idToken = await currentUser.getIdToken(true);
      await uploadToR2(url, pendingFile, contentType || pendingFile.type || 'application/octet-stream', {
        key,
        idToken,
        onProgress: setUploadProgress,
      });

      const newProfile = { ...profile, avatar: key };
      setProfile(newProfile);

      if (previewDataUrl) setResolvedAvatarUrl(previewDataUrl);

      const { url: downloadUrl } = await getPresignedDownloadUrl(key, currentUser.uid, undefined, idToken);
      if (downloadUrl) setResolvedAvatarUrl(downloadUrl);

      toast({ title: 'Photo uploaded', description: 'Click Save Changes to apply permanently.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Upload Failed', description: err.message });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setPendingFile(null);
      setPreviewDataUrl(null);
    }
  }, [pendingFile, currentUser, profile, previewDataUrl, toast]);

  const cancelPreview = () => {
    setIsPreviewOpen(false);
    setPendingFile(null);
    setPreviewDataUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) selectFileForPreview(file);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) selectFileForPreview(file);
  };

  if (isAuthLoading || isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24 mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-10 w-28" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
          <Skeleton className="h-24 w-full" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-10 w-24" />
        </CardFooter>
      </Card>
    );
  }

  if (!profile) {
    return <div className="p-8 text-center text-muted-foreground">User profile not found.</div>;
  }

  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Edit your bio, avatar, and academic goals. This information will be displayed to other users.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSave}>
          <CardContent className="space-y-6">
            <div className="flex items-start gap-6">
              <div
                className={cn(
                  'relative group cursor-pointer rounded-full transition-all',
                  isDragging && 'ring-2 ring-primary ring-offset-2'
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                title="Click or drag an image to change your photo"
              >
                <Avatar className="h-24 w-24 border-2 border-primary/10 transition-all group-hover:opacity-80">
                  <AvatarImage src={resolvedAvatarUrl} />
                  <AvatarFallback className="text-2xl font-black bg-primary/5 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 group-hover:bg-black/30 transition-all">
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </div>
                )}
              </div>

              <div className="space-y-3 flex-1 pt-1">
                <div className="space-y-1">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="gap-2 h-9 font-bold"
                  >
                    <Upload size={15} />
                    {isUploading ? 'Uploading...' : 'Upload Photo'}
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    Click the avatar or drag &amp; drop. A preview will appear before upload.
                  </p>
                </div>
                {isUploading && (
                  <div className="space-y-1 max-w-xs">
                    <Progress value={uploadProgress} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground">{uploadProgress}%</p>
                  </div>
                )}
              </div>

              <input
                type="file"
                ref={fileInputRef}
                className="sr-only"
                accept="image/*"
                onChange={handleAvatarUpload}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={profile.name}
                  onChange={e => setProfile({ ...profile, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" defaultValue={profile.email} disabled className="bg-muted/50" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio / Academic Goal</Label>
              <Textarea
                id="bio"
                placeholder="Tell us about yourself and your learning goals..."
                value={profile.bio}
                onChange={e => setProfile({ ...profile, bio: e.target.value })}
                rows={3}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSaving || isUploading} className="font-bold">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Avatar preview/confirm modal */}
      <Dialog open={isPreviewOpen} onOpenChange={(open) => { if (!open) cancelPreview(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Photo</DialogTitle>
            <DialogDescription>
              This is a preview of your new profile photo. Confirm to upload it, or cancel to choose a different image.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {previewDataUrl ? (
              <img
                src={previewDataUrl}
                alt="Avatar preview"
                className="h-36 w-36 rounded-full object-cover border-4 border-primary/10 shadow-md"
              />
            ) : (
              <div className="h-36 w-36 rounded-full bg-muted flex items-center justify-center">
                <AlertCircle className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
            {pendingFile && (
              <div className="text-center">
                <p className="text-sm font-medium truncate max-w-xs">{pendingFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(pendingFile.size / 1024).toFixed(1)} KB · {pendingFile.type}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={cancelPreview}>
              Cancel
            </Button>
            <Button onClick={confirmUpload} className="font-bold">
              <Upload className="mr-2 h-4 w-4" />
              Upload Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
