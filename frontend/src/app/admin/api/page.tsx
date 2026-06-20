import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plug, ShieldAlert, TerminalSquare } from "lucide-react";

export default function AdminApiPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Plug className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold mb-2 font-headline">API & Integrations</h1>
          <p className="text-muted-foreground">
            Production integrations are configured with environment secrets, not browser storage.
          </p>
        </div>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Security Hardening Enabled</AlertTitle>
        <AlertDescription>
          Direct API key entry on this page is disabled to prevent accidental secret exposure in localStorage.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TerminalSquare className="h-5 w-5"/> Configure Secrets</CardTitle>
          <CardDescription>
            Set these values in deployment environment secrets and in your local `.env` during development.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Required integration keys:</p>
          <p>- PAYSTACK_SECRET_KEY / NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY</p>
          <p>- RESEND_API_KEY</p>
          <p>- FIREBASE_ADMIN_CREDENTIALS</p>
          <p>- GOOGLE_API_KEY or GEMINI_API_KEY</p>
          <p>- R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME</p>
          <p>- ARKESEL_SMS_API_KEY / ARKESEL_SMS_SENDER_ID (optional: ARKESEL_WHATSAPP_API_KEY, ARKESEL_WHATSAPP_SENDER, ARKESEL_API_KEY)</p>
        </CardContent>
      </Card>
    </div>
  );
}
