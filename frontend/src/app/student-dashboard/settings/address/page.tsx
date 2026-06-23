'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Loader2 } from "lucide-react";
import { useStudentProfile } from "@/hooks/use-student-profile";
import { updateUserAddress } from "@/lib/user-data";
import { type UserAddress } from "@/lib/db";

export default function AddressSettingsPage() {
  const { user, profile: userProfile, isLoading } = useStudentProfile();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [address, setAddress] = useState<UserAddress>({
    line1: '',
    line2: '',
    city: '',
    region: 'greater-accra',
    zip: '',
    phone: ''
  });

  useEffect(() => {
    if (userProfile?.address) {
      try {
        const parsed = typeof userProfile.address === 'string'
          ? JSON.parse(userProfile.address)
          : userProfile.address;
        if (parsed) {
          setAddress({
            line1: parsed.line1 || '',
            line2: parsed.line2 || '',
            city: parsed.city || '',
            region: parsed.region || 'greater-accra',
            zip: parsed.zip || '',
            phone: parsed.phone || ''
          });
        }
      } catch (e) {
        // Fallback if it is not valid JSON
      }
    }
  }, [userProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSaving(true);
    try {
        await updateUserAddress(user.uid, address);
        toast({ title: "Address Saved", description: "Your shipping information has been updated successfully." });
    } catch (error) {
        toast({ variant: 'destructive', title: "Update Failed", description: "Could not update your address. Please try again." });
    } finally {
        setIsSaving(false);
    }
  };

  if (isLoading) {
      return (
          <Card>
              <CardHeader>
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                          <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                          <CardTitle>Shipping Address</CardTitle>
                          <CardDescription>
                          Manage where your physical study materials and textbooks are delivered.
                          </CardDescription>
                      </div>
                  </div>
              </CardHeader>
              <CardContent className="h-40 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
              <CardFooter>
                  <Button disabled>
                      Save Changes
                  </Button>
              </CardFooter>
          </Card>
      )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
                <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
                <CardTitle>Shipping Address</CardTitle>
                <CardDescription>
                Manage where your physical study materials and textbooks are delivered.
                </CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <form id="address-form" onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="line1">Address Line 1</Label>
                    <Input 
                        id="line1" 
                        value={address.line1} 
                        onChange={e => setAddress({...address, line1: e.target.value})} 
                        placeholder="e.g. 123 Main St" 
                        required 
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="line2">Address Line 2 (Optional)</Label>
                    <Input 
                        id="line2" 
                        value={address.line2 || ''} 
                        onChange={e => setAddress({...address, line2: e.target.value})} 
                        placeholder="Apartment, suite, etc." 
                    />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input 
                        id="city" 
                        value={address.city} 
                        onChange={e => setAddress({...address, city: e.target.value})} 
                        placeholder="Accra" 
                        required 
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Select value={address.region} onValueChange={v => setAddress({...address, region: v})}>
                        <SelectTrigger id="region">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="greater-accra">Greater Accra</SelectItem>
                            <SelectItem value="ashanti">Ashanti</SelectItem>
                            <SelectItem value="central">Central</SelectItem>
                            <SelectItem value="western">Western</SelectItem>
                            <SelectItem value="northern">Northern</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="zip">Postal Code</Label>
                    <Input 
                        id="zip" 
                        value={address.zip} 
                        onChange={e => setAddress({...address, zip: e.target.value})} 
                        placeholder="00233" 
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="phone">Contact Phone Number</Label>
                <Input 
                    id="phone" 
                    type="tel" 
                    value={address.phone} 
                    onChange={e => setAddress({...address, phone: e.target.value})} 
                    placeholder="+233..." 
                    required 
                />
            </div>
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form="address-form" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
        </Button>
      </CardFooter>
    </Card>
  );
}
