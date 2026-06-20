'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { User as AppUser, UserAddress } from '@/lib/db';

export default function TutorAddressSettingsPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [address, setAddress] = useState<UserAddress>({
    line1: '',
    city: '',
    region: '',
    zip: '',
    phone: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchAddress = async () => {
      if (!currentUser) return;
      if (!firestore) {
        setIsLoading(false);
        return;
      }
      try {
        const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as AppUser;
          if (userData.address) {
            setAddress(userData.address);
          }
        }
      } catch (error) {
        console.error('Failed to fetch address:', error);
        toast({ variant: 'destructive', title: 'Failed to load address' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchAddress();
  }, [currentUser, firestore, toast]);

  const handleSave = async () => {
    if (!currentUser || !firestore) return;

    if (!address.line1.trim() || !address.city.trim() || !address.region.trim()) {
      toast({ variant: 'destructive', title: 'Missing required fields', description: 'Please fill in all required fields.' });
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'users', currentUser.uid), {
        address,
      });
      toast({ title: 'Address saved', description: 'Your teaching address has been updated.' });
    } catch (error) {
      console.error('Failed to save address:', error);
      toast({ variant: 'destructive', title: 'Failed to save address' });
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
          Address settings are not ready yet. Wait a moment, then try again.
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
          <MapPin className="h-5 w-5" />
          Teaching Address
        </CardTitle>
        <CardDescription>
          Manage your primary teaching location and contact information.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label htmlFor="line1">Street Address *</Label>
            <Input
              id="line1"
              placeholder="e.g., 123 Main Street"
              value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="line2">Apartment, Suite (Optional)</Label>
            <Input
              id="line2"
              placeholder="e.g., Apt 4B"
              value={address.line2 || ''}
              onChange={(e) => setAddress({ ...address, line2: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                placeholder="e.g., Accra"
                value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="region">Region/State *</Label>
              <Input
                id="region"
                placeholder="e.g., Greater Accra"
                value={address.region}
                onChange={(e) => setAddress({ ...address, region: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="zip">Postal Code</Label>
              <Input
                id="zip"
                placeholder="e.g., 00233"
                value={address.zip}
                onChange={(e) => setAddress({ ...address, zip: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                placeholder="e.g., +233 24 123 4567"
                value={address.phone}
                onChange={(e) => setAddress({ ...address, phone: e.target.value })}
              />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? 'Saving...' : 'Save Address'}
        </Button>
      </CardFooter>
    </Card>
  );
}
