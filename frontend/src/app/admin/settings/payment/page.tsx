
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, KeyRound, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useUser } from "@/firebase";
import { logAdminAction } from "@/lib/audit-data";

/**
 * @fileOverview Paystack Integration Settings.
 * SECURITY: Secret keys are managed only through deployment environment variables.
 */

export default function AdminPaymentSettingsPage() {
  const { user: adminUser } = useUser();
  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '';
  const [showPublicKey, setShowPublicKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const handleAcknowledge = async () => {
    if (!adminUser) return;

    setIsSaving(true);
    try {
      await logAdminAction({
        actorId: adminUser.uid,
        actorName: adminUser.displayName || adminUser.email || 'Administrator',
        action: 'PAYMENT_SETTINGS_REVIEWED',
        targetId: 'payment-config',
        targetType: 'setting',
        severity: 'info',
        details: 'Reviewed Paystack configuration panel. Secret keys remain environment-managed only.',
      });

      toast({
        title: 'Configuration Reviewed',
        description: 'Paystack secrets are now managed only via deployment environment variables.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Audit Log Failed',
        description: 'Could not record the review action.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-none shadow-lg">
      <CardHeader className="bg-muted/30 border-b">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <CardTitle>Paystack Integration</CardTitle>
        </div>
        <CardDescription>
            Review the active Paystack configuration. Secret keys are not stored in Firestore and must be managed in your deployment secret manager.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-2">
            <Label htmlFor="paystack-pk">Public Key (Environment)</Label>
            <div className="relative">
                <Input 
                  id="paystack-pk" 
                  type={showPublicKey ? "text" : "password"} 
                  value={publicKey} 
                  readOnly
                  placeholder="pk_test_••••••••••••••••" 
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full hover:bg-transparent"
                  onClick={() => setShowPublicKey(!showPublicKey)}
                >
                  {showPublicKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
            </div>
        </div>
        <div className="p-4 rounded-lg bg-orange-50 border border-orange-100 flex gap-3">
          <ShieldCheck className="h-5 w-5 text-orange-600 shrink-0" />
          <p className="text-xs text-orange-800 leading-relaxed">
            <strong>Security Protocol:</strong> The Paystack secret key must exist only in deployment environment variables such as <code>PAYSTACK_SECRET_KEY</code>. This panel is informational and does not persist secrets to Firestore.
          </p>
        </div>
        <div className="p-4 rounded-lg bg-muted/40 border flex gap-3">
          <KeyRound className="h-5 w-5 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Update <code>NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY</code> and <code>PAYSTACK_SECRET_KEY</code> in your hosting provider's secret manager, then redeploy to apply changes.
          </p>
        </div>
      </CardContent>
      <CardFooter className="bg-muted/30 border-t p-6">
        <Button onClick={handleAcknowledge} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldCheck className="mr-2 h-4 w-4" />}
          Acknowledge Secure Setup
        </Button>
      </CardFooter>
    </Card>
  );
}
