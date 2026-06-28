'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { validatePhoneNumber } from '@/lib/signup-validation';
import { apiFetch } from '@/lib/api-client';

export default function CompleteProfilePage() {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const validation = validatePhoneNumber(phone);
    if (!validation.isValid || !validation.normalized) {
      toast({ variant: 'destructive', title: 'Invalid phone number', description: validation.error });
      return;
    }
    setIsSaving(true);
    try {
      const res = await apiFetch('/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ phone_number: validation.normalized }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast({ title: 'Profile updated' });
      router.replace('/student-dashboard');
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not update profile' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container-sm section-pad">
      <Card>
        <CardHeader>
          <CardTitle>Complete your profile</CardTitle>
          <CardDescription>Add your phone number to continue using your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input id="phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save and continue'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
